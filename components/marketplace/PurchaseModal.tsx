"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LicenseScope } from "@/types/bio-ip";

// ─── Types ────────────────────────────────────────────────────────────────────

type Layer = "visual" | "vocal" | "dynamics";
type PaymentMethod = "usdc" | "card";
type Step = "terms" | "payment" | "confirm" | "processing" | "success";

export interface PurchaseAsset {
  id: string;
  title: string;
  ownerName: string;
  ownerInitials: string;
  avatarColor: string;
  layers: Layer[];
  royaltyRateBps: number;
  scope: LicenseScope;
  territoryCodes: string[];
  allowedUseCases: string[];
  prohibitedUseCases: string[];
  expiresAt?: string;
  waveform: number[];
}

interface PurchaseModalProps {
  asset: PurchaseAsset;
  onClose: () => void;
  onSuccess?: (licenseId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_META: Record<Layer, { label: string; cls: string }> = {
  visual:   { label: "시각",      cls: "bg-violet-900/60 text-violet-300" },
  vocal:    { label: "음성",      cls: "bg-blue-900/60 text-blue-300" },
  dynamics: { label: "다이내믹스", cls: "bg-emerald-900/60 text-emerald-300" },
};

const SCOPE_LABEL: Record<LicenseScope, string> = {
  exclusive:     "독점 라이선스",
  non_exclusive: "비독점 라이선스",
  personal_only: "개인 전용",
};

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "terms",   label: "약관 확인" },
  { key: "payment", label: "결제 수단" },
  { key: "confirm", label: "구매 확인" },
];

// ─── Price helpers ────────────────────────────────────────────────────────────

function calcUSDC(bps: number) {
  return Math.max(5, Math.round(bps / 50));
}

function calcKRW(bps: number) {
  return (calcUSDC(bps) * 1380).toLocaleString("ko-KR");
}

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(1);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function generateLicenseId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "LIC-";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) id += "-";
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ─── Small shared pieces ──────────────────────────────────────────────────────

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CheckCircle({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function Avatar({
  initials, colorClass,
}: {
  initials: string; colorClass: string;
}) {
  return (
    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colorClass}`}>
      {initials}
    </div>
  );
}

function Waveform({ data }: { data: number[] }) {
  const barW = 3, gap = 2;
  const width = data.length * (barW + gap) - gap;
  return (
    <svg width={width} height={40} viewBox={`0 0 ${width} 40`} className="w-full">
      {data.map((amp, i) => {
        const barH = Math.max(2, amp * 40);
        return (
          <rect
            key={i}
            x={i * (barW + gap)} y={(40 - barH) / 2}
            width={barW} height={barH} rx={1.5}
            fill="#a78bfa" opacity={0.5 + amp * 0.5}
          />
        );
      })}
    </svg>
  );
}

// ─── Step 1: Terms ────────────────────────────────────────────────────────────

function StepTerms({
  asset, onNext,
}: {
  asset: PurchaseAsset;
  onNext: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  const rows = [
    { label: "라이선스 범위", value: SCOPE_LABEL[asset.scope] },
    { label: "로열티 비율",   value: `${bpsToPercent(asset.royaltyRateBps)}%`, accent: "font-mono font-semibold text-emerald-400" },
    { label: "적용 지역",     value: asset.territoryCodes.join(" · ") },
    ...(asset.expiresAt ? [{ label: "라이선스 만료", value: formatDate(asset.expiresAt), accent: "text-amber-400" }] : [
      { label: "라이선스 만료", value: "무기한" },
    ]),
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Asset header */}
      <div className="flex items-start gap-3">
        <Avatar initials={asset.ownerInitials} colorClass={asset.avatarColor} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{asset.title}</p>
          <p className="text-xs text-zinc-400">{asset.ownerName}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {asset.layers.map((l) => (
              <span key={l} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${LAYER_META[l].cls}`}>
                {LAYER_META[l].label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">바이오 시그니처 파형</p>
        <Waveform data={asset.waveform} />
      </div>

      {/* License terms table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 divide-y divide-zinc-800">
        {rows.map(({ label, value, accent }) => (
          <div key={label} className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 text-sm">
            <span className="text-zinc-500">{label}</span>
            <span className={accent ?? "text-zinc-200"}>{value}</span>
          </div>
        ))}
      </div>

      {/* Use cases */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">허용 사용처</p>
        <div className="flex flex-wrap gap-1.5">
          {asset.allowedUseCases.map((u) => (
            <span key={u} className="rounded-md bg-blue-950/60 px-2 py-0.5 text-xs text-blue-300">{u}</span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">금지 사용처</p>
        <div className="flex flex-wrap gap-1.5">
          {asset.prohibitedUseCases.map((u) => (
            <span key={u} className="rounded-md bg-red-950/60 px-2 py-0.5 text-xs text-red-400 line-through">{u}</span>
          ))}
        </div>
      </div>

      {/* Agreement checkbox */}
      <label className="flex cursor-pointer select-none items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 transition hover:border-violet-700/60">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-violet-500 cursor-pointer"
        />
        <span className="text-sm leading-relaxed text-zinc-300">
          위 라이선스 조건을 모두 읽었으며, 사용 범위와 로열티 지급 의무에 동의합니다.
          <span className="block mt-0.5 text-xs text-zinc-500">
            구매 후 라이선스는 블록체인에 기록되며 취소할 수 없습니다.
          </span>
        </span>
      </label>

      <button
        onClick={onNext}
        disabled={!agreed}
        className={`w-full rounded-xl py-3 text-sm font-semibold text-white transition active:scale-[0.98] ${
          agreed
            ? "bg-violet-600 hover:bg-violet-500"
            : "cursor-not-allowed bg-zinc-800 text-zinc-600"
        }`}
      >
        동의하고 결제 수단 선택
      </button>
    </div>
  );
}

// ─── Step 2: Payment ──────────────────────────────────────────────────────────

function StepPayment({
  asset, method, onSelect, onNext, onBack,
}: {
  asset: PurchaseAsset;
  method: PaymentMethod | null;
  onSelect: (m: PaymentMethod) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const usdc = calcUSDC(asset.royaltyRateBps);
  const krw  = calcKRW(asset.royaltyRateBps);

  const options: { key: PaymentMethod; icon: React.ReactNode; title: string; desc: string; price: string }[] = [
    {
      key: "usdc",
      price: `${usdc} USDC`,
      title: "USDC (크립토 지갑)",
      desc: "Web3 지갑 연결 후 온체인 결제. 즉시 라이선스가 발급됩니다.",
      icon: (
        <svg className="h-7 w-7" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#2775CA" />
          <path
            d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm-.5 15.5v-1.25c-2.071-.248-3.5-1.504-3.5-3.25h1.75c0 .997.856 1.75 1.75 1.75s1.75-.753 1.75-1.75c0-1.007-.783-1.64-2.5-2.25C12.933 13.974 12 12.896 12 11.5c0-1.653 1.357-2.9 3.5-3.25V7h1v1.25c2.071.25 3.5 1.597 3.5 3.25h-1.75c0-.997-.856-1.75-1.75-1.75s-1.75.753-1.75 1.75c0 .947.776 1.548 2.5 2.25 1.821.734 2.75 1.796 2.75 3.25 0 1.703-1.357 2.9-3.5 3.25V21.5h-1z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      key: "card",
      price: `₩${krw}`,
      title: "신용·체크카드",
      desc: "국내외 Visa / Mastercard 사용 가능. 즉시 라이선스가 발급됩니다.",
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-white">결제 수단을 선택하세요</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {asset.title} · {SCOPE_LABEL[asset.scope]}
        </p>
      </div>

      <div className="space-y-3">
        {options.map(({ key, icon, title, desc, price }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full rounded-xl border px-4 py-4 text-left transition ${
              method === key
                ? "border-violet-500 bg-violet-950/40 ring-1 ring-violet-500/40"
                : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Radio dot */}
              <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                method === key ? "border-violet-500 bg-violet-600" : "border-zinc-600"
              }`}>
                {method === key && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>

              {/* Icon */}
              <div className={`flex-shrink-0 ${method === key ? "text-violet-300" : "text-zinc-400"}`}>
                {icon}
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${method === key ? "text-white" : "text-zinc-300"}`}>
                  {title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>

              {/* Price */}
              <p className={`flex-shrink-0 font-mono text-base font-bold ${
                method === key ? "text-emerald-400" : "text-zinc-500"
              }`}>
                {price}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* USDC wallet notice */}
      {method === "usdc" && (
        <div className="rounded-xl border border-blue-800/60 bg-blue-950/20 px-4 py-3 text-xs leading-relaxed text-blue-300">
          <p className="font-semibold">지갑 연결 안내</p>
          <p className="mt-1 text-blue-400">
            다음 단계에서 MetaMask 또는 WalletConnect로 서명 후 결제가 진행됩니다.
            Ethereum Mainnet 또는 Polygon에서 USDC를 보유하고 있어야 합니다.
          </p>
        </div>
      )}

      {method === "card" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500">
          카드 정보는 PCI-DSS 준수 결제 대행사를 통해 처리되며, 당사 서버에 저장되지 않습니다.
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white active:scale-[0.98]"
        >
          이전
        </button>
        <button
          onClick={onNext}
          disabled={!method}
          className={`flex-[2] rounded-xl py-3 text-sm font-semibold text-white transition active:scale-[0.98] ${
            method
              ? "bg-violet-600 hover:bg-violet-500"
              : "cursor-not-allowed bg-zinc-800 text-zinc-600"
          }`}
        >
          구매 확인으로 이동
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Confirm ──────────────────────────────────────────────────────────

function StepConfirm({
  asset, method, onConfirm, onBack, isProcessing,
}: {
  asset: PurchaseAsset;
  method: PaymentMethod;
  onConfirm: () => void;
  onBack: () => void;
  isProcessing: boolean;
}) {
  const usdc = calcUSDC(asset.royaltyRateBps);
  const krw  = calcKRW(asset.royaltyRateBps);

  const summary = [
    { label: "자산",         value: asset.title },
    { label: "라이선스",     value: SCOPE_LABEL[asset.scope] },
    { label: "로열티 비율",  value: `${bpsToPercent(asset.royaltyRateBps)}%`, accent: "font-mono text-emerald-400" },
    { label: "결제 수단",    value: method === "usdc" ? "USDC (크립토)" : "신용카드" },
    { label: "결제 금액",    value: method === "usdc" ? `${usdc} USDC` : `₩${krw}`, accent: "font-mono font-bold text-white" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-white">구매 내용을 최종 확인하세요</p>
        <p className="mt-0.5 text-xs text-zinc-500">확인 후 결제가 진행되며 취소할 수 없습니다.</p>
      </div>

      {/* Summary card */}
      <div className="overflow-hidden rounded-xl border border-zinc-700 divide-y divide-zinc-800">
        {summary.map(({ label, value, accent }) => (
          <div key={label} className="flex items-start justify-between bg-zinc-900 px-4 py-3 text-sm">
            <span className="flex-shrink-0 text-zinc-500">{label}</span>
            <span className={`ml-4 text-right ${accent ?? "text-zinc-200"}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Card form — only shown when method is card */}
      {method === "card" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">카드 정보</p>
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="카드 번호  0000 0000 0000 0000"
                maxLength={19}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                  e.target.value = raw.replace(/(.{4})/g, "$1 ").trim();
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="MM / YY"
                maxLength={5}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                  e.target.value = raw.length > 2 ? `${raw.slice(0,2)} / ${raw.slice(2)}` : raw;
                }}
              />
              <input
                type="password"
                placeholder="CVV"
                maxLength={4}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* USDC signing note */}
      {method === "usdc" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-900/60 bg-blue-950/20 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-xs leading-relaxed text-blue-300">
            구매 확인 버튼을 누르면 지갑 서명 요청이 표시됩니다.
            트랜잭션이 온체인에 기록된 후 라이선스가 발급됩니다.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-40 active:scale-[0.98]"
        >
          이전
        </button>
        <button
          onClick={onConfirm}
          disabled={isProcessing}
          className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 active:scale-[0.98]"
        >
          {isProcessing ? (
            <><Spinner className="h-4 w-4 text-emerald-200" /> 처리 중…</>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              구매 확정
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Processing overlay ───────────────────────────────────────────────────────

function StepProcessing({ method }: { method: PaymentMethod }) {
  const steps =
    method === "usdc"
      ? ["지갑 서명 확인 중…", "트랜잭션 브로드캐스트…", "온체인 컨펌 대기…", "라이선스 발급 중…"]
      : ["결제 승인 요청 중…", "카드사 인증 중…", "결제 완료…", "라이선스 발급 중…"];

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCurrent((p) => Math.min(p + 1, steps.length - 1)), 700);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Animated rings */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 animate-ping rounded-full border-2 border-violet-500/30" />
        <div className="absolute h-16 w-16 animate-pulse rounded-full border border-violet-600/40" />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-700/40">
          <Spinner className="h-7 w-7 text-violet-300" />
        </div>
      </div>

      <div className="w-full max-w-xs space-y-2.5">
        {steps.map((label, i) => (
          <div key={label} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
            i < current  ? "opacity-50" :
            i === current ? "bg-violet-950/40 border border-violet-800/60" : "opacity-20"
          }`}>
            <span className="flex-shrink-0">
              {i < current
                ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                : i === current
                  ? <Spinner className="h-4 w-4 text-violet-400" />
                  : <div className="h-4 w-4 rounded-full border border-zinc-700" />
              }
            </span>
            <span className={`text-sm ${i === current ? "text-violet-200 font-medium" : "text-zinc-500"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-600 text-center">
        창을 닫지 마세요. 자동으로 완료됩니다.
      </p>
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function StepSuccess({
  asset, licenseId, method, onClose,
}: {
  asset: PurchaseAsset;
  licenseId: string;
  method: PaymentMethod;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(licenseId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col items-center gap-6 py-2 text-center">
      {/* Success icon */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full bg-emerald-500/10 animate-pulse" />
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 border border-emerald-500/30">
          <CheckCircle className="h-9 w-9 text-emerald-400" />
        </div>
      </div>

      {/* Title */}
      <div>
        <h3 className="text-xl font-bold text-white">라이선스 발급 완료!</h3>
        <p className="mt-1.5 text-sm text-zinc-400">
          {asset.title}에 대한 라이선스가 성공적으로 발급되었습니다.
        </p>
      </div>

      {/* License ID card */}
      <div className="w-full rounded-xl border border-emerald-800/60 bg-emerald-950/20 px-5 py-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
          라이선스 ID
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-lg font-bold tracking-widest text-emerald-300">{licenseId}</span>
          <button
            onClick={copyId}
            title="복사"
            className="rounded-md p-1 text-emerald-600 transition hover:bg-emerald-900/40 hover:text-emerald-300"
          >
            {copied
              ? <CheckCircle className="h-4 w-4 text-emerald-400" />
              : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              )
            }
          </button>
        </div>
        {copied && <p className="mt-1 text-xs text-emerald-500">복사됨!</p>}
      </div>

      {/* Detail list */}
      <div className="w-full overflow-hidden rounded-xl border border-zinc-800 divide-y divide-zinc-800 text-sm">
        {[
          { label: "자산",     value: asset.title },
          { label: "소유자",   value: asset.ownerName },
          { label: "결제",     value: method === "usdc" ? `${calcUSDC(asset.royaltyRateBps)} USDC` : `₩${calcKRW(asset.royaltyRateBps)}` },
          { label: "등록 여부", value: "블록체인 기록 완료", accent: "text-emerald-400" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="flex justify-between bg-zinc-900 px-4 py-2.5">
            <span className="text-zinc-500">{label}</span>
            <span className={accent ?? "text-zinc-200"}>{value}</span>
          </div>
        ))}
      </div>

      {/* Info note */}
      <p className="text-xs leading-relaxed text-zinc-600">
        라이선스는 My Bio-IP 페이지에서 언제든지 확인할 수 있습니다.
        {method === "usdc" && " 트랜잭션 해시는 이메일로 발송됩니다."}
      </p>

      {/* CTA */}
      <div className="flex w-full flex-col gap-2.5">
        <a
          href="/my-bio-ip"
          className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white text-center transition hover:bg-violet-500 active:scale-[0.98]"
        >
          My Bio-IP에서 확인하기
        </a>
        <button
          onClick={onClose}
          className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white active:scale-[0.98]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  const stepIndex = ["terms", "payment", "confirm"].indexOf(step);
  if (stepIndex === -1) return null;

  return (
    <div className="flex items-center gap-2 px-1">
      {STEP_LABELS.map(({ key, label }, i) => {
        const isActive = i === stepIndex;
        const isDone   = i < stepIndex;
        return (
          <div key={key} className="flex flex-1 flex-col items-center gap-1">
            <div className={`h-1 w-full rounded-full transition-all duration-300 ${
              isDone   ? "bg-emerald-500" :
              isActive ? "bg-violet-500" : "bg-zinc-800"
            }`} />
            <span className={`text-[10px] font-medium transition-colors ${
              isDone   ? "text-emerald-500" :
              isActive ? "text-violet-400" : "text-zinc-600"
            }`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export default function PurchaseModal({ asset, onClose, onSuccess }: PurchaseModalProps) {
  const [step,       setStep]       = useState<Step>("terms");
  const [method,     setMethod]     = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [licenseId,  setLicenseId]  = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);
  const canClose    = step !== "processing";

  // ESC handler
  useEffect(() => {
    if (!canClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canClose, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleConfirm = useCallback(async () => {
    setProcessing(true);
    setStep("processing");
    // Simulate async processing (replace with actual API call)
    await new Promise((r) => setTimeout(r, 3200));
    const id = generateLicenseId();
    setLicenseId(id);
    setStep("success");
    setProcessing(false);
    onSuccess?.(id);
  }, [onSuccess]);

  const title =
    step === "terms"      ? "라이선스 조건 확인"  :
    step === "payment"    ? "결제 수단 선택"       :
    step === "confirm"    ? "구매 최종 확인"       :
    step === "processing" ? "결제 진행 중"         : "";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      onClick={(e) => { if (canClose && e.target === backdropRef.current) onClose(); }}
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        {/* Modal header */}
        {step !== "success" && (
          <div className="flex-shrink-0 border-b border-zinc-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">{title}</h2>
              {canClose && (
                <button
                  onClick={onClose}
                  aria-label="닫기"
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {(step === "terms" || step === "payment" || step === "confirm") && (
              <div className="mt-3">
                <ProgressBar step={step} />
              </div>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "terms" && (
            <StepTerms asset={asset} onNext={() => setStep("payment")} />
          )}
          {step === "payment" && (
            <StepPayment
              asset={asset}
              method={method}
              onSelect={setMethod}
              onNext={() => setStep("confirm")}
              onBack={() => setStep("terms")}
            />
          )}
          {step === "confirm" && method && (
            <StepConfirm
              asset={asset}
              method={method}
              onConfirm={handleConfirm}
              onBack={() => setStep("payment")}
              isProcessing={processing}
            />
          )}
          {step === "processing" && method && (
            <StepProcessing method={method} />
          )}
          {step === "success" && method && (
            <StepSuccess
              asset={asset}
              licenseId={licenseId}
              method={method}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
