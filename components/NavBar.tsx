"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { href: "/",            label: "홈" },
  { href: "/challenge",   label: "챌린지" },
  { href: "/my-bio-ip",   label: "My Bio-IP" },
  { href: "/marketplace", label: "마켓플레이스" },
  { href: "/dashboard",   label: "대시보드" },
] as const;

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5 text-zinc-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      )}
    </svg>
  );
}

export default function NavBar() {
  const pathname      = usePathname();
  const [open, setOpen] = useState(false);
  const drawerRef     = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // 경로 변경 시 드로어 닫기
  useEffect(() => { setOpen(false); }, [pathname]);

  // 드로어 외부 클릭 감지
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // 드로어 열릴 때 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-1.5 select-none">
            <span className="font-mono text-base font-bold tracking-tight text-white">
              BIO-IP
            </span>
            <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
              play
            </span>
          </Link>

          {/* 데스크톱 링크 (md 이상) */}
          <ul className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive(href)
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* 햄버거 버튼 (md 미만) */}
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="flex md:hidden items-center justify-center rounded-lg p-2 transition hover:bg-zinc-800"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={open}
          >
            <HamburgerIcon open={open} />
          </button>
        </div>
      </nav>

      {/* 모바일 드로어 */}
      {/* 딤 오버레이 */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* 드로어 패널 */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-50 flex h-full w-64 flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 드로어 헤더 */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 select-none"
            onClick={() => setOpen(false)}
          >
            <span className="font-mono text-sm font-bold text-white">BIO-IP</span>
            <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
              play
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            aria-label="메뉴 닫기"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 드로어 링크 목록 */}
        <ul className="flex flex-col gap-1 p-4">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                }`}
              >
                {isActive(href) && (
                  <span className="mr-2.5 h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                )}
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* 드로어 하단 */}
        <div className="mt-auto border-t border-zinc-800 px-5 py-4">
          <p className="text-[10px] text-zinc-600">© 2026 BIO-IP play</p>
        </div>
      </div>
    </>
  );
}
