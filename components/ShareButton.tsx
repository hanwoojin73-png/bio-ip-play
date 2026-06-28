"use client";

import { useState } from "react";

interface ShareButtonProps {
  url?: string;
  text?: string;
}

export default function ShareButton({
  url,
  text = "내 Bio-IP를 등록했어요! #BioIP #블록체인",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");

  function handleKakao() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // KakaoTalk deep link — opens KakaoTalk on mobile
      window.location.href = `kakaotalk://msg/send?text=${encodeURIComponent(text + "\n" + shareUrl)}`;
    } else if (navigator.share) {
      navigator.share({ title: "BIO-IP Play", text, url: shareUrl }).catch(() => {});
    } else {
      // Desktop fallback: copy text + URL
      navigator.clipboard
        .writeText(text + "\n" + shareUrl)
        .then(() => alert("카카오톡 공유 텍스트가 복사됐어요. 카카오톡에 붙여넣기 해주세요."))
        .catch(() => {});
    }
  }

  function handleTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=400",
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* KakaoTalk */}
      <button
        type="button"
        onClick={handleKakao}
        title="카카오톡으로 공유"
        className="flex items-center gap-1.5 rounded-lg bg-[#FEE500] px-3 py-1.5 text-xs font-semibold text-[#3C1E1E] transition hover:brightness-95 active:scale-95"
      >
        {/* Kakao speech-bubble icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.477 2 2 5.804 2 10.5c0 2.99 1.794 5.61 4.5 7.165L5.5 22l4.938-2.56A13.06 13.06 0 0012 19c5.523 0 10-3.804 10-8.5S17.523 2 12 2z" />
        </svg>
        카카오톡
      </button>

      {/* Twitter / X */}
      <button
        type="button"
        onClick={handleTwitter}
        title="X(트위터)로 공유"
        className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 active:scale-95"
      >
        {/* X logo */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.39 6.231H2.752l7.748-8.872L2.31 2.25h6.97l4.26 5.63 4.704-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
        X 공유
      </button>

      {/* Copy link */}
      <button
        type="button"
        onClick={handleCopy}
        title="링크 복사"
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
          copied
            ? "bg-emerald-600 text-white"
            : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white"
        }`}
      >
        {copied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            복사됨
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            링크 복사
          </>
        )}
      </button>
    </div>
  );
}
