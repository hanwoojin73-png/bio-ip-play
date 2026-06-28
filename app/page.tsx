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

function IconChain() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function IconContract() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
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
  iconKey:     "bio" | "chain" | "contract";
  title:       string;
  badge:       string;
  description: string;
  accent:      string;
  badgeClass:  string;
  borderHover: string;
}

interface Stat {
  value: string;
  unit:  string;
  label: string;
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
    title:       "생체 신호 추출",
    badge:       "3-Layer",
    description: "시각(얼굴 기하·표정), 음성(피치·음색·리듬), 다이내믹스(제스처·모션 템포)를 동시에 캡처해 고유한 바이오 시그니처를 생성합니다.",
    accent:      "from-violet-500 to-purple-600",
    badgeClass:  "bg-violet-900/60 text-violet-300",
    borderHover: "hover:border-violet-700/60",
  },
  {
    id:          "chain",
    iconKey:     "chain",
    title:       "블록체인 자산화",
    badge:       "On-Chain",
    description: "생체 시그니처를 NFT로 발행해 온체인에 소유권을 등록합니다. IPFS 메타데이터로 변조 불가능한 원본 증명을 보장합니다.",
    accent:      "from-blue-500 to-cyan-600",
    badgeClass:  "bg-blue-900/60 text-blue-300",
    borderHover: "hover:border-blue-700/60",
  },
  {
    id:          "contract",
    iconKey:     "contract",
    title:       "스마트 계약 로열티",
    badge:       "Automated",
    description: "라이선스 조건·허용 사용처·지역·만료일을 스마트 계약에 인코딩. 사용이 발생하는 순간 로열티가 자동으로 정산됩니다.",
    accent:      "from-emerald-500 to-teal-600",
    badgeClass:  "bg-emerald-900/60 text-emerald-300",
    borderHover: "hover:border-emerald-700/60",
  },
];

const STATS: Stat[] = [
  { value: "3",    unit: "레이어",  label: "생체 신호 추출" },
  { value: "100%", unit: "온체인",  label: "소유권 등록" },
  { value: "0",    unit: "중개자",  label: "직접 로열티 정산" },
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
    title: "자산 등록",
    desc:  "바이오 시그니처를 검증하고 라이선스 조건을 설정한 뒤 NFT로 발행합니다.",
    href:  "/my-bio-ip",
    cta:   "자산 보기",
  },
  {
    step:  "03",
    title: "로열티 수령",
    desc:  "라이선시가 자산을 사용할 때마다 스마트 계약이 자동으로 정산합니다.",
    href:  "/dashboard",
    cta:   "대시보드",
  },
];

// ─── Icon resolver (keeps JSX inside the component render tree) ────────────────

function FeatureIcon({ iconKey }: { iconKey: Feature["iconKey"] }) {
  if (iconKey === "bio")      return <IconBio />;
  if (iconKey === "chain")    return <IconChain />;
  if (iconKey === "contract") return <IconContract />;
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
          <div className="h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
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
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-700/50 bg-violet-950/60 px-4 py-1.5 text-xs font-semibold text-violet-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Biometric IP Protocol · Beta
          </span>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            놀면서 관리하는
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              나의 BIO-IP
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            챌린지를 즐기는 순간, 당신만의 생체 서명이
            블록체인에 새겨집니다.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/challenge"
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95"
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

        {/* Stats row */}
        <div className="relative z-10 mt-16 flex flex-wrap items-center justify-center gap-10">
          {(STATS ?? []).map((stat) => (
            <div key={stat?.label ?? ""} className="text-center">
              <p className="text-3xl font-extrabold text-white">
                {stat?.value ?? "—"}
                <span className="ml-1 text-lg font-semibold text-violet-400">
                  {stat?.unit ?? ""}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{stat?.label ?? ""}</p>
            </div>
          ))}
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
              생체 IP의 전 과정을 하나로
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
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-bold text-violet-400">
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
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 transition hover:text-violet-300"
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
        <div className="mx-auto max-w-2xl rounded-2xl border border-violet-800/40 bg-gradient-to-br from-violet-950/60 to-zinc-900 px-8 py-10 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">
            지금 바로 내 생체 IP를 등록하세요
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            캡처부터 등록·정산까지, 중개자 없이 직접 관리합니다.
          </p>
          <Link
            href="/challenge"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95"
          >
            챌린지 시작 <IconArrowRight />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-xs text-zinc-600">
        © 2026 BIO-IP play. Biometric IP on-chain protocol.
      </footer>
    </div>
  );
}
