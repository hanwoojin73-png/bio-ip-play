-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Enum types ───────────────────────────────────────────────────────────────
create type asset_status     as enum ('draft', 'registered', 'disputed', 'revoked');
create type challenge_status as enum ('pending', 'active', 'resolved', 'dismissed');
create type challenge_type   as enum ('identity_dispute', 'unauthorised_use', 'ownership_claim', 'similarity_claim');
create type license_scope    as enum ('exclusive', 'non_exclusive', 'personal_only');
create type payment_currency as enum ('USD', 'ETH', 'USDC', 'MATIC');
create type payment_status   as enum ('pending', 'confirmed', 'failed', 'refunded');

-- ─── users ───────────────────────────────────────────────────────────────────
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text        not null unique,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── bio_ip_assets ────────────────────────────────────────────────────────────
create table public.bio_ip_assets (
  id                 uuid         primary key default uuid_generate_v4(),
  owner_id           uuid         not null references public.users(id) on delete cascade,
  bio_signature_id   text         not null,
  title              text         not null,
  description        text         not null default '',
  status             asset_status not null default 'draft',
  -- LicenseTerms stored as jsonb: { scope, allowedUseCases, prohibitedUseCases,
  --   territoryCodes, expiresAt?, royaltyRateBps }
  license_terms      jsonb        not null,
  registered_at      timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),
  challenge_ids      text[]       not null default '{}',
  metadata_uri       text
);

-- ─── challenges ───────────────────────────────────────────────────────────────
create table public.challenges (
  id                   uuid             primary key default uuid_generate_v4(),
  asset_id             uuid             not null references public.bio_ip_assets(id) on delete cascade,
  challenger_owner_id  uuid             not null references public.users(id) on delete cascade,
  type                 challenge_type   not null,
  status               challenge_status not null default 'pending',
  evidence             text[]           not null default '{}',
  description          text             not null,
  filed_at             timestamptz      not null default now(),
  resolved_at          timestamptz,
  resolution           text
);

-- ─── royalty_payments ─────────────────────────────────────────────────────────
create table public.royalty_payments (
  id                  uuid             primary key default uuid_generate_v4(),
  asset_id            uuid             not null references public.bio_ip_assets(id) on delete cascade,
  payer_id            uuid             not null references public.users(id),
  payee_id            uuid             not null references public.users(id),
  amount_bps          integer          not null check (amount_bps > 0 and amount_bps <= 10000),
  amount_value        numeric(18, 6)   not null check (amount_value >= 0),
  currency            payment_currency not null,
  status              payment_status   not null default 'pending',
  usage_description   text             not null,
  period_start        timestamptz      not null,
  period_end          timestamptz      not null,
  paid_at             timestamptz,
  tx_hash             text,
  check (period_end > period_start)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index on public.bio_ip_assets (owner_id);
create index on public.bio_ip_assets (status);
create index on public.challenges    (asset_id);
create index on public.challenges    (challenger_owner_id);
create index on public.challenges    (status);
create index on public.royalty_payments (asset_id);
create index on public.royalty_payments (payee_id);
create index on public.royalty_payments (status);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger trg_assets_updated_at
  before update on public.bio_ip_assets
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.users            enable row level security;
alter table public.bio_ip_assets    enable row level security;
alter table public.challenges       enable row level security;
alter table public.royalty_payments enable row level security;

-- users: 본인 프로필만 수정 가능, 조회는 전체 허용
create policy "users_select_all"  on public.users for select using (true);
create policy "users_update_own"  on public.users for update using (auth.uid() = id);

-- bio_ip_assets: 누구나 조회, 소유자만 CUD
create policy "assets_select_all"   on public.bio_ip_assets for select using (true);
create policy "assets_insert_own"   on public.bio_ip_assets for insert with check (auth.uid() = owner_id);
create policy "assets_update_own"   on public.bio_ip_assets for update using (auth.uid() = owner_id);
create policy "assets_delete_own"   on public.bio_ip_assets for delete using (auth.uid() = owner_id);

-- challenges: 누구나 조회, 제출자만 생성, 자산 소유자만 상태 수정
create policy "challenges_select_all"    on public.challenges for select using (true);
create policy "challenges_insert_own"    on public.challenges for insert with check (auth.uid() = challenger_owner_id);
create policy "challenges_update_owner"  on public.challenges for update
  using (
    auth.uid() = challenger_owner_id or
    auth.uid() = (select owner_id from public.bio_ip_assets where id = asset_id)
  );

-- royalty_payments: 관련 당사자(지불자·수취인)만 조회, 지불자만 생성
create policy "payments_select_parties" on public.royalty_payments for select
  using (auth.uid() = payer_id or auth.uid() = payee_id);
create policy "payments_insert_payer"   on public.royalty_payments for insert
  with check (auth.uid() = payer_id);
create policy "payments_update_payer"   on public.royalty_payments for update
  using (auth.uid() = payer_id);
