import type {
  AssetStatus,
  ChallengeStatus,
  ChallengeType,
  LicenseScope,
  LicenseTerms,
  PaymentCurrency,
  PaymentStatus,
} from "./bio-ip";

// ─── Table row types (snake_case — matches Postgres column names) ──────────────

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BioIPAssetRow {
  id: string;
  owner_id: string;
  bio_signature_id: string;
  title: string;
  description: string;
  status: AssetStatus;
  license_terms: LicenseTerms;   // stored as jsonb
  registered_at: string;
  updated_at: string;
  challenge_ids: string[];
  metadata_uri: string | null;
}

export interface ChallengeRow {
  id: string;
  asset_id: string;
  challenger_owner_id: string;
  type: ChallengeType;
  status: ChallengeStatus;
  evidence: string[];
  description: string;
  filed_at: string;
  resolved_at: string | null;
  resolution: string | null;
}

export interface RoyaltyPaymentRow {
  id: string;
  asset_id: string;
  payer_id: string;
  payee_id: string;
  amount_bps: number;
  amount_value: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  usage_description: string;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  tx_hash: string | null;
}

// ─── Insert / Update helpers (omit server-generated fields) ───────────────────

export type UserInsert = Omit<UserRow, "created_at" | "updated_at">;
export type UserUpdate = Partial<Omit<UserRow, "id" | "created_at">>;

export type BioIPAssetInsert = Omit<BioIPAssetRow, "registered_at" | "updated_at">;
export type BioIPAssetUpdate = Partial<Omit<BioIPAssetRow, "id" | "owner_id" | "registered_at">>;

export type ChallengeInsert = Omit<ChallengeRow, "filed_at" | "resolved_at" | "resolution">;
export type ChallengeUpdate = Partial<Pick<ChallengeRow, "status" | "resolved_at" | "resolution">>;

export type RoyaltyPaymentInsert = Omit<RoyaltyPaymentRow, "paid_at">;
export type RoyaltyPaymentUpdate = Partial<Pick<RoyaltyPaymentRow, "status" | "paid_at" | "tx_hash">>;

// ─── Licenses (on-chain purchase records) ─────────────────────────────────────

export interface LicenseRow {
  id:            string;
  bio_ip_id:     string;   // marketplace asset ID or on-chain token ID
  buyer_address: string;   // wallet address (checksummed)
  tx_hash:       string;   // Polygon Amoy transaction hash
  purchased_at:  string;   // ISO timestamp
}

export type LicenseInsert = Omit<LicenseRow, "id">;
export type LicenseUpdate = Partial<Pick<LicenseRow, "tx_hash">>;

// ─── Supabase Database generic (passed to createClient<Database>) ─────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row:    UserRow;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      bio_ip_assets: {
        Row:    BioIPAssetRow;
        Insert: BioIPAssetInsert;
        Update: BioIPAssetUpdate;
      };
      challenges: {
        Row:    ChallengeRow;
        Insert: ChallengeInsert;
        Update: ChallengeUpdate;
      };
      royalty_payments: {
        Row:    RoyaltyPaymentRow;
        Insert: RoyaltyPaymentInsert;
        Update: RoyaltyPaymentUpdate;
      };
      licenses: {
        Row:    LicenseRow;
        Insert: LicenseInsert;
        Update: LicenseUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      asset_status:   AssetStatus;
      challenge_status: ChallengeStatus;
      challenge_type:   ChallengeType;
      license_scope:    LicenseScope;
      payment_currency: PaymentCurrency;
      payment_status:   PaymentStatus;
    };
  };
}
