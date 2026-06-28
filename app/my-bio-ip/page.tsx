"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getBioIPAssets,
  deleteBioIPAsset,
  getOrCreateUserId,
  type BioIPAssetRecord,
} from "@/lib/supabase/upload";
import ShareButton from "@/components/ShareButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
  });
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  draft:      { label: "초안",    cls: "bg-zinc-700 text-zinc-300" },
  registered: { label: "등록됨",  cls: "bg-emerald-900 text-emerald-300" },
  disputed:   { label: "분쟁 중", cls: "bg-amber-900 text-amber-300" },
  revoked:    { label: "취소됨",  cls: "bg-red-900 text-red-300" },
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCard({ asset, onDelete }: { asset: BioIPAssetRecord; onDelete: () => void }) {
  const [deleting, setDeleting] = React.useState(false);
  const handleDelete = async () => {
    if (!confirm("이 Bio-IP 자산을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try { await deleteBioIPAsset(asset.id, asset.video_url ?? undefined); onDelete(); }
    catch (e) { alert("삭제 실패: " + String(e)); setDeleting(false); }
  };
  const statusStyle = STATUS_STYLES[asset.status] ?? STATUS_STYLES["draft"];
  const faceLandmarkCount = asset.face_landmarks?.length ?? 0;
  const poseLandmarkCount = asset.pose_landmarks?.length ?? 0;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600">
      {/* Video thumbnail */}
      {asset.video_url ? (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-950">
          <video
            src={asset.video_url}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition hover:opacity-100">
            <a
              href={asset.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white/90 p-3"
            >
              <svg className="h-5 w-5 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </a>
          </div>
        </div>
      ) : (
        <div className="aspect-video rounded-xl bg-zinc-800 flex items-center justify-center">
          <svg className="h-10 w-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">{asset.title}</h2>
          {asset.watermark_id && (
            <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{asset.watermark_id}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle.cls}`}>
          {statusStyle.label}
        </span>
      </div>

      {/* Bio data summary */}
      {(faceLandmarkCount > 0 || poseLandmarkCount > 0) && (
        <div className="flex gap-2">
          {faceLandmarkCount > 0 && (
            <div className="rounded-lg bg-zinc-800 px-3 py-1.5 text-center">
              <p className="text-sm font-bold text-white">{faceLandmarkCount}</p>
              <p className="text-[10px] text-zinc-500">얼굴 랜드마크</p>
            </div>
          )}
          {poseLandmarkCount > 0 && (
            <div className="rounded-lg bg-zinc-800 px-3 py-1.5 text-center">
              <p className="text-sm font-bold text-white">{poseLandmarkCount}</p>
              <p className="text-[10px] text-zinc-500">신체 관절</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <span>등록 {formatDate(asset.registered_at)}</span>
        <div className="flex gap-2">
          {asset.video_url && (
            <a
              href={asset.video_url}
              download
              className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
            >
              다운로드
            </a>
          )}
          <button className="rounded-md bg-violet-700/40 px-2.5 py-1.5 text-violet-300 transition hover:bg-violet-700 hover:text-white">
            라이선스
          </button>
          <button onClick={handleDelete} disabled={deleting} className="rounded-md bg-red-900/40 px-2.5 py-1.5 text-red-400 transition hover:bg-red-700 hover:text-white disabled:opacity-40">
            {deleting ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>

      {/* Share */}
      <div className="border-t border-zinc-800 pt-3">
        <ShareButton
          text={`내 Bio-IP "${asset.title}"를 등록했어요! #BioIP #블록체인`}
        />
      </div>
    </article>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 animate-pulse">
      <div className="aspect-video rounded-xl bg-zinc-800" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-zinc-800" />
        <div className="h-3 w-1/3 rounded bg-zinc-800" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-16 rounded-lg bg-zinc-800" />
        <div className="h-10 w-16 rounded-lg bg-zinc-800" />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center gap-6 py-20 text-center">
      <div className="rounded-full border border-zinc-700 bg-zinc-900 p-6">
        <svg className="h-12 w-12 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">아직 등록된 Bio-IP가 없어요</h3>
        <p className="text-sm text-zinc-400">
          챌린지를 참여하고 나만의 생체 IP를 등록해보세요
        </p>
      </div>
      <Link
        href="/challenge"
        className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
        </svg>
        첫 챌린지 참여하기
      </Link>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MyBioIPPage() {
  const [assets,  setAssets]  = useState<BioIPAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const userId = await getOrCreateUserId();
        const data   = await getBioIPAssets(userId);
        if (!cancelled) setAssets(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const registered = assets.filter((a) => a.status === "registered").length;
  const disputed   = assets.filter((a) => a.status === "disputed").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      {/* ── Header ── */}
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold tracking-tight">My Bio-IP</h1>
          <p className="mt-1 text-sm text-zinc-400">
            등록된 생체 IP 자산을 관리하고 라이선스 현황을 확인하세요
          </p>

          {/* Stats row */}
          {!loading && (
            <div className="mt-5 flex flex-wrap gap-4">
              {[
                { label: "전체 자산", value: assets.length, color: "text-white" },
                { label: "등록됨",    value: registered,    color: "text-emerald-400" },
                { label: "분쟁 중",   value: disputed,      color: "text-amber-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className={`mt-0.5 text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}
          {loading && (
            <div className="mt-5 flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-zinc-400">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> 불러오는 중…
              </span>
            ) : (
              <>총 <span className="font-semibold text-white">{assets.length}</span>개 자산</>
            )}
          </p>
          <Link
            href="/challenge"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            + 새 자산 등록
          </Link>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-auto mt-6 max-w-5xl px-6">
          <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        </div>
      )}

      {/* ── Asset grid ── */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading && [1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          {!loading && assets.length === 0 && !error && <EmptyState />}
          {!loading && assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onDelete={() => setAssets((prev) => prev.filter((a) => a.id !== asset.id))} />
          ))}
        </div>
      </div>
    </main>
  );
}
