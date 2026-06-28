"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  extractVisualSignature,
  extractFaceLandmarks,
  extractPoseLandmarks,
  disposeMediaPipe,
  type ExtractionResult,
} from "@/lib/bio-extractor/mediapipe";
import {
  generateDynamicsSignature,
  type CaptureFrame,
  type GeneratorResult,
} from "@/lib/signature/generator";
import { applyWatermark, generateWatermarkId, type WatermarkResult } from "@/lib/watermark";
import { uploadVideo, saveBioIPAsset, getOrCreateUserId } from "@/lib/supabase/upload";

// ─── Types ────────────────────────────────────────────────────────────────────

type CaptureState  = "idle" | "ready" | "recording" | "watermarking" | "preview";
type FacingMode    = "user" | "environment";
type RegisterState = "idle" | "working" | "done";
type Orientation   = "portrait" | "landscape";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const router = useRouter();

  // ── State machine ────────────────────────────────────────────────────────────
  const [captureState,      setCaptureState]      = useState<CaptureState>("idle");
  const [facingMode,        setFacingMode]        = useState<FacingMode>("user");
  const [orientation,       setOrientation]       = useState<Orientation>("portrait");
  const [zoom,              setZoom]              = useState(1);
  // hwZoomRange: set when the camera track supports the zoom constraint natively
  const [hwZoomRange,       setHwZoomRange]       = useState<{ min: number; max: number } | null>(null);
  const [elapsed,           setElapsed]           = useState(0);
  const [error,             setError]             = useState<string | null>(null);
  const [watermarkProgress, setWatermarkProgress] = useState(0);
  const [watermarkError,    setWatermarkError]    = useState<string | null>(null);
  const [watermarkResult,   setWatermarkResult]   = useState<WatermarkResult | null>(null);
  const [previewUrl,        setPreviewUrl]        = useState<string | null>(null);
  const [registerState,     setRegisterState]     = useState<RegisterState>("idle");
  const [pendingWatermark,  setPendingWatermark]  = useState(false);

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  const liveVideoRef    = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  // ── Recording internals ───────────────────────────────────────────────────────
  const streamRef           = useRef<MediaStream | null>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef           = useRef<Blob[]>([]);
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const rawBlobRef          = useRef<Blob | null>(null);

  // ── Bio extraction ────────────────────────────────────────────────────────────
  const capturedFramesRef   = useRef<CaptureFrame[]>([]);
  const isCapturingFrameRef = useRef(false);
  const recordingStartRef   = useRef(0);
  const visualResultRef     = useRef<ExtractionResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dynamicsResultRef   = useRef<GeneratorResult | null>(null);

  // ── Pinch zoom ────────────────────────────────────────────────────────────────
  const pinchStartRef = useRef(0);

  // ── Start camera ─────────────────────────────────────────────────────────────
  const startCamera = useCallback(async (facing: FacingMode) => {
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1080 }, height: { ideal: 1920 }, facingMode: facing },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      // Check hardware zoom support
      const track = stream.getVideoTracks()[0];
      const caps  = (track?.getCapabilities?.() ?? {}) as Record<string, unknown> & { zoom?: { min: number; max: number } };
      setHwZoomRange(caps.zoom ? { min: caps.zoom.min, max: caps.zoom.max } : null);
      setCaptureState("ready");
    } catch {
      setError("카메라 또는 마이크 접근 권한이 필요합니다.");
    }
  }, []);

  // ── Hardware zoom via applyConstraints ────────────────────────────────────────
  // Runs whenever zoom state changes; no-op if camera doesn't support hw zoom.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !hwZoomRange || zoom <= 1) return;
    const clamped = Math.min(hwZoomRange.max, Math.max(hwZoomRange.min, zoom));
    (track as MediaStreamTrack & { applyConstraints: (c: object) => Promise<void> })
      .applyConstraints({ advanced: [{ zoom: clamped }] })
      .catch((e: unknown) => console.warn("[zoom] applyConstraints:", e));
  }, [zoom, hwZoomRange]);

  // ── Flip camera ───────────────────────────────────────────────────────────────
  const flipCamera = useCallback(() => {
    const next: FacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  // ── Orientation toggle ────────────────────────────────────────────────────────
  const toggleOrientation = useCallback(() => {
    setOrientation((o) => (o === "portrait" ? "landscape" : "portrait"));
  }, []);

  // ── Pinch gesture handlers ────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartRef.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || pinchStartRef.current === 0) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const scale = dist / pinchStartRef.current;
    setZoom((prev) => Math.max(0.5, Math.min(3, prev * scale)));
    pinchStartRef.current = dist;
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStartRef.current = 0;
  }, []);

  // ── Combined touch end: pinch reset + double-tap to reset zoom ───────────────
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    pinchStartRef.current = 0;
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) setZoom(1);
    lastTapRef.current = now;
  }, []);

  // ── File upload ───────────────────────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("영상 파일(.mp4, .webm 등)만 업로드할 수 있습니다.");
      return;
    }
    rawBlobRef.current = file;
    setWatermarkError(null);
    // Skip watermarking — go directly to preview with original file
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCaptureState("preview");
    e.target.value = "";
  }, []);

  // ── Per-frame landmark capture ─────────────────────────────────────────────────
  const captureFrame = useCallback(async () => {
    if (isCapturingFrameRef.current || !liveVideoRef.current) return;
    isCapturingFrameRef.current = true;
    try {
      const [face, pose] = await Promise.all([
        extractFaceLandmarks(liveVideoRef.current),
        extractPoseLandmarks(liveVideoRef.current),
      ]);
      capturedFramesRef.current.push({
        timestamp: Date.now() - recordingStartRef.current,
        face,
        pose,
      });
    } finally {
      isCapturingFrameRef.current = false;
    }
  }, []);

  // ── Start recording ────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current         = [];
    capturedFramesRef.current = [];
    recordingStartRef.current = Date.now();
    visualResultRef.current   = null;
    dynamicsResultRef.current = null;

    const mimeType =
      ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      rawBlobRef.current = blob;
      // Skip watermark post-processing — go directly to preview
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCaptureState("preview");
    };

    recorder.start(100);
    setElapsed(0);
    setCaptureState("recording");
    timerRef.current         = setInterval(() => setElapsed((p) => p + 1), 1000);
    frameIntervalRef.current = setInterval(() => { captureFrame(); }, 200);
  }, [captureFrame]);

  // ── Stop recording ─────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current)         clearInterval(timerRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    setWatermarkError(null);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── Watermark effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingWatermark) return;
    setPendingWatermark(false);
    const blob = rawBlobRef.current;
    if (!blob) return;

    let cancelled = false;

    // Bio extraction — non-blocking, best-effort
    if (liveVideoRef.current) {
      extractVisualSignature(liveVideoRef.current)
        .then((r) => { if (!cancelled) visualResultRef.current = r; })
        .catch(() => {});
    }
    if (capturedFramesRef.current.length >= 2) {
      requestAnimationFrame(() => {
        try { dynamicsResultRef.current = generateDynamicsSignature(capturedFramesRef.current); }
        catch {}
      });
    }

    applyWatermark(blob, {
      uniqueId:   generateWatermarkId(),
      onProgress: (r) => { if (!cancelled) setWatermarkProgress(Math.round(r * 100)); },
    })
      .then((result) => {
        if (cancelled) return;
        setWatermarkResult(result);
        // Preview plays the original video; thumbnail (result.blob) is JPEG only
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setCaptureState("preview");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error("[challenge] watermark failed:", err.message);
        setWatermarkError(err.message);
        // Fallback: show raw video without watermark
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setCaptureState("preview");
      });

    return () => { cancelled = true; };
  }, [pendingWatermark]);

  // ── Reset to camera ────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setWatermarkResult(null);
    setWatermarkProgress(0);
    setWatermarkError(null);
    setRegisterState("idle");
    rawBlobRef.current        = null;
    capturedFramesRef.current = [];
    setElapsed(0);
    setError(null);
    setZoom(1);
    startCamera(facingMode);
  }, [previewUrl, facingMode, startCamera]);

  // ── Download ───────────────────────────────────────────────────────────────────
  const downloadVideo = useCallback(() => {
    const videoBlob = rawBlobRef.current;
    if (!videoBlob) return;
    const ext = videoBlob.type.includes("mp4") ? "mp4" : "webm";
    const url = URL.createObjectURL(videoBlob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `bio-ip-${watermarkResult?.uniqueId ?? "challenge"}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [watermarkResult]);

  // ── SNS share ──────────────────────────────────────────────────────────────────
  const shareVideo = useCallback(async () => {
    const blob = rawBlobRef.current;
    if (!blob) return;
    const ext  = blob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `bio-ip-challenge.${ext}`, { type: blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "BIO-IP Challenge", text: "나의 Bio-IP 챌린지 🎬" });
      } else if (navigator.share) {
        await navigator.share({ title: "BIO-IP Challenge", url: window.location.href });
      }
    } catch { /* user cancelled */ }
  }, [watermarkResult]);

  // ── Bio-IP registration ────────────────────────────────────────────────────────
  const registerBioIP = useCallback(async () => {
    setRegisterState("working");
    try {
      if (!visualResultRef.current && liveVideoRef.current) {
        try { visualResultRef.current = await extractVisualSignature(liveVideoRef.current); }
        catch {}
      }
      const userId = await getOrCreateUserId();
      const blob   = rawBlobRef.current; // always upload the original video, not the thumbnail
      if (!blob) throw new Error("녹화된 영상이 없습니다.");
      const videoUrl = await uploadVideo(blob, userId);
      const frames   = capturedFramesRef.current;
      const lastFrame = frames.length > 0 ? frames[frames.length - 1] : null;
      await saveBioIPAsset({
        userId,
        videoUrl,
        faceLandmarks:  lastFrame?.face ?? [],
        poseLandmarks:  lastFrame?.pose ?? [],
        watermarkId:    watermarkResult?.uniqueId ?? generateWatermarkId(),
      });
      setRegisterState("done");
      await new Promise((r) => setTimeout(r, 700));
      router.push("/my-bio-ip");
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.");
      setRegisterState("idle");
    }
  }, [router, watermarkResult]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current)         clearInterval(timerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      disposeMediaPipe();
    };
  }, []);

  // ── Sync preview video src ─────────────────────────────────────────────────────
  useEffect(() => {
    if (previewVideoRef.current && previewUrl) previewVideoRef.current.src = previewUrl;
  }, [previewUrl]);

  const isLive         = captureState === "ready" || captureState === "recording";
  const isRecording    = captureState === "recording";
  const isWatermarking = captureState === "watermarking";
  const isPreview      = captureState === "preview";

  // ── Live video CSS: mirror + zoom (CSS scale only for zoom-in without hw zoom) ─
  const videoTransform = [
    facingMode === "user" ? "scaleX(-1)" : "",
    zoom !== 1 ? `scale(${zoom})` : "",
  ].filter(Boolean).join(" ") || "none";

  const videoClass = orientation === "landscape"
    ? "absolute inset-0 w-full h-full object-contain"
    : "absolute inset-0 h-full w-full object-cover";

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleDoubleTap}
    >
      {/* ── Hidden file input ─────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ── Live camera feed — always mounted ────────────────────────────── */}
      <video
        ref={liveVideoRef}
        autoPlay
        muted
        playsInline
        className={`${videoClass} transition-opacity duration-200 ${isLive ? "opacity-100" : "opacity-0"}`}
        style={{ transform: videoTransform, transformOrigin: "center center" }}
      />

      {/* ── Watermarked preview ───────────────────────────────────────────── */}
      {isPreview && previewUrl && (
        <video
          ref={previewVideoRef}
          autoPlay
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          IDLE — camera start prompt + file upload
      ════════════════════════════════════════════════════════════════════ */}
      {captureState === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Bio-IP 챌린지</h1>
            <p className="text-sm leading-relaxed text-zinc-400">
              카메라와 마이크를 켜고<br />나만의 생체 IP를 기록하세요
            </p>
          </div>

          {error && (
            <p className="w-full max-w-xs rounded-2xl border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {/* Camera start */}
          <button
            onClick={() => startCamera(facingMode)}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-violet-600 shadow-xl shadow-violet-900/60 active:scale-95"
            aria-label="카메라 시작"
          >
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.177a1.56 1.56 0 001.11-.71l.822-1.317a2.929 2.929 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" />
            </svg>
          </button>

          <p className="text-xs text-zinc-600">탭하여 카메라 시작</p>

          {/* File upload separator */}
          <div className="flex w-full max-w-xs items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-600">또는</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            영상 파일 업로드
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          WATERMARKING — progress overlay
      ════════════════════════════════════════════════════════════════════ */}
      {isWatermarking && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-7 bg-black px-8">
          <Spinner className="h-14 w-14 text-violet-400" />
          <div className="w-full max-w-xs space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${Math.max(watermarkProgress, 3)}%` }}
              />
            </div>
            <p className="text-center text-sm text-zinc-400">
              썸네일 생성 중… {watermarkProgress}%
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          RECORDING — red dot + timer
      ════════════════════════════════════════════════════════════════════ */}
      {isRecording && (
        <div
          className="absolute left-0 right-0 top-0 z-20 flex justify-center"
          style={{ paddingTop: "max(3.5rem, calc(env(safe-area-inset-top, 0px) + 2rem))" }}
        >
          <div className="flex items-center gap-2.5 rounded-full bg-black/55 px-5 py-2.5 backdrop-blur-md">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-lg font-bold tabular-nums text-white">
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ZOOM indicator — shown during recording when zoom > 1
      ════════════════════════════════════════════════════════════════════ */}
      {isRecording && zoom !== 1 && (
        <div className="absolute left-4 top-1/2 z-20 -translate-y-1/2">
          <div className="rounded-full bg-black/60 px-3 py-1.5 font-mono text-sm font-bold text-white backdrop-blur-sm">
            {zoom.toFixed(1)}×
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TOP BAR — back / flip / orientation / watermark ID
      ════════════════════════════════════════════════════════════════════ */}
      {(isLive || isPreview) && !isRecording && (
        <div
          className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4"
          style={{ paddingTop: "max(3rem, calc(env(safe-area-inset-top, 0px) + 1.5rem))" }}
        >
          {/* Back (ready) or Retry (preview) */}
          <button
            onClick={isPreview ? reset : () => router.push("/")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md active:scale-90"
            aria-label={isPreview ? "다시 녹화" : "뒤로"}
          >
            {isPreview ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            )}
          </button>

          {/* Right-side controls when ready */}
          {captureState === "ready" && (
            <div className="flex items-center gap-2">
              {/* Orientation toggle */}
              <button
                onClick={toggleOrientation}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md active:scale-90"
                aria-label={orientation === "portrait" ? "가로 모드" : "세로 모드"}
                title={orientation === "portrait" ? "가로 모드" : "세로 모드"}
              >
                {orientation === "portrait" ? (
                  /* Portrait → landscape icon */
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="2" y="5" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l3 3-3 3" />
                  </svg>
                ) : (
                  /* Landscape → portrait icon */
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="7" y="2" width="10" height="20" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 10l2 2-2 2" />
                  </svg>
                )}
              </button>

              {/* Flip camera */}
              <button
                onClick={flipCamera}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md active:scale-90"
                aria-label="카메라 전환"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
          )}

          {/* Watermark ID badge (preview) */}
          {isPreview && watermarkResult && (
            <div className="max-w-[12rem] truncate rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md">
              <span className="font-mono text-[10px] tracking-wide text-zinc-300">
                {watermarkResult.uniqueId}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ZOOM CONTROLS — right side when ready (tap to set level)
      ════════════════════════════════════════════════════════════════════ */}
      {captureState === "ready" && (
        <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 flex flex-col gap-2">
          {([0.5, 1, 1.5, 2, 3] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`flex h-10 w-10 items-center justify-center rounded-full font-mono text-xs font-bold transition active:scale-90 ${
                Math.abs(zoom - z) < 0.15
                  ? "bg-white text-black shadow-lg"
                  : "bg-black/50 text-white backdrop-blur-md"
              }`}
            >
              {z}×
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          BOTTOM — record + controls
      ════════════════════════════════════════════════════════════════════ */}
      {isLive && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          style={{ paddingBottom: "max(2.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))" }}
        >
          <div className="bg-gradient-to-t from-black/80 to-transparent pt-16">
            <div className="flex items-center justify-center gap-10">
              {/* Left: file upload (ready) or spacer (recording) */}
              {captureState === "ready" ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm active:scale-90"
                  aria-label="영상 파일 업로드"
                  title="영상 파일 업로드"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </button>
              ) : (
                <div className="w-14" />
              )}

              {/* Record (ready) or Stop (recording) */}
              {captureState === "ready" ? (
                <button
                  onClick={startRecording}
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white shadow-xl active:scale-90"
                  aria-label="녹화 시작"
                >
                  <span className="h-10 w-10 rounded-full bg-red-500" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white shadow-xl active:scale-90"
                  aria-label="녹화 정지"
                >
                  <span className="h-8 w-8 rounded-lg bg-white" />
                </button>
              )}

              {/* Right: flip camera (ready) or spacer (recording) */}
              {captureState === "ready" ? (
                <button
                  onClick={flipCamera}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm active:scale-90"
                  aria-label="카메라 전환"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              ) : (
                <div className="w-14" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          BOTTOM — preview action buttons
      ════════════════════════════════════════════════════════════════════ */}
      {isPreview && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          style={{ paddingBottom: "max(2.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))" }}
        >
          <div className="bg-gradient-to-t from-black/95 via-black/65 to-transparent px-5 pt-20">

            {/* Watermark error notice */}
            {watermarkError && (
              <div className="mb-3 rounded-xl border border-amber-800/60 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-300">
                워터마크 없이 저장됩니다: {watermarkError}
              </div>
            )}

            {registerState === "idle" && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={registerBioIP}
                  className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-violet-600 text-base font-bold text-white shadow-lg shadow-violet-900/50 active:scale-[0.97]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Bio-IP 등록
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={downloadVideo}
                    className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/15 text-sm font-semibold text-white backdrop-blur-md active:scale-[0.97]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    다운로드
                  </button>
                  <button
                    onClick={shareVideo}
                    className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/15 text-sm font-semibold text-white backdrop-blur-md active:scale-[0.97]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    SNS 공유
                  </button>
                </div>
              </div>
            )}

            {registerState === "working" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <Spinner className="h-10 w-10 text-violet-400" />
                <p className="text-sm font-medium text-zinc-300">Bio-IP 등록 중…</p>
              </div>
            )}

            {registerState === "done" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-emerald-300">등록 완료! 이동 중…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
