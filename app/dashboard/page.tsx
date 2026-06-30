import type {
  BioIPAsset,
  RoyaltyPayment,
  Challenge,
  AssetStatus,
  PaymentStatus,
  ChallengeStatus,
} from "@/types/bio-ip";

// ─── Sample data ───────────────────────────────────────────────────────────────

const ASSETS: BioIPAsset[] = [
  {
    id: "asset-001",
    ownerId: "user-han",
    bioSignatureId: "sig-001",
    title: "Han Visual & Vocal Identity v1",
    description: "",
    status: "registered",
    contentType: "self",
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
    description: "",
    status: "disputed",
    contentType: "character",
    licenseTerms: {
      scope: "exclusive",
      allowedUseCases: ["metaverse", "gaming"],
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
    description: "",
    status: "draft",
    contentType: "self",
    licenseTerms: {
      scope: "personal_only",
      allowedUseCases: ["voiceover", "audiobook"],
      prohibitedUseCases: ["deepfake", "impersonation"],
      territoryCodes: ["KR"],
      royaltyRateBps: 500,
    },
    registeredAt: "2026-06-25T16:45:00Z",
    updatedAt: "2026-06-25T16:45:00Z",
    challenges: [],
  },
];

const PAYMENTS: RoyaltyPayment[] = [
  {
    id: "pay-001",
    assetId: "asset-001",
    payerId: "org-nexon",
    payeeId: "user-han",
    amountBps: 1000,
    amountValue: 4800,
    currency: "USDC",
    status: "confirmed",
    usageDescription: "Q2 광고 캠페인 – 시각·음성 아이덴티티 사용",
    periodStart: "2026-04-01T00:00:00Z",
    periodEnd: "2026-06-30T23:59:59Z",
    paidAt: "2026-06-28T10:14:00Z",
    txHash: "0xabc123def456789",
  },
  {
    id: "pay-002",
    assetId: "asset-001",
    payerId: "org-kakao",
    payeeId: "user-han",
    amountBps: 1000,
    amountValue: 2100,
    currency: "USDC",
    status: "confirmed",
    usageDescription: "교육 플랫폼 아바타 – 상반기",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-06-30T23:59:59Z",
    paidAt: "2026-06-15T09:30:00Z",
    txHash: "0xdef789abc012345",
  },
  {
    id: "pay-003",
    assetId: "asset-002",
    payerId: "org-krafton",
    payeeId: "user-han",
    amountBps: 2500,
    amountValue: 9200,
    currency: "ETH",
    status: "pending",
    usageDescription: "메타버스 댄스 모션 – 6월분",
    periodStart: "2026-06-01T00:00:00Z",
    periodEnd: "2026-06-30T23:59:59Z",
  },
  {
    id: "pay-004",
    assetId: "asset-001",
    payerId: "org-sm-ent",
    payeeId: "user-han",
    amountBps: 1000,
    amountValue: 3300,
    currency: "USDC",
    status: "confirmed",
    usageDescription: "엔터테인먼트 쇼케이스 – 5월",
    periodStart: "2026-05-01T00:00:00Z",
    periodEnd: "2026-05-31T23:59:59Z",
    paidAt: "2026-06-05T14:00:00Z",
    txHash: "0x111aaa222bbb333",
  },
  {
    id: "pay-005",
    assetId: "asset-002",
    payerId: "org-netmarble",
    payeeId: "user-han",
    amountBps: 2500,
    amountValue: 1450,
    currency: "USDC",
    status: "failed",
    usageDescription: "게임 캐릭터 모션 – 파이롯",
    periodStart: "2026-05-15T00:00:00Z",
    periodEnd: "2026-05-31T23:59:59Z",
  },
  {
    id: "pay-006",
    assetId: "asset-001",
    payerId: "org-coupang",
    payeeId: "user-han",
    amountBps: 1000,
    amountValue: 610,
    currency: "USDC",
    status: "pending",
    usageDescription: "커머스 광고 – 7월 (선입금)",
    periodStart: "2026-07-01T00:00:00Z",
    periodEnd: "2026-07-31T23:59:59Z",
  },
];

const CHALLENGES: Challenge[] = [
  {
    id: "challenge-alpha",
    assetId: "asset-002",
    challengerOwnerId: "user-external-01",
    type: "similarity_claim",
    status: "active",
    evidence: ["ipfs://QmEvidence001", "ipfs://QmEvidence002"],
    description:
      "댄스 모션 캡처가 2025년 등록된 외부 안무 동작과 85% 이상 유사하다는 주장.",
    filedAt: "2026-06-18T07:30:00Z",
  },
  {
    id: "challenge-beta",
    assetId: "asset-001",
    challengerOwnerId: "user-external-02",
    type: "unauthorised_use",
    status: "pending",
    evidence: ["ipfs://QmEvidence003"],
    description: "시각 아이덴티티가 승인되지 않은 광고 소재에 사용되었다는 신고.",
    filedAt: "2026-06-25T13:10:00Z",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function assetTitle(id: string) {
  return ASSETS.find((a) => a.id === id)?.title ?? id;
}

const CONFIRMED_TOTAL = PAYMENTS.filter((p) => p.status === "confirmed" && p.currency === "USDC")
  .reduce((sum, p) => sum + p.amountValue, 0);

const PENDING_TOTAL = PAYMENTS.filter((p) => p.status === "pending" && p.currency === "USDC")
  .reduce((sum, p) => sum + p.amountValue, 0);

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const ASSET_STATUS: Record<AssetStatus, { label: string; dot: string }> = {
  draft:      { label: "초안",    dot: "bg-zinc-500" },
  registered: { label: "등록됨",  dot: "bg-emerald-400" },
  disputed:   { label: "분쟁 중", dot: "bg-amber-400" },
  revoked:    { label: "취소됨",  dot: "bg-red-500" },
};

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; className: string }> = {
  pending:  { label: "대기",   className: "bg-amber-900/60 text-amber-300" },
  confirmed:{ label: "완료",   className: "bg-emerald-900/60 text-emerald-300" },
  failed:   { label: "실패",   className: "bg-red-900/60 text-red-400" },
  refunded: { label: "환불",   className: "bg-zinc-700 text-zinc-400" },
};

const CHALLENGE_STATUS: Record<ChallengeStatus, { label: string; className: string }> = {
  pending:   { label: "접수",   className: "bg-zinc-700 text-zinc-300" },
  active:    { label: "진행 중", className: "bg-amber-900/60 text-amber-300" },
  resolved:  { label: "해결됨", className: "bg-emerald-900/60 text-emerald-300" },
  dismissed: { label: "기각",   className: "bg-zinc-700 text-zinc-500" },
};

const CHALLENGE_TYPE_LABEL: Record<string, string> = {
  identity_dispute: "신원 분쟁",
  unauthorised_use: "무단 사용",
  ownership_claim:  "소유권 주장",
  similarity_claim: "유사성 주장",
};

// ─── UI atoms ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 space-y-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </h2>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const activeAssets    = ASSETS.filter((a) => a.status === "registered").length;
  const activeChallenge = CHALLENGES.filter((c) => c.status === "active" || c.status === "pending").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">안녕하세요,</p>
            <h1 className="text-2xl font-bold tracking-tight">Han's Dashboard</h1>
          </div>
          <span className="text-xs text-zinc-600">
            2026년 6월 28일 기준
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* ── KPI 카드 ── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="총 자산"
            value={String(ASSETS.length)}
            sub={`등록됨 ${activeAssets}개`}
          />
          <StatCard
            label="확정 로열티 (USDC)"
            value={`$${CONFIRMED_TOTAL.toLocaleString()}`}
            sub="이번 분기"
            accent="text-emerald-400"
          />
          <StatCard
            label="대기 중 로열티"
            value={`$${PENDING_TOTAL.toLocaleString()}`}
            sub="입금 예정"
            accent="text-amber-400"
          />
          <StatCard
            label="활성 챌린지"
            value={String(activeChallenge)}
            sub="대응 필요"
            accent={activeChallenge > 0 ? "text-red-400" : "text-white"}
          />
        </section>

        {/* ── 자산 현황 + 챌린지 ── */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* 자산 현황 */}
          <section className="space-y-3">
            <SectionTitle>자산 현황</SectionTitle>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
              {ASSETS.map((asset) => {
                const { dot, label } = ASSET_STATUS[asset.status];
                return (
                  <div key={asset.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {asset.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {(asset.licenseTerms.royaltyRateBps / 100).toFixed(1)}% 로열티 ·{" "}
                        {asset.licenseTerms.territoryCodes.join("/")}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-zinc-400">{label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 챌린지 */}
          <section className="space-y-3">
            <SectionTitle>챌린지</SectionTitle>
            {CHALLENGES.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-8 text-center text-sm text-zinc-600">
                활성 챌린지 없음
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
                {CHALLENGES.map((ch) => {
                  const { label, className } = CHALLENGE_STATUS[ch.status];
                  return (
                    <div key={ch.id} className="space-y-2 px-4 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-400">
                          {CHALLENGE_TYPE_LABEL[ch.type]}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
                          {label}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-200 leading-snug line-clamp-2">
                        {ch.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-zinc-600">
                        <span className="truncate">{assetTitle(ch.assetId)}</span>
                        <span className="flex-shrink-0">{formatDateShort(ch.filedAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── 최근 로열티 내역 ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>최근 로열티 내역</SectionTitle>
            <span className="text-xs text-zinc-600">최근 {PAYMENTS.length}건</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">자산</th>
                  <th className="px-4 py-3 font-medium">지급처</th>
                  <th className="px-4 py-3 font-medium">금액</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900">
                {PAYMENTS.map((pay) => {
                  const { label, className } = PAYMENT_STATUS[pay.status];
                  return (
                    <tr key={pay.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="max-w-[160px] truncate font-medium text-zinc-200">
                          {assetTitle(pay.assetId)}
                        </p>
                        <p className="text-xs text-zinc-600 line-clamp-1">{pay.usageDescription}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{pay.payerId}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-white">
                          {pay.amountValue.toLocaleString()}
                        </span>
                        <span className="ml-1 text-xs text-zinc-500">{pay.currency}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {pay.paidAt ? formatDate(pay.paidAt) : formatDate(pay.periodStart)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Royalty summary bar */}
          <div className="flex flex-wrap gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-3 text-sm">
            {(["confirmed", "pending", "failed"] as PaymentStatus[]).map((s) => {
              const total = PAYMENTS.filter((p) => p.status === s && p.currency === "USDC")
                .reduce((sum, p) => sum + p.amountValue, 0);
              const { label, className } = PAYMENT_STATUS[s];
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
                    {label}
                  </span>
                  <span className="font-mono text-zinc-300">${total.toLocaleString()} USDC</span>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
