import Link from "next/link";

// ─── Icons ─────────────────────────────────────────────────────────────────────

function IconBio() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0118 20.25h-1.5M7.5 20.25H6A2.25 2.25 0 013.75 18v-1.5M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
    </svg>
  );
}

function IconVault() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function IconWatermark() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Feature {
  id:          string;
  iconKey:     "bio" | "vault" | "watermark";
  title:       string;
  badge:       string;
  description: string;
  accent:      string;
  badgeClass:  string;
  borderHover: string;
}

interface TechPoint {
  title: string;
  desc:  string;
}

interface Step {
  step:  string;
  title: string;
  desc:  string;
  href:  string;
  cta:   string;
}

// ─── Data (plain objects only — no JSX at module level) ────────────────────────

const FEATURES: Feature[] = [
  {
    id:          "bio",
    iconKey:     "bio",
    title:       "연기 데이터 추출",
    badge:       "3-Layer",
    description: "시각(얼굴 기하·표정), 음성(피치·음색·리듬), 다이내믹스(제스처·모션 템포)를 동시에 캡처해 고유한 바이오 시그니처를 생성합니다.",
    accent:      "from-orange-500 to-orange-600",
    badgeClass:  "bg-orange-900/60 text-orange-300",
    borderHover: "hover:border-orange-700/60",
  },
  {
    id:          "vault",
    iconKey:     "vault",
    title:       "Bio-IP 보관함",
    badge:       "My Bio-IP",
    description: "내가 등록한 Bio-IP를 한곳에서 관리하고 증명서를 발급합니다.",
    accent:      "from-blue-500 to-cyan-600",
    badgeClass:  "bg-blue-900/60 text-blue-300",
    borderHover: "hover:border-blue-700/60",
  },
  {
    id:          "watermark",
    iconKey:     "watermark",
    title:       "워터마크 녹화",
    badge:       "Watermark ID",
    description: "촬영하는 모든 프레임에 HANiplay 마크와 고유 워터마크 ID, 날짜를 합성합니다. 같은 ID가 보관함과 증명서에 기록됩니다.",
    accent:      "from-emerald-500 to-teal-600",
    badgeClass:  "bg-emerald-900/60 text-emerald-300",
    borderHover: "hover:border-emerald-700/60",
  },
];

const TECH_POINTS: TechPoint[] = [
  { title: "4가지 요소",   desc: "초상 · 표정 · 몸짓 · 음성" },
  { title: "호흡 분석",     desc: "4요소 사이의 고유한 리듬과 타이밍을 데이터화" },
  { title: "나만의 시그니처", desc: "내 연기의 고유한 결을 Bio-IP로" },
];

const STEPS: Step[] = [
  {
    step:  "01",
    title: "바이오 캡처",
    desc:  "웹캠과 마이크로 시각·음성·다이내믹스 레이어를 동시 녹화합니다.",
    href:  "/challenge",
    cta:   "캡처 시작",
  },
  {
    step:  "02",
    title: "Bio-IP 등록",
    desc:  "소유자 이름과 퍼포먼스 정보를 입력하면 워터마크 ID와 함께 보관함에 등록됩니다.",
    href:  "/my-bio-ip",
    cta:   "보관함 보기",
  },
  {
    step:  "03",
    title: "증명서 발급",
    desc:  "보관함에서 등록 증명서를 발급하고 SNS로 공유합니다.",
    href:  "/my-bio-ip",
    cta:   "보관함 보기",
  },
];

// ─── Icon resolver (keeps JSX inside the component render tree) ────────────────

function FeatureIcon({ iconKey }: { iconKey: Feature["iconKey"] }) {
  if (iconKey === "bio")      return <IconBio />;
  if (iconKey === "vault")     return <IconVault />;
  if (iconKey === "watermark") return <IconWatermark />;
  return null;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Hero ── */}
      <section className="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">

        {/* Background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-[600px] w-[600px] rounded-full bg-orange-600/10 blur-[120px]" />
        </div>

        {/* Dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize:  "32px 32px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-3xl">
          {/* Protocol badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-700/50 bg-orange-950/60 px-4 py-1.5 text-xs font-semibold text-orange-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            HANiplay · Beta
          </span>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-orange-500">PLAY</span> your Bio-IP
          </h1>

          {/* Subtitle */}
          <p className="max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            나의 초상, 표정, 몸짓, 음성 — 당신의 모든 PLAY가 자산이 됩니다
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/challenge"
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 active:scale-95"
            >
              챌린지 시작
              <IconArrowRight />
            </Link>
            <Link
              href="/my-bio-ip"
              className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white active:scale-95"
            >
              내 자산 보기
            </Link>
          </div>
        </div>

      </section>

      {/* ── Core Technology ── */}
      <section className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">
              Technology
            </p>
            <h2 className="text-2xl font-bold sm:text-3xl">
              HANiplay만의 기술
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {(TECH_POINTS ?? []).map((t, i) => (
              <div
                key={t?.title ?? i}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center transition hover:border-orange-700/60"
              >
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-400">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-base font-semibold text-orange-400">
                  {t?.title ?? ""}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {t?.desc ?? ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              핵심 기능
            </p>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Bio-IP의 전 과정을 하나로
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {(FEATURES ?? []).map((feature) => (
              <div
                key={feature?.id ?? ""}
                className={`group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition ${feature?.borderHover ?? ""}`}
              >
                {/* Icon */}
                <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${feature?.accent ?? ""} p-2.5 text-white`}>
                  {feature?.iconKey ? <FeatureIcon iconKey={feature.iconKey} /> : null}
                </div>

                {/* Title + badge */}
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {feature?.title ?? ""}
                  </h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${feature?.badgeClass ?? ""}`}>
                    {feature?.badge ?? ""}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed text-zinc-400">
                  {feature?.description ?? ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-3xl space-y-10">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              사용 흐름
            </p>
            <h2 className="text-2xl font-bold sm:text-3xl">3단계로 시작하세요</h2>
          </div>

          <ol className="relative space-y-0">
            {(STEPS ?? []).map((s, i) => (
              <li key={s?.step ?? i} className="flex gap-5">
                {/* Step indicator + connector */}
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-bold text-orange-400">
                    {s?.step ?? ""}
                  </div>
                  {i < (STEPS?.length ?? 0) - 1 && (
                    <div className="mt-1 w-px flex-1 bg-zinc-800 mb-1" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8 pt-1.5">
                  <h3 className="text-base font-semibold text-white">
                    {s?.title ?? ""}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {s?.desc ?? ""}
                  </p>
                  {s?.href ? (
                    <Link
                      href={s.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 transition hover:text-orange-300"
                    >
                      {s?.cta ?? ""} <IconArrowRight />
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="border-t border-zinc-800 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-orange-800/40 bg-gradient-to-br from-orange-950/60 to-zinc-900 px-8 py-10 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">
            지금 바로 내 연기를 Bio-IP로 등록하세요
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            촬영부터 등록·증명서 발급까지, 내가 직접 관리합니다.
          </p>
          <Link
            href="/challenge"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 active:scale-95"
          >
            챌린지 시작 <IconArrowRight />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-xs text-zinc-600">
        © 2026 HANiplay — PLAY your Bio-IP
      </footer>
    </div>
  );
}
