"use client";

/**
 * Full-screen "Bio-IP 등록" analysis showcase — shown only AFTER shooting is
 * done, while the real upload/DB save runs in the background. This is the one
 * place in the capture flow where a flashier visualization is appropriate;
 * during actual shooting (ChallengePage's live view) nothing like this is
 * ever drawn on top of the user's face.
 *
 * MediaPipe is loaded via a dynamic import() inside the effect below, so it
 * never adds weight to any bundle unless this component actually mounts.
 */

import { useEffect, useState } from "react";

// Each label describes something the registration flow really does:
// the recorded take is loaded, a face-landmark pass runs on its first frame
// (the dot animation below), the take's watermark ID is attached to the
// record, and the record is saved to the vault. Per-element (초상/표정/몸짓/
// 음성) extraction is NOT implemented yet — don't label stages as if it were.
export const HIGHLIGHT_STAGES = [
  "영상 확인",
  "얼굴 인식",
  "워터마크 ID 연결",
  "보관함 등록",
] as const;

export const HIGHLIGHT_STAGE_DURATION_MS = 700;

interface Point { x: number; y: number }

interface RegistrationHighlightProps {
  videoBlob: Blob | null;
  stageIndex: number; // clamped to [0, HIGHLIGHT_STAGES.length - 1] by the caller
}

export default function RegistrationHighlight({ videoBlob, stageIndex }: RegistrationHighlightProps) {
  const [bgUrl, setBgUrl]   = useState<string | null>(null);
  const [points, setPoints] = useState<Point[] | null>(null);

  // Extract the first frame as a background image, then (best-effort) run
  // face landmark detection on that single still frame for the dot animation.
  useEffect(() => {
    if (!videoBlob) return;
    let cancelled = false;
    const objectUrl = URL.createObjectURL(videoBlob);
    const video = document.createElement("video");
    video.muted      = true;
    video.playsInline = true;
    video.src        = objectUrl;

    const onSeeked = async () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width  = video.videoWidth  || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (!cancelled) setBgUrl(canvas.toDataURL("image/jpeg", 0.85));

      try {
        const { detectFaceLandmarksOnImage } = await import("@/lib/bio-extractor/face-landmarker");
        const landmarks = await detectFaceLandmarksOnImage(canvas);
        if (!cancelled && landmarks.length > 0) {
          // A light "constellation" of key points reads better than the full
          // 468-point dense mesh at this size, and stays clearly distinct
          // from the "no mesh on the face" rule that applies during shooting.
          const sampled = landmarks.filter((_, i) => i % 6 === 0).map((p) => ({ x: p.x, y: p.y }));
          setPoints(sampled);
        }
      } catch (e) {
        console.warn("[highlight] landmark extraction failed, skipping dots:", e);
      }
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadeddata", () => {
      try { video.currentTime = 0.05; } catch { onSeeked(); }
    });
    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener("seeked", onSeeked);
      URL.revokeObjectURL(objectUrl);
    };
  }, [videoBlob]);

  const clampedStage = Math.max(0, Math.min(stageIndex, HIGHLIGHT_STAGES.length - 1));
  const stageLabel    = HIGHLIGHT_STAGES[clampedStage];
  const progressPct   = ((clampedStage + 1) / HIGHLIGHT_STAGES.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Background: first frame of the just-recorded take */}
      {bgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/85" />

      {/* Landmark dots — sequential pop-in over ~1.5s */}
      {points && (
        <div className="absolute inset-0">
          {points.map((p, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 animate-dot-pop rounded-full bg-orange-400"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                boxShadow: "0 0 6px 2px rgba(249,115,22,0.55)",
                animationDelay: `${(i / points.length) * 1.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/15 ring-2 ring-orange-500/50">
          <svg className="h-8 w-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5m4.75-11.396c.251.023.501.05.75.082m4.5 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3m-5.55-12.196c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 20.25a48.25 48.25 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>

        <p className="text-lg font-bold text-white">{stageLabel}</p>

        {/* Progress bar */}
        <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="text-xs text-white/40">HANiPLAY · Bio-IP 등록</p>
      </div>

      {/* Decorative waveform — purely visual flourish, not real audio data */}
      <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-end gap-1">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-orange-500/70 animate-wave-bar"
            style={{ height: "20px", animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
    </div>
  );
}
