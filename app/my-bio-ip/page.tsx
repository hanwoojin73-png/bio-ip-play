"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getBioIPAssetsByIds,
  deleteBioIPAsset,
  updateBioIPAsset,
  type BioIPAssetRecord,
} from "@/lib/supabase/upload";
import type { PerformanceType } from "@/types/bio-ip";
import ShareButton from "@/components/ShareButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function readMyAssetIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("my_bio_ip_ids") || "[]");
  } catch {
    return [];
  }
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  draft:      { label: "초안",    cls: "bg-zinc-700 text-zinc-300" },
  registered: { label: "등록됨",  cls: "bg-emerald-900 text-emerald-300" },
  disputed:   { label: "분쟁 중", cls: "bg-amber-900 text-amber-300" },
  revoked:    { label: "취소됨",  cls: "bg-red-900 text-red-300" },
};

const PERFORMANCE_TYPES: PerformanceType[] = ["연기", "노래", "춤", "연주", "기타"];

// Each performance type gets its own distinct color so cards scan quickly.
const PERFORMANCE_BADGE: Record<PerformanceType, string> = {
  "연기": "bg-violet-900/60 text-violet-300",
  "노래": "bg-blue-900/60 text-blue-300",
  "춤":   "bg-pink-900/60 text-pink-300",
  "연주": "bg-emerald-900/60 text-emerald-300",
  "기타": "bg-zinc-700 text-zinc-300",
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-orange-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

// ─── License certificate ──────────────────────────────────────────────────────

function openLicenseCertificate(asset: BioIPAssetRecord) {
  const contentTypeLabel =
    asset.content_type === "character"
      ? "캐릭터 IP (저작권 보호)"
      : "본인 (퍼블리시티권 보호)";

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });

  const registeredAt = asset.registered_at
    ? new Date(asset.registered_at).toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

  const performanceLabel = asset.performance_type
    ? `${asset.performance_type}${asset.performance_genre ? ` (${asset.performance_genre})` : ""}`
    : "—";

  const extraRows = [
    asset.owner_name ? `
        <tr>
          <td class="label">소유자</td>
          <td class="value">${asset.owner_name}</td>
        </tr>` : "",
    asset.performance_type ? `
        <tr>
          <td class="label">퍼포먼스</td>
          <td class="value">${performanceLabel}</td>
        </tr>` : "",
    asset.content_type === "character" && asset.character_name ? `
        <tr>
          <td class="label">캐릭터명</td>
          <td class="value">${asset.character_name}</td>
        </tr>` : "",
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BIO-IP 라이선스 인증서</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .cert {
      background: #fff;
      width: 210mm;
      min-height: 297mm;
      padding: 60px 70px;
      border: 1px solid #ddd;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .header {
      text-align: center;
      border-bottom: 3px double #111;
      padding-bottom: 32px;
      margin-bottom: 40px;
    }
    .platform {
      font-size: 11px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 16px;
    }
    .title-ko {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #111;
      margin-bottom: 6px;
    }
    .title-en {
      font-size: 14px;
      color: #555;
      letter-spacing: 1px;
    }
    .seal {
      width: 72px;
      height: 72px;
      border: 3px solid #111;
      border-radius: 50%;
      margin: 24px auto 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #111;
      text-align: center;
      line-height: 1.3;
    }
    .body { flex: 1; }
    .intro {
      font-size: 13px;
      color: #333;
      line-height: 1.8;
      text-align: center;
      margin-bottom: 48px;
      padding: 20px 24px;
      background: #fafafa;
      border-left: 4px solid #111;
    }
    .fields { width: 100%; border-collapse: collapse; }
    .fields tr { border-bottom: 1px solid #eee; }
    .fields td {
      padding: 16px 12px;
      font-size: 13px;
    }
    .fields .label {
      color: #777;
      font-weight: 600;
      width: 160px;
      white-space: nowrap;
    }
    .fields .value {
      color: #111;
      font-weight: 500;
    }
    .fields .mono {
      font-family: "Courier New", monospace;
      font-size: 12px;
      color: #333;
      word-break: break-all;
    }
    .footer {
      margin-top: 60px;
      border-top: 1px solid #ccc;
      padding-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left { font-size: 11px; color: #aaa; line-height: 1.7; }
    .footer-right { text-align: right; font-size: 12px; color: #333; }
    .footer-right .issued-label { color: #888; font-size: 11px; }
    @media print {
      body { background: #fff; padding: 0; }
      .cert { border: none; box-shadow: none; width: 100%; min-height: unset; }
    }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  <div class="cert">
    <div class="header">
      <p class="platform">BIO-IP PLAY</p>
      <p class="title-ko">라이선스 인증서</p>
      <p class="title-en">Bio-IP License Certificate</p>
      <div class="seal">BIO<br/>IP</div>
    </div>

    <div class="body">
      <p class="intro">
        본 인증서는 BIO-IP PLAY 플랫폼에 등록된 생체 IP 자산의<br/>
        등록 사실을 증명합니다.
      </p>

      <table class="fields">
        <tr>
          <td class="label">자산명</td>
          <td class="value">${asset.title ?? "—"}</td>
        </tr>
        ${extraRows}
        <tr>
          <td class="label">워터마크 ID</td>
          <td class="value mono">${asset.watermark_id ?? "—"}</td>
        </tr>
        <tr>
          <td class="label">콘텐츠 유형</td>
          <td class="value">${contentTypeLabel}</td>
        </tr>
        <tr>
          <td class="label">등록일</td>
          <td class="value">${registeredAt}</td>
        </tr>
        <tr>
          <td class="label">발급일</td>
          <td class="value">${today}</td>
        </tr>
        <tr>
          <td class="label">발급 플랫폼</td>
          <td class="value">BIO-IP PLAY (bio-ip-play.vercel.app)</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <div class="footer-left">
        bio-ip-play.vercel.app<br/>
        © BIO-IP PLAY. All rights reserved.
      </div>
      <div class="footer-right">
        <p class="issued-label">발급일</p>
        <p>${today}</p>
      </div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) { alert("팝업 차단을 해제해 주세요."); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Asset card ───────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: BioIPAssetRecord;
  onDelete: () => void;
  onUpdate: (updates: Partial<BioIPAssetRecord>) => void;
}

function AssetCard({ asset, onDelete, onUpdate }: AssetCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [editOwnerName, setEditOwnerName] = useState(asset.owner_name ?? "");
  const [editGenre,     setEditGenre]     = useState(asset.performance_genre ?? "");

  const handleDelete = async () => {
    if (!confirm("이 Bio-IP 자산을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try { await deleteBioIPAsset(asset.id, asset.video_url ?? undefined); onDelete(); }
    catch (e) { alert("삭제 실패: " + String(e)); setDeleting(false); }
  };

  const handleEditToggle = async () => {
    if (!editing) {
      setEditOwnerName(asset.owner_name ?? "");
      setEditGenre(asset.performance_genre ?? "");
      setEditing(true);
      return;
    }
    setSaving(true);
    try {
      const owner_name        = editOwnerName.trim() || asset.owner_name || "";
      const performance_genre = editGenre.trim() || null;
      await updateBioIPAsset(asset.id, { owner_name, performance_genre });
      onUpdate({ owner_name, performance_genre });
      setEditing(false);
    } catch (e) {
      alert("수정 실패: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  const statusStyle = STATUS_STYLES[asset.status] ?? STATUS_STYLES["draft"];
  const badgeCls = asset.performance_type ? PERFORMANCE_BADGE[asset.performance_type] : null;
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
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={editOwnerName}
              onChange={(e) => setEditOwnerName(e.target.value)}
              placeholder="소유자 이름"
              className="w-full rounded-lg bg-zinc-800 px-2 py-1 text-base font-bold text-white outline-none ring-1 ring-orange-500"
            />
          ) : (
            <h2 className="truncate text-base font-bold text-white">
              {asset.owner_name || asset.title}
            </h2>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {asset.performance_type && badgeCls && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
                {asset.performance_type}
              </span>
            )}
            {asset.content_type === "character" && asset.character_name && (
              <span className="text-xs italic text-zinc-400">{asset.character_name}</span>
            )}
            {asset.content_type && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                {asset.content_type === "character" ? "🎭 캐릭터" : "🙋 본인"}
              </span>
            )}
          </div>

          {editing ? (
            <input
              value={editGenre}
              onChange={(e) => setEditGenre(e.target.value)}
              placeholder="장르 (선택)"
              className="mt-1.5 w-full rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none ring-1 ring-orange-500"
            />
          ) : (
            asset.performance_genre && (
              <p className="mt-1.5 text-xs text-zinc-500">{asset.performance_genre}</p>
            )
          )}

          {asset.watermark_id && (
            <p className="mt-1 font-mono text-[10px] text-zinc-500">{asset.watermark_id}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle.cls}`}>
            {statusStyle.label}
          </span>
          <button
            onClick={handleEditToggle}
            disabled={saving}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-orange-400 disabled:opacity-40"
            aria-label={editing ? "저장" : "이름/장르 수정"}
            title={editing ? "저장" : "이름/장르 수정"}
          >
            {saving ? <Spinner /> : editing ? (
              <span className="text-xs font-semibold text-orange-400">저장</span>
            ) : (
              <PencilIcon />
            )}
          </button>
        </div>
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
        <div className="flex flex-wrap gap-2">
          {asset.video_url && (
            <a
              href={asset.video_url}
              download
              className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
            >
              다운로드
            </a>
          )}
          <button
            onClick={() => openLicenseCertificate(asset)}
            className="rounded-md bg-orange-700/40 px-2.5 py-1.5 text-orange-300 transition hover:bg-orange-700 hover:text-white"
          >
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
          text={`내 Bio-IP "${asset.owner_name ?? asset.title}"를 등록했어요! #BioIP #블록체인`}
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

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  if (hasFilter) {
    return (
      <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-zinc-400">이 유형의 Bio-IP가 아직 없어요</p>
      </div>
    );
  }
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
        className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 active:scale-95"
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

type FilterValue = "all" | PerformanceType;

export default function MyBioIPPage() {
  const [assets,  setAssets]  = useState<BioIPAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<FilterValue>("all");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // TODO: once login lands, switch this to getBioIPAssets(ownerId).
        // For now "my assets" is whatever this browser has registered,
        // tracked via the my_bio_ip_ids list in localStorage.
        const ids  = readMyAssetIds();
        const data = await getBioIPAssetsByIds(ids);
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

  const performanceCounts = PERFORMANCE_TYPES.map((type) => ({
    type,
    count: assets.filter((a) => a.performance_type === type).length,
  }));

  const filteredAssets = filter === "all"
    ? assets
    : assets.filter((a) => a.performance_type === filter);

  const handleDelete = (id: string) =>
    setAssets((prev) => prev.filter((a) => a.id !== id));

  const handleUpdate = (id: string, updates: Partial<BioIPAssetRecord>) =>
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));

  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      {/* ── Header ── */}
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold tracking-tight">나의 Bio-IP 보관함</h1>
          <p className="mt-1 text-sm text-zinc-400">
            등록된 생체 IP 자산을 관리하고 라이선스 현황을 확인하세요
          </p>

          {/* Stats row */}
          {!loading && (
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-xl border border-orange-700/50 bg-orange-950/30 px-5 py-3">
                <p className="text-xs text-orange-300/80">전체 자산</p>
                <p className="mt-0.5 text-2xl font-bold text-orange-400">{assets.length}</p>
              </div>
              {performanceCounts.map(({ type, count }) => (
                <div key={type} className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
                  <p className="text-xs text-zinc-500">{type}</p>
                  <p className="mt-0.5 text-2xl font-bold text-white">{count}</p>
                </div>
              ))}
            </div>
          )}
          {loading && (
            <div className="mt-5 flex gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 w-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Filter tabs ── */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto">
          {([{ value: "all", label: "전체" }, ...PERFORMANCE_TYPES.map((t) => ({ value: t, label: t }))] as { value: FilterValue; label: string }[]).map(
            ({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === value
                    ? "bg-orange-600 text-white shadow-md"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-zinc-400">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> 불러오는 중…
              </span>
            ) : (
              <>총 <span className="font-semibold text-white">{filteredAssets.length}</span>개 자산</>
            )}
          </p>
          <Link
            href="/challenge"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500"
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
          {!loading && filteredAssets.length === 0 && !error && <EmptyState hasFilter={filter !== "all"} />}
          {!loading && filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onDelete={() => handleDelete(asset.id)}
              onUpdate={(updates) => handleUpdate(asset.id, updates)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
