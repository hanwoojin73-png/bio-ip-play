"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LicenseScope } from "@/types/bio-ip";
import PurchaseModal from "@/components/marketplace/PurchaseModal";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Layer = "visual" | "vocal" | "dynamics";
type SortKey = "latest" | "royalty" | "popular";
type CategoryFilter = "all" | Layer;

interface MarketplaceAsset {
  id: string;
  title: string;
  ownerName: string;
  ownerInitials: string;
  avatarColor: string;
  layers: Layer[];
  royaltyRateBps: number;
  usageCount: number;
  scope: LicenseScope;
  territoryCodes: string[];
  allowedUseCases: string[];
  prohibitedUseCases: string[];
  expiresAt?: string;
  registeredAt: string;
  waveform: number[]; // 0–1 amplitude values
  description: string;
}

// ─── Sample data ───────────────────────────────────────────────────────────────

const ASSETS: MarketplaceAsset[] = [
  {
    id: "mkt-001",
    title: "Han Visual & Vocal Identity v1",
    ownerName: "Han Ujin",
    ownerInitials: "HU",
    avatarColor: "bg-violet-600",
    layers: ["visual", "vocal"],
    royaltyRateBps: 1000,
    usageCount: 248,
    scope: "non_exclusive",
    territoryCodes: ["KR", "US", "JP"],
    allowedUseCases: ["advertising", "entertainment", "education"],
    prohibitedUseCases: ["political", "adult_content"],
    registeredAt: "2026-01-15T09:00:00Z",
    description: "얼굴 기하·표정·음색·피치를 포함한 풀 레이어 바이오 시그니처. 광고·엔터테인먼트 라이선스에 최적화.",
    waveform: [0.3,0.5,0.8,0.6,0.9,0.4,0.7,1.0,0.5,0.8,0.3,0.6,0.9,0.7,0.4,0.8,0.5,0.3,0.7,0.9,0.6,0.4,0.8,0.5,0.7,0.3,0.9,0.6,0.4,0.8],
  },
  {
    id: "mkt-002",
    title: "K-Dance Motion Pack",
    ownerName: "Lee Junho",
    ownerInitials: "LJ",
    avatarColor: "bg-blue-600",
    layers: ["dynamics"],
    royaltyRateBps: 2500,
    usageCount: 89,
    scope: "exclusive",
    territoryCodes: ["KR", "US"],
    allowedUseCases: ["metaverse", "gaming", "animation"],
    prohibitedUseCases: ["surveillance", "political"],
    expiresAt: "2027-06-30T23:59:59Z",
    registeredAt: "2026-03-02T11:30:00Z",
    description: "K-pop 안무 기반 제스처 어휘 및 모션 템포 데이터. 메타버스 아바타·게임 캐릭터 모션 라이선스.",
    waveform: [0.9,0.7,0.5,0.9,0.3,0.8,0.6,0.4,1.0,0.7,0.5,0.9,0.3,0.6,0.8,0.4,0.9,0.7,0.5,0.3,0.8,0.6,1.0,0.4,0.7,0.9,0.5,0.3,0.8,0.6],
  },
  {
    id: "mkt-003",
    title: "Studio Voice AI Profile",
    ownerName: "Park Sora",
    ownerInitials: "PS",
    avatarColor: "bg-emerald-600",
    layers: ["vocal"],
    royaltyRateBps: 500,
    usageCount: 512,
    scope: "non_exclusive",
    territoryCodes: ["KR", "US", "GB", "JP"],
    allowedUseCases: ["voiceover", "audiobook", "podcast"],
    prohibitedUseCases: ["deepfake", "impersonation"],
    registeredAt: "2026-02-10T08:00:00Z",
    description: "스튜디오 품질 음성 프로파일. 피치 정확도·호흡 패턴·억양이 최적화된 한국어·영어 이중 언어 보이스.",
    waveform: [0.4,0.6,0.5,0.7,0.8,0.6,0.9,0.7,0.5,0.8,0.6,0.4,0.7,0.9,0.5,0.8,0.6,0.4,0.7,0.5,0.9,0.6,0.8,0.4,0.7,0.5,0.6,0.9,0.4,0.7],
  },
  {
    id: "mkt-004",
    title: "Seoul Street Style Visual",
    ownerName: "Choi Minjae",
    ownerInitials: "CM",
    avatarColor: "bg-amber-600",
    layers: ["visual"],
    royaltyRateBps: 800,
    usageCount: 167,
    scope: "non_exclusive",
    territoryCodes: ["KR", "JP"],
    allowedUseCases: ["fashion", "advertising", "editorial"],
    prohibitedUseCases: ["political", "adult_content"],
    registeredAt: "2026-04-18T13:00:00Z",
    description: "서울 스트리트 패션 스타일 지문 포함 시각 레이어. 패션·광고·에디토리얼 라이선스에 특화.",
    waveform: [0.6,0.4,0.8,0.5,0.7,0.9,0.3,0.6,0.8,0.5,0.7,0.4,0.9,0.6,0.3,0.8,0.5,0.7,0.4,0.9,0.6,0.8,0.3,0.5,0.7,0.4,0.9,0.6,0.8,0.5],
  },
  {
    id: "mkt-005",
    title: "Martial Arts Dynamics",
    ownerName: "Kim Taehun",
    ownerInitials: "KT",
    avatarColor: "bg-red-600",
    layers: ["dynamics", "visual"],
    royaltyRateBps: 1500,
    usageCount: 203,
    scope: "non_exclusive",
    territoryCodes: ["KR", "US", "CN", "JP"],
    allowedUseCases: ["gaming", "film", "simulation"],
    prohibitedUseCases: ["surveillance"],
    registeredAt: "2026-05-05T10:00:00Z",
    description: "태권도·합기도 기반 무술 동작 데이터. 정밀한 관절 각도 및 충격 타이밍이 포함된 전투 동작 라이선스.",
    waveform: [1.0,0.8,0.6,1.0,0.7,0.5,0.9,0.8,0.6,1.0,0.4,0.7,0.9,0.5,0.8,0.6,1.0,0.7,0.4,0.9,0.6,0.8,0.5,1.0,0.7,0.4,0.9,0.6,0.8,0.5],
  },
  {
    id: "mkt-006",
    title: "ASMR Vocal Profile",
    ownerName: "Yoon Seoyeon",
    ownerInitials: "YS",
    avatarColor: "bg-pink-600",
    layers: ["vocal"],
    royaltyRateBps: 300,
    usageCount: 31,
    scope: "personal_only",
    territoryCodes: ["KR"],
    allowedUseCases: ["asmr", "meditation", "wellness"],
    prohibitedUseCases: ["deepfake", "advertising", "political"],
    registeredAt: "2026-06-20T16:00:00Z",
    description: "ASMR 전문 음성 프로파일. 극도로 낮은 호흡 노이즈와 세밀한 마이크로 리듬을 포함한 웰니스 전용 보이스.",
    waveform: [0.2,0.3,0.2,0.4,0.3,0.5,0.2,0.4,0.3,0.2,0.5,0.3,0.4,0.2,0.3,0.5,0.2,0.4,0.3,0.5,0.2,0.3,0.4,0.2,0.5,0.3,0.2,0.4,0.3,0.2],
  },
];

// ─── Constants ─────────────────────────────────────────────────────────────────

const LAYER_META: Record<Layer, { label: string; className: string }> = {
  visual:   { label: "시각",      className: "bg-violet-900/60 text-violet-300" },
  vocal:    { label: "음성",      className: "bg-blue-900/60 text-blue-300" },
  dynamics: { label: "다이내믹스", className: "bg-emerald-900/60 text-emerald-300" },
};

const SCOPE_LABEL: Record<LicenseScope, string> = {
  exclusive:     "독점",
  non_exclusive: "비독점",
  personal_only: "개인 전용",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(1);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Waveform SVG ──────────────────────────────────────────────────────────────

function Waveform({ data, height = 48, color = "#7c3aed" }: { data: number[]; height?: number; color?: string }) {
  const barW = 3;
  const gap  = 2;
  const total = data.length;
  const width = total * (barW + gap) - gap;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {data.map((amp, i) => {
        const barH = Math.max(2, amp * height);
        const x    = i * (barW + gap);
        const y    = (height - barH) / 2;
        return (
          <rect
            key={i}
            x={x} y={y}
            width={barW} height={barH}
            rx={1.5}
            fill={color}
            opacity={0.7 + amp * 0.3}
          />
        );
      })}
    </svg>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ initials, colorClass, size = "md" }: { initials: string; colorClass: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";
  return (
    <div className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${sz} ${colorClass}`}>
      {initials}
    </div>
  );
}

// ─── Layer tag ─────────────────────────────────────────────────────────────────

function LayerTag({ layer }: { layer: Layer }) {
  const { label, className } = LAYER_META[layer];
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ asset, onClose, onPurchase }: { asset: MarketplaceAsset; onClose: () => void; onPurchase: (a: MarketplaceAsset) => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
          aria-label="닫기"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-5 p-6">
          {/* Header */}
          <div className="flex items-start gap-3 pr-8">
            <Avatar initials={asset.ownerInitials} colorClass={asset.avatarColor} size="lg" />
            <div>
              <h2 className="text-base font-bold text-white leading-snug">{asset.title}</h2>
              <p className="text-sm text-zinc-400">{asset.ownerName}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {asset.layers.map((l) => <LayerTag key={l} layer={l} />)}
              </div>
            </div>
          </div>

          {/* Waveform preview */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">바이오 시그니처 파형</p>
            <Waveform data={asset.waveform} height={64} color="#a78bfa" />
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-zinc-400">{asset.description}</p>

          {/* License terms */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {[
              { label: "라이선스 범위",  value: SCOPE_LABEL[asset.scope] },
              { label: "로열티 비율",    value: `${bpsToPercent(asset.royaltyRateBps)}%`, accent: "text-emerald-400 font-mono font-semibold" },
              { label: "적용 지역",      value: asset.territoryCodes.join(" · ") },
              { label: "등록일",         value: formatDate(asset.registeredAt) },
              ...(asset.expiresAt ? [{ label: "만료일", value: formatDate(asset.expiresAt), accent: "text-amber-400" }] : []),
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-zinc-500">{label}</span>
                <span className={accent ?? "text-zinc-200"}>{value}</span>
              </div>
            ))}
          </div>

          {/* Use cases */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">허용 / 금지 사용처</p>
            <div className="flex flex-wrap gap-1.5">
              {asset.allowedUseCases.map((u) => (
                <span key={u} className="rounded-md bg-blue-950/60 px-2 py-0.5 text-xs text-blue-300">{u}</span>
              ))}
              {asset.prohibitedUseCases.map((u) => (
                <span key={u} className="rounded-md bg-red-950/60 px-2 py-0.5 text-xs text-red-400 line-through">{u}</span>
              ))}
            </div>
          </div>

          {/* Purchase CTA */}
          <button
            onClick={() => { onPurchase(asset); onClose(); }}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95"
          >
            라이선스 구매 · {bpsToPercent(asset.royaltyRateBps)}% 로열티
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Asset card ────────────────────────────────────────────────────────────────

function AssetCard({ asset, onClick }: { asset: MarketplaceAsset; onClick: () => void }) {
  return (
    <article
      onClick={onClick}
      className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600 hover:bg-zinc-800/60"
    >
      {/* Owner row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar initials={asset.ownerInitials} colorClass={asset.avatarColor} size="sm" />
          <span className="truncate text-xs text-zinc-400">{asset.ownerName}</span>
        </div>
        <span className="flex-shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
          {SCOPE_LABEL[asset.scope]}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold leading-snug text-white group-hover:text-violet-300 transition-colors line-clamp-2">
        {asset.title}
      </h3>

      {/* Layer tags */}
      <div className="flex flex-wrap gap-1">
        {asset.layers.map((l) => <LayerTag key={l} layer={l} />)}
      </div>

      {/* Mini waveform */}
      <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
        <Waveform data={asset.waveform} height={36} color="#7c3aed" />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-600">로열티</p>
          <p className="font-mono text-lg font-bold text-emerald-400">
            {bpsToPercent(asset.royaltyRateBps)}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-600">사용 횟수</p>
          <p className="text-sm font-semibold text-zinc-300">{asset.usageCount.toLocaleString()}회</p>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="w-full rounded-xl bg-violet-700/60 py-2 text-xs font-semibold text-violet-200 transition group-hover:bg-violet-600 group-hover:text-white"
      >
        라이선스 구매
      </button>
    </article>
  );
}

// ─── Search icon ───────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
    </svg>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort,     setSort]     = useState<SortKey>("latest");
  const [selected,  setSelected]  = useState<MarketplaceAsset | null>(null);
  const [purchasing, setPurchasing] = useState<MarketplaceAsset | null>(null);

  const filtered = useMemo(() => {
    let list = ASSETS.filter((a) => {
      const matchQuery    = query.trim() === "" || a.title.toLowerCase().includes(query.toLowerCase()) || a.ownerName.toLowerCase().includes(query.toLowerCase());
      const matchCategory = category === "all" || a.layers.includes(category);
      return matchQuery && matchCategory;
    });

    if (sort === "latest")  list = [...list].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
    if (sort === "royalty")  list = [...list].sort((a, b) => b.royaltyRateBps - a.royaltyRateBps);
    if (sort === "popular") list = [...list].sort((a, b) => b.usageCount - a.usageCount);

    return list;
  }, [query, category, sort]);

  const CATEGORIES: { key: CategoryFilter; label: string }[] = [
    { key: "all",      label: "전체" },
    { key: "visual",   label: "시각" },
    { key: "vocal",    label: "음성" },
    { key: "dynamics", label: "다이내믹스" },
  ];

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "latest",  label: "최신순" },
    { key: "royalty", label: "로열티순" },
    { key: "popular", label: "인기순" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-sm text-zinc-400">
            검증된 크리에이터의 Bio-IP 자산을 발견하고 라이선스를 구매하세요
          </p>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div className="sticky top-14 z-40 border-b border-zinc-800 bg-zinc-950/90 px-6 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2">
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="이름 또는 소유자 검색…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Category pills */}
            <div className="flex gap-1">
              {CATEGORIES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    category === key
                      ? "bg-violet-600 text-white"
                      : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort select */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-3 pr-8 text-xs text-zinc-300 outline-none transition focus:border-violet-600 appearance-none cursor-pointer"
            >
              {SORTS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-sm text-zinc-500">검색 결과가 없습니다</p>
            <button
              onClick={() => { setQuery(""); setCategory("all"); }}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <>
            <p className="mb-5 text-xs text-zinc-600">
              {filtered.length}개 자산
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => setSelected(asset)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selected && (
        <DetailModal
          asset={selected}
          onClose={() => setSelected(null)}
          onPurchase={(a) => setPurchasing(a)}
        />
      )}

      {/* ── Purchase Modal ── */}
      {purchasing && (
        <PurchaseModal
          asset={purchasing}
          onClose={() => setPurchasing(null)}
        />
      )}
    </main>
  );
}
