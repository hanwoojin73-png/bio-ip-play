import type { BioIPAsset, AssetStatus, LicenseScope } from "@/types/bio-ip";

// ─── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_ASSETS: BioIPAsset[] = [
  {
    id: "asset-001",
    ownerId: "user-han",
    bioSignatureId: "sig-001",
    title: "Han Visual & Vocal Identity v1",
    description:
      "Full biometric identity capture covering facial geometry, vocal timbre, and expressive range. Registered for entertainment and brand licensing.",
    status: "registered",
    licenseTerms: {
      scope: "non_exclusive",
      allowedUseCases: ["advertising", "entertainment", "education"],
      prohibitedUseCases: ["political", "adult_content"],
      territoryCodes: ["KR", "US", "JP"],
      royaltyRateBps: 1000,
    },
    registeredAt: "2026-01-15T09:00:00Z",
    updatedAt: "2026-06-10T14:22:00Z",
    challenges: [],
    metadataUri: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/001",
  },
  {
    id: "asset-002",
    ownerId: "user-han",
    bioSignatureId: "sig-002",
    title: "Motion Dynamics Layer – Dance",
    description:
      "Isolated dynamics-layer capture of choreographic gesture vocabulary and movement tempo. Specialised for metaverse avatar animation licensing.",
    status: "disputed",
    licenseTerms: {
      scope: "exclusive",
      allowedUseCases: ["metaverse", "gaming", "animation"],
      prohibitedUseCases: ["surveillance", "political"],
      territoryCodes: ["KR", "US"],
      expiresAt: "2027-01-14T23:59:59Z",
      royaltyRateBps: 2500,
    },
    registeredAt: "2026-03-02T11:30:00Z",
    updatedAt: "2026-06-20T08:05:00Z",
    challenges: ["challenge-alpha"],
    metadataUri: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/002",
  },
  {
    id: "asset-003",
    ownerId: "user-han",
    bioSignatureId: "sig-003",
    title: "Vocal Signature – Narration Profile",
    description:
      "Vocal-layer-only capture optimised for AI voice synthesis licensing. Covers pitch contour, accent, and breathing pattern for Korean and English.",
    status: "draft",
    licenseTerms: {
      scope: "personal_only",
      allowedUseCases: ["voiceover", "audiobook"],
      prohibitedUseCases: ["deepfake", "impersonation", "political"],
      territoryCodes: ["KR"],
      royaltyRateBps: 500,
    },
    registeredAt: "2026-06-25T16:45:00Z",
    updatedAt: "2026-06-25T16:45:00Z",
    challenges: [],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(1);
}

const STATUS_STYLES: Record<AssetStatus, { label: string; className: string }> = {
  draft:      { label: "초안",    className: "bg-zinc-700 text-zinc-300" },
  registered: { label: "등록됨",  className: "bg-emerald-900 text-emerald-300" },
  disputed:   { label: "분쟁 중", className: "bg-amber-900 text-amber-300" },
  revoked:    { label: "취소됨",  className: "bg-red-900 text-red-300" },
};

const SCOPE_LABEL: Record<LicenseScope, string> = {
  exclusive:     "독점",
  non_exclusive: "비독점",
  personal_only: "개인 전용",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AssetStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function LayerTag({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
      {label}
    </span>
  );
}

function UseCaseTag({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs ${
        allowed
          ? "bg-blue-950 text-blue-300"
          : "bg-red-950 text-red-400 line-through"
      }`}
    >
      {label}
    </span>
  );
}

function AssetCard({ asset }: { asset: BioIPAsset }) {
  const { licenseTerms: lt } = asset;

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-600">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold leading-snug text-white">
            {asset.title}
          </h2>
          <p className="text-xs text-zinc-500 font-mono">{asset.id}</p>
        </div>
        <StatusBadge status={asset.status} />
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-zinc-400">{asset.description}</p>

      {/* Biometric layers (inferred from sigId prefix for demo) */}
      <div className="flex flex-wrap gap-2">
        {asset.bioSignatureId.includes("001") && (
          <>
            <LayerTag label="Visual" />
            <LayerTag label="Vocal" />
            <LayerTag label="Dynamics" />
          </>
        )}
        {asset.bioSignatureId.includes("002") && <LayerTag label="Dynamics" />}
        {asset.bioSignatureId.includes("003") && <LayerTag label="Vocal" />}
      </div>

      {/* Divider */}
      <hr className="border-zinc-800" />

      {/* License terms */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">라이선스 범위</span>
          <span className="font-medium text-zinc-200">{SCOPE_LABEL[lt.scope]}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">로열티 비율</span>
          <span className="font-mono font-semibold text-emerald-400">
            {bpsToPercent(lt.royaltyRateBps)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">적용 지역</span>
          <span className="text-zinc-300">{lt.territoryCodes.join(" · ")}</span>
        </div>
        {lt.expiresAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">만료일</span>
            <span className="text-amber-400">{formatDate(lt.expiresAt)}</span>
          </div>
        )}
      </div>

      {/* Use cases */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-600">
          허용 / 금지 사용처
        </p>
        <div className="flex flex-wrap gap-1.5">
          {lt.allowedUseCases.map((u) => (
            <UseCaseTag key={u} label={u} allowed />
          ))}
          {lt.prohibitedUseCases.map((u) => (
            <UseCaseTag key={u} label={u} allowed={false} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span>등록 {formatDate(asset.registeredAt)}</span>
        <div className="flex items-center gap-3">
          {asset.challenges.length > 0 && (
            <span className="text-amber-500">
              챌린지 {asset.challenges.length}건
            </span>
          )}
          {asset.metadataUri && (
            <span className="font-mono truncate max-w-[120px]" title={asset.metadataUri}>
              {asset.metadataUri.slice(0, 20)}…
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white">
          상세 보기
        </button>
        <button className="flex-1 rounded-lg bg-violet-700 py-2 text-xs font-semibold text-white transition hover:bg-violet-600">
          라이선스 관리
        </button>
      </div>
    </article>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MyBioIPPage() {
  const total      = SAMPLE_ASSETS.length;
  const registered = SAMPLE_ASSETS.filter((a) => a.status === "registered").length;
  const disputed   = SAMPLE_ASSETS.filter((a) => a.status === "disputed").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold tracking-tight">My Bio-IP</h1>
          <p className="mt-1 text-sm text-zinc-400">
            등록된 생체 IP 자산을 관리하고 라이선스 현황을 확인하세요
          </p>

          {/* Summary stats */}
          <div className="mt-5 flex flex-wrap gap-4">
            {[
              { label: "전체 자산",  value: total,      color: "text-white" },
              { label: "등록됨",     value: registered, color: "text-emerald-400" },
              { label: "분쟁 중",    value: disputed,   color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className={`mt-0.5 text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-zinc-400">
            총 <span className="font-semibold text-white">{total}</span>개 자산
          </p>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500">
            + 새 자산 등록
          </button>
        </div>
      </div>

      {/* Asset grid */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_ASSETS.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>
    </main>
  );
}
