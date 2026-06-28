"use client";

import { useState, useTransition } from "react";
import { approveAsset, rejectAsset } from "./actions";
import type { BioIPAssetRow, ChallengeRow, RoyaltyPaymentRow } from "@/types/database";
import type { ChallengeStatus, ChallengeType, AssetStatus, PaymentStatus, PaymentCurrency } from "@/types/bio-ip";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminData {
  stats: {
    totalUsers:   number;
    totalAssets:  number;
    totalRevenue: number;
    todaySignups: number;
  };
  challenges:    ChallengeRow[];
  purchases:     RoyaltyPaymentRow[];
  pendingAssets: BioIPAssetRow[];
  assetMap:      Record<string, string>; // id → title
  fetchError?:   string;
}

// ─── Localization maps ────────────────────────────────────────────────────────

const CHALLENGE_TYPE: Record<ChallengeType, string> = {
  identity_dispute: "신원 분쟁",
  unauthorised_use: "무단 사용",
  ownership_claim:  "소유권 주장",
  similarity_claim: "유사성 주장",
};

const CHALLENGE_STATUS_META: Record<ChallengeStatus, { label: string; cls: string }> = {
  pending:   { label: "대기 중",  cls: "bg-zinc-700/60 text-zinc-300" },
  active:    { label: "진행 중",  cls: "bg-blue-900/60 text-blue-300" },
  resolved:  { label: "해결됨",   cls: "bg-emerald-900/60 text-emerald-300" },
  dismissed: { label: "기각됨",   cls: "bg-red-900/60 text-red-300" },
};

const ASSET_STATUS_META: Record<AssetStatus, { label: string; cls: string }> = {
  draft:      { label: "검토 대기", cls: "bg-amber-900/60 text-amber-300" },
  registered: { label: "등록됨",   cls: "bg-emerald-900/60 text-emerald-300" },
  disputed:   { label: "분쟁 중",  cls: "bg-orange-900/60 text-orange-300" },
  revoked:    { label: "취소됨",   cls: "bg-red-900/60 text-red-300" },
};

const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; cls: string }> = {
  pending:   { label: "처리 중", cls: "bg-zinc-700/60 text-zinc-300" },
  confirmed: { label: "완료",   cls: "bg-emerald-900/60 text-emerald-300" },
  failed:    { label: "실패",   cls: "bg-red-900/60 text-red-300" },
  refunded:  { label: "환불됨", cls: "bg-amber-900/60 text-amber-300" },
};

const CURRENCY_CLS: Record<PaymentCurrency, string> = {
  USDC:  "text-blue-400",
  ETH:   "text-violet-400",
  MATIC: "text-purple-400",
  USD:   "text-emerald-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string) {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatCurrency(value: number, currency: PaymentCurrency) {
  if (currency === "USD" || currency === "USDC")
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${value.toFixed(4)} ${currency}`;
}

// ─── Small shared components ──────────────────────────────────────────────────

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-3 mb-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center text-sm text-zinc-600">{message}</td>
    </tr>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accentCls,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accentCls: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${accentCls}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold leading-none text-white">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-zinc-600">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Challenges table ─────────────────────────────────────────────────────────

function ChallengesTable({ rows }: { rows: ChallengeRow[] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="px-5 pt-5">
        <SectionHeader title="최근 챌린지 참여" count={rows.length} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["유저 ID", "챌린지 종류", "상태", "생성일"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.length === 0 ? (
              <EmptyRow cols={4} message="챌린지 데이터가 없습니다" />
            ) : (
              rows.map((row) => {
                const sm = CHALLENGE_STATUS_META[row.status];
                return (
                  <tr key={row.id} className="transition hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {shortId(row.challenger_owner_id)}
                    </td>
                    <td className="px-4 py-3 text-zinc-200">
                      {CHALLENGE_TYPE[row.type]}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={sm.label} cls={sm.cls} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(row.filed_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Purchases table ──────────────────────────────────────────────────────────

function PurchasesTable({
  rows, assetMap,
}: {
  rows: RoyaltyPaymentRow[];
  assetMap: Record<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="px-5 pt-5">
        <SectionHeader title="최근 라이선스 구매" count={rows.length} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["구매자", "자산명", "통화", "금액", "상태", "일시"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.length === 0 ? (
              <EmptyRow cols={6} message="구매 내역이 없습니다" />
            ) : (
              rows.map((row) => {
                const psm = PAYMENT_STATUS_META[row.status];
                const ccls = CURRENCY_CLS[row.currency];
                const assetTitle = assetMap[row.asset_id] ?? shortId(row.asset_id);
                return (
                  <tr key={row.id} className="transition hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {shortId(row.payer_id)}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-zinc-200" title={assetTitle}>
                      {assetTitle}
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs font-semibold ${ccls}`}>
                      {row.currency}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-200">
                      {formatCurrency(row.amount_value, row.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={psm.label} cls={psm.cls} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(row.paid_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pending asset card ───────────────────────────────────────────────────────

function PendingAssetCard({
  asset,
  onApprove,
  onReject,
  processingId,
}: {
  asset: BioIPAssetRow;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  processingId: string | null;
}) {
  const isProcessing = processingId === asset.id;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-amber-900/40 bg-zinc-900 p-5 transition hover:border-amber-700/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{asset.title}</h3>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{shortId(asset.owner_id)}</p>
        </div>
        <Badge
          label={ASSET_STATUS_META[asset.status].label}
          cls={ASSET_STATUS_META[asset.status].cls}
        />
      </div>

      {/* Description */}
      {asset.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">{asset.description}</p>
      )}

      {/* License terms mini-summary */}
      {asset.license_terms && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-400">
            로열티 {(asset.license_terms.royaltyRateBps / 100).toFixed(1)}%
          </span>
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-400">
            {asset.license_terms.scope}
          </span>
          {asset.license_terms.territoryCodes?.slice(0, 3).map((c) => (
            <span key={c} className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-400">{c}</span>
          ))}
        </div>
      )}

      {/* Registered at */}
      <p className="text-[11px] text-zinc-600">
        등록 요청일: {formatDate(asset.registered_at)}
      </p>

      {/* Actions */}
      <div className="flex gap-2 border-t border-zinc-800 pt-4">
        <button
          onClick={() => onApprove(asset.id)}
          disabled={isProcessing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-600/50 hover:text-white disabled:opacity-50 active:scale-95"
        >
          {isProcessing ? <Spinner className="h-3.5 w-3.5" /> : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          승인
        </button>
        <button
          onClick={() => onReject(asset.id)}
          disabled={isProcessing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-900/30 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-800/50 hover:text-white disabled:opacity-50 active:scale-95"
        >
          {isProcessing ? <Spinner className="h-3.5 w-3.5" /> : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          거절
        </button>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard({
  data,
  logoutAction,
}: {
  data: AdminData;
  logoutAction: () => Promise<void>;
}) {
  const { stats, challenges, purchases, fetchError } = data;

  // Local state for pending assets (so approve/reject removes from list instantly)
  const [pendingAssets, setPendingAssets] = useState<BioIPAssetRow[]>(data.pendingAssets);
  const [actionError,   setActionError]   = useState<string | null>(null);
  const [processingId,  setProcessingId]  = useState<string | null>(null);
  const [isPending,     startTransition]  = useTransition();

  function handleApprove(id: string) {
    setActionError(null);
    setProcessingId(id);
    startTransition(async () => {
      const result = await approveAsset(id);
      setProcessingId(null);
      if (result.error) {
        setActionError(result.error);
      } else {
        setPendingAssets((prev) => prev.filter((a) => a.id !== id));
      }
    });
  }

  function handleReject(id: string) {
    setActionError(null);
    setProcessingId(id);
    startTransition(async () => {
      const result = await rejectAsset(id);
      setProcessingId(null);
      if (result.error) {
        setActionError(result.error);
      } else {
        setPendingAssets((prev) => prev.filter((a) => a.id !== id));
      }
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-700/50 bg-violet-900/40">
              <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-white">Admin Dashboard</p>
              <p className="text-[10px] text-zinc-500">BIO-IP Play</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/admin"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              새로고침
            </a>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-700 hover:text-red-400"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* ── Fetch error banner ── */}
        {fetchError && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-800/60 bg-amber-950/30 px-5 py-3.5">
            <svg className="h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-300">데이터 로드 오류</p>
              <p className="text-xs text-amber-500">{fetchError}</p>
            </div>
          </div>
        )}

        {/* ── Action error banner ── */}
        {actionError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-800/60 bg-red-950/30 px-5 py-3">
            <p className="text-sm text-red-300">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── 1. Stats ── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600">전체 통계</h2>
            <div className="flex-1 border-t border-zinc-800" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="총 사용자"
              value={stats.totalUsers.toLocaleString()}
              sub="전체 가입자 수"
              accentCls="bg-blue-900/40 border border-blue-800/40"
              icon={
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
            />
            <StatCard
              label="총 Bio-IP 자산"
              value={stats.totalAssets.toLocaleString()}
              sub="등록된 전체 자산"
              accentCls="bg-violet-900/40 border border-violet-800/40"
              icon={
                <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              }
            />
            <StatCard
              label="총 거래액"
              value={`$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub="확정된 로열티 합계"
              accentCls="bg-emerald-900/40 border border-emerald-800/40"
              icon={
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="오늘 신규 가입"
              value={stats.todaySignups.toLocaleString()}
              sub={new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
              accentCls="bg-amber-900/40 border border-amber-800/40"
              icon={
                <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* ── 2 & 3. Challenges + Purchases ── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600">활동 내역</h2>
            <div className="flex-1 border-t border-zinc-800" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChallengesTable rows={challenges} />
            <PurchasesTable rows={purchases} assetMap={data.assetMap} />
          </div>
        </section>

        {/* ── 4. Pending assets ── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600">미승인 Bio-IP 자산</h2>
            {pendingAssets.length > 0 && (
              <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                {pendingAssets.length}건 대기 중
              </span>
            )}
            <div className="flex-1 border-t border-zinc-800" />
          </div>

          {pendingAssets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 py-16 text-center">
              <svg className="h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-zinc-600">승인 대기 중인 자산이 없습니다.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pendingAssets.map((asset) => (
                <PendingAssetCard
                  key={asset.id}
                  asset={asset}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  processingId={processingId}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-zinc-800 pt-6 pb-2 text-center text-xs text-zinc-700">
          BIO-IP Play Admin · 마지막 갱신: {new Date().toLocaleString("ko-KR")}
        </footer>
      </main>
    </div>
  );
}
