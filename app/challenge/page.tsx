"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { generateWatermarkId, applyWatermark, type WatermarkResult } from "@/lib/watermark";
import { uploadVideo, saveBioIPAsset, getOrCreateUserId } from "@/lib/supabase/upload";
import type { ContentType, PerformanceType } from "@/types/bio-ip";
import { RegistrationHighlight, HIGHLIGHT_STAGES, HIGHLIGHT_STAGE_DURATION_MS } from "@/components/capture";
// Type-only import: erased at compile time, so this does NOT pull the (heavy)
// @mediapipe/tasks-vision runtime into this page's bundle. The actual module
// is only ever reached via a dynamic import() below.
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

// ─── Types ────────────────────────────────────────────────────────────────────

type CaptureState  = "idle" | "ready" | "recording" | "watermarking" | "preview";
type FacingMode    = "user" | "environment";
type RegisterState = "idle" | "working" | "done";
type Orientation   = "portrait" | "landscape";
type ResolutionMode = "standard" | "high";

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

// ─── Metadata form constants ───────────────────────────────────────────────────

const PERFORMANCE_TYPES: PerformanceType[] = ["연기", "노래", "춤", "연주", "기타"];

const GENRE_PLACEHOLDER: Record<PerformanceType, string> = {
  "연기": "예: 드라마, 코미디, 액션",
  "노래": "예: 클래식, 팝, 뮤지컬",
  "춤":   "예: 발레, 한국무용, 현대무용",
  "연주": "예: 피아노, 바이올린, 첼로",
  "기타": "예: 마술, 개그, 스탠드업",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const router = useRouter();

  // ── State machine ────────────────────────────────────────────────────────────
  const [captureState,      setCaptureState]      = useState<CaptureState>("idle");
  const [facingMode,        setFacingMode]        = useState<FacingMode>("user");
  const [orientation,       setOrientation]       = useState<Orientation>("portrait");
  // streamDims: the stream's actual measured resolution (from videoWidth/
  // videoHeight once metadata loads) — this is the ground truth for whether the
  // stream orientation matches the screen, since getUserMedia constraints can't
  // be trusted to produce it on many Android/Chrome combinations.
  const [streamDims,        setStreamDims]        = useState<{ width: number; height: number } | null>(null);
  const [resolutionMode,    setResolutionMode]    = useState<ResolutionMode>("standard");
  const [resolutionNotice,  setResolutionNotice]  = useState<string | null>(null);
  const [elapsed,           setElapsed]           = useState(0);
  const [error,             setError]             = useState<string | null>(null);
  const [watermarkProgress, setWatermarkProgress] = useState(0);
  const [watermarkError,    setWatermarkError]    = useState<string | null>(null);
  const [watermarkResult,   setWatermarkResult]   = useState<WatermarkResult | null>(null);
  const [previewUrl,        setPreviewUrl]        = useState<string | null>(null);
  const [registerState,  setRegisterState]  = useState<RegisterState>("idle");
  const [contentType,    setContentType]    = useState<ContentType>("self");
  const [pendingWatermark, setPendingWatermark] = useState(false);

  // ── Registration highlight overlay (full-screen, upload-time only) ───────────
  const [showHighlight,  setShowHighlight]  = useState(false);
  const [highlightStage, setHighlightStage] = useState(0);

  // ── Bio-IP metadata form ──────────────────────────────────────────────────────
  const [ownerName,        setOwnerName]        = useState("");
  const [performanceType,  setPerformanceType]  = useState<PerformanceType | null>(null);
  const [performanceGenre, setPerformanceGenre] = useState("");
  const [characterName,    setCharacterName]    = useState("");

  // ── Live "생체 인식 중" status dot — no landmarks/mesh are ever drawn on the
  // face itself; this is purely a small indicator next to the back button so
  // shooting a take is never visually obstructed. ───────────────────────────
  const [bioSensorReady, setBioSensorReady] = useState(false);
  const [faceDetected,   setFaceDetected]   = useState(false);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  const liveVideoRef    = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  // ── Recording internals ───────────────────────────────────────────────────────
  const streamRef           = useRef<MediaStream | null>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef           = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const rawBlobRef  = useRef<Blob | null>(null);
  const watermarkCanvasRef  = useRef<HTMLCanvasElement | null>(null);
  const rafRef              = useRef<number | null>(null);
  const watermarkIdRef      = useRef<string>("");

  // ── Recording-only voice waveform (preview UI, never baked into the file) ──
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRafRef    = useRef<number | null>(null);

  // ── Start camera ─────────────────────────────────────────────────────────────
  // Deliberately no width/height/aspectRatio constraints: forcing a specific
  // resolution via constraints is unreliable across Android/Chrome camera
  // stacks, and can make a device return an oddly-cropped stream. Left
  // unconstrained, most devices give back a stream that already matches
  // however the phone is physically held (e.g. a portrait phone gets a
  // portrait 720x1280 stream) — actual orientation is verified afterward from
  // the real videoWidth/videoHeight, not assumed from what was requested.
  const startCamera = useCallback(async (facing: FacingMode, mode: ResolutionMode = "standard") => {
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreamDims(null);
    try {
      const videoConstraints: MediaTrackConstraints = { facingMode: facing };
      if (mode === "high") {
        videoConstraints.width  = { ideal: 1080 };
        videoConstraints.height = { ideal: 1920 };
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      // No zoom UI — always pin the camera to its native minimum zoom (widest
      // FoV) so it never starts pre-cropped by whatever the device defaults to.
      const track = stream.getVideoTracks()[0];
      const caps  = (track?.getCapabilities?.() ?? {}) as Record<string, unknown> & { zoom?: { min: number; max: number } };
      if (caps.zoom) {
        (track as MediaStreamTrack & { applyConstraints: (c: object) => Promise<void> })
          .applyConstraints({ advanced: [{ zoom: caps.zoom.min }] })
          .catch((e: unknown) => console.warn("[zoom] reset to min failed:", e));
      }
      setCaptureState("ready");
    } catch {
      setError("카메라 또는 마이크 접근 권한이 필요합니다.");
    }
  }, []);

  // ── Measure the stream's real resolution once metadata loads ─────────────────
  const handleLoadedMetadata = useCallback(() => {
    const video = liveVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setStreamDims({ width: video.videoWidth, height: video.videoHeight });
  }, []);

  // ── Flip camera ───────────────────────────────────────────────────────────────
  const flipCamera = useCallback(() => {
    const next: FacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startCamera(next, resolutionMode);
  }, [facingMode, resolutionMode, startCamera]);

  // ── Orientation: apply + restart the stream if it actually changed ───────────
  // Refs (not state) back this so the rotation listener below can be registered
  // exactly once without ever reading stale facingMode/captureState/orientation.
  const orientationRef     = useRef<Orientation>("portrait");
  const captureStateRef    = useRef<CaptureState>("idle");
  const facingModeRef      = useRef<FacingMode>("user");
  const resolutionModeRef  = useRef<ResolutionMode>("standard");
  useEffect(() => { orientationRef.current    = orientation;     }, [orientation]);
  useEffect(() => { captureStateRef.current   = captureState;    }, [captureState]);
  useEffect(() => { facingModeRef.current     = facingMode;      }, [facingMode]);
  useEffect(() => { resolutionModeRef.current = resolutionMode;  }, [resolutionMode]);

  // Restarting on rotation matters even with zero constraints: on some Android
  // Chrome builds, an unconstrained getUserMedia call's resulting resolution
  // depends on the device's orientation *at call time*, so a fresh call right
  // after rotating can yield a differently-shaped stream.
  const applyOrientation = useCallback((next: Orientation) => {
    const changed = orientationRef.current !== next;
    orientationRef.current = next;
    setOrientation(next);
    if (changed && captureStateRef.current === "ready") {
      startCamera(facingModeRef.current, resolutionModeRef.current);
    }
  }, [startCamera]);

  // ── Auto-detect physical device rotation ──────────────────────────────────────
  // Keeps the requested camera stream orientation in sync with how the phone is
  // actually being held — portrait phone → portrait stream, and vice versa.
  // Restarting mid-recording is guarded against inside applyOrientation itself
  // (it only restarts when captureState is "ready").
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(orientation: portrait)");
    applyOrientation(mql.matches ? "portrait" : "landscape");
    const onChange = (e: MediaQueryListEvent) => applyOrientation(e.matches ? "portrait" : "landscape");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [applyOrientation]);

  // ── Resolution toggle ──────────────────────────────────────────────────────────
  const changeResolutionMode = useCallback((mode: ResolutionMode) => {
    if (mode === resolutionModeRef.current || captureStateRef.current === "recording") return;
    resolutionModeRef.current = mode;
    setResolutionMode(mode);
    setResolutionNotice(null);
    if (captureStateRef.current === "ready") {
      startCamera(facingModeRef.current, mode);
    }
  }, [startCamera]);

  // If asking for high-res makes the stream come back in the wrong orientation
  // (or otherwise mismatched), that's a device that can't honor the resolution
  // hint without breaking framing — fall back to standard automatically rather
  // than show a broken/cropped preview.
  useEffect(() => {
    if (!streamDims || resolutionModeRef.current !== "high") return;
    const isStreamPortrait = streamDims.height > streamDims.width;
    const isScreenPortrait = orientationRef.current === "portrait";
    if (isStreamPortrait !== isScreenPortrait) {
      resolutionModeRef.current = "standard";
      setResolutionMode("standard");
      setResolutionNotice("이 기기는 표준 화질만 지원합니다.");
      if (captureStateRef.current === "ready") {
        startCamera(facingModeRef.current, "standard");
      }
    }
  }, [streamDims, startCamera]);

  // Auto-dismiss the fallback notice
  useEffect(() => {
    if (!resolutionNotice) return;
    const t = setTimeout(() => setResolutionNotice(null), 4000);
    return () => clearTimeout(t);
  }, [resolutionNotice]);

  // ── Live face detection (status dot only — never drawn on the face) ──────────
  // Runs at 5fps (200ms) rather than every frame: it only needs to answer a
  // yes/no question for a tiny status dot, not drive any visual overlay, so
  // there's no reason to spend more of a phone's battery/CPU on it. Loading
  // is fully isolated behind try/catch — any failure (unsupported browser,
  // blocked CDN, low-end device) just keeps the dot hidden and never affects
  // shooting/recording.
  useEffect(() => {
    if (captureState !== "ready" && captureState !== "recording") return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const { getLiveFaceLandmarker } = await import("@/lib/bio-extractor/face-landmarker");
        const landmarker = await getLiveFaceLandmarker();
        if (cancelled) return;
        faceLandmarkerRef.current = landmarker;
        setBioSensorReady(true);

        intervalId = setInterval(() => {
          const video = liveVideoRef.current;
          if (!video || video.readyState < 2) return;
          try {
            const result = landmarker.detectForVideo(video, performance.now());
            setFaceDetected((result.faceLandmarks?.length ?? 0) > 0);
          } catch {
            /* transient — skip this tick */
          }
        }, 200);
      } catch (e) {
        console.warn("[bio-sensor] face landmarker unavailable, hiding status dot:", e);
        if (!cancelled) setBioSensorReady(false);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [captureState]);

  // Release the MediaPipe model when leaving the camera entirely.
  useEffect(() => {
    return () => {
      if (!faceLandmarkerRef.current) return;
      import("@/lib/bio-extractor/face-landmarker")
        .then(({ disposeLiveFaceLandmarker }) => disposeLiveFaceLandmarker())
        .catch(() => {});
    };
  }, []);

  // ── Recording-only voice waveform ─────────────────────────────────────────────
  // Purely a preview overlay drawn to its own <canvas> — the actual recording
  // pipeline (startRecording above) draws only the camera frame + watermark,
  // so this never ends up in the saved file. Torn down the moment recording
  // stops, and never overlaps the face (it sits at the very bottom, above the
  // record button).
  useEffect(() => {
    if (captureState !== "recording") return;
    const stream = streamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) return;

    let audioCtx: AudioContext | null = null;

    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
      audioCtx.resume().catch(() => {});
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        const canvas = waveformCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) {
          analyser.getByteFrequencyData(dataArray);
          const w = canvas.width, h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          const barGap   = 2;
          const barWidth = w / bufferLength - barGap;
          ctx.fillStyle = "#f97316"; // orange-500
          for (let i = 0; i < bufferLength; i++) {
            const barHeight = Math.max(2, (dataArray[i] / 255) * h);
            const x = i * (barWidth + barGap);
            ctx.beginPath();
            ctx.roundRect(x, h - barHeight, barWidth, barHeight, 2);
            ctx.fill();
          }
        }
        waveformRafRef.current = requestAnimationFrame(draw);
      };
      waveformRafRef.current = requestAnimationFrame(draw);
    } catch (e) {
      console.warn("[waveform] audio analyser unavailable:", e);
    }

    return () => {
      if (waveformRafRef.current) { cancelAnimationFrame(waveformRafRef.current); waveformRafRef.current = null; }
      audioCtx?.close().catch(() => {});
    };
  }, [captureState]);

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

  // ── Start recording ────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    const video  = liveVideoRef.current;
    if (!stream || !video) return;

    chunksRef.current = [];

    watermarkIdRef.current = generateWatermarkId();
    const wmId    = watermarkIdRef.current;
    const dateStr = new Date().toLocaleDateString("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });

    // Always record the stream's native resolution as-is — no crop, no scale.
    // Cropping to force a target aspect throws away field of view and, on a
    // narrow source, magnifies whatever's left into an extreme close-up. If
    // the stream doesn't match the screen orientation, that's handled entirely
    // by the live-preview letterboxing (object-fit: contain) — the recorded
    // file simply comes out in whatever shape the camera actually delivered.
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    watermarkCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d")!;

    const drawOverlay = () => {
      const cw = canvas.width, ch = canvas.height;
      const scale = Math.min(cw / 1080, 1);
      const pad = Math.round(16 * scale + 4);
      const logoSize = Math.round(Math.max(13, 17 * scale));
      const metaSize = Math.round(Math.max(10, 13 * scale));
      const lineGap  = Math.round(metaSize * 1.55);
      const innerPadX = Math.round(12 * scale);
      const innerPadY = Math.round(8  * scale);
      ctx.save();
      ctx.font = `700 ${logoSize}px -apple-system,Arial,sans-serif`;
      const logoW = ctx.measureText("BIO-IP PLAY").width;
      ctx.font = `${metaSize}px monospace`;
      const idW   = ctx.measureText(wmId).width;
      const dateW = ctx.measureText(dateStr).width;
      const maxW  = Math.max(logoW, idW, dateW);
      const bgW   = maxW + innerPadX * 2;
      const bgH   = logoSize + lineGap * 2 + innerPadY * 2;
      const bgX   = cw - bgW - pad;
      const bgY   = ch - bgH - pad;
      ctx.globalAlpha = 0.72;
      ctx.fillStyle   = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgW, bgH, 6);
      ctx.fill();
      ctx.globalAlpha  = 0.85;
      ctx.textBaseline = "top";
      ctx.textAlign    = "left";
      const tx = bgX + innerPadX;
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${logoSize}px -apple-system,Arial,sans-serif`;
      ctx.fillText("BIO-IP PLAY", tx, bgY + innerPadY);
      ctx.fillStyle = "#cccccc";
      ctx.font = `${metaSize}px monospace`;
      ctx.fillText(wmId,    tx, bgY + innerPadY + logoSize + (lineGap - metaSize) / 2);
      ctx.fillText(dateStr, tx, bgY + innerPadY + logoSize + lineGap + (lineGap - metaSize) / 2);
      ctx.restore();
    };

    const renderFrame = () => {
      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width  = video.videoWidth  || 1280;
          canvas.height = video.videoHeight || 720;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawOverlay();
      }
      rafRef.current = requestAnimationFrame(renderFrame);
    };
    rafRef.current = requestAnimationFrame(renderFrame);

    const canvasStream = canvas.captureStream(30);
    stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

    const mimeType =
      ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

    const recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      rawBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCaptureState("preview");
    };

    recorder.start(100);
    setElapsed(0);
    setCaptureState("recording");
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }, []);

  // ── Stop recording ─────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current)   { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
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
    rawBlobRef.current = null;
    setElapsed(0);
    setError(null);
    startCamera(facingMode, resolutionMode);
  }, [previewUrl, facingMode, resolutionMode, startCamera]);

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
  const canRegister = ownerName.trim().length > 0 && performanceType !== null;

  const registerBioIP = useCallback(async () => {
    if (ownerName.trim().length === 0 || performanceType === null) {
      setError("소유자 이름과 퍼포먼스 유형을 입력해주세요.");
      return;
    }

    setRegisterState("working");
    setError(null);
    setHighlightStage(0);
    setShowHighlight(true);

    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} 시간 초과 (${ms / 1000}초)`)), ms),
        ),
      ]);

    // Scripted analysis narration — runs on its own clock, independent of how
    // long the real upload actually takes. If real work finishes first, the
    // highlight still plays out to the end before the success screen shows.
    const runStageTimer = async () => {
      for (let i = 0; i < HIGHLIGHT_STAGES.length; i++) {
        setHighlightStage(i);
        await new Promise((r) => setTimeout(r, HIGHLIGHT_STAGE_DURATION_MS));
      }
    };

    const doUpload = async () => {
      const userId = await withTimeout(getOrCreateUserId(), 10_000, "사용자 확인");
      console.log("[register] userId:", userId);

      const blob = rawBlobRef.current;
      if (!blob) throw new Error("녹화된 영상이 없습니다.");

      const videoUrl = await withTimeout(uploadVideo(blob, userId), 60_000, "영상 업로드");
      console.log("[register] 업로드 완료:", videoUrl);

      const wId = watermarkResult?.uniqueId ?? generateWatermarkId();
      const newAssetId = await withTimeout(
        saveBioIPAsset({
          userId,
          videoUrl,
          faceLandmarks:    [],
          poseLandmarks:    [],
          watermarkId:      wId,
          contentType,
          ownerName:        ownerName.trim(),
          characterName:    contentType === "character" ? (characterName.trim() || null) : null,
          performanceType,
          performanceGenre: performanceGenre.trim() || null,
        }),
        15_000,
        "DB 저장",
      );
      console.log("[register] 완료:", newAssetId);

      // Tracked in localStorage until login/owner_id is wired up — "나의
      // Bio-IP 보관함" reads this list to know which assets are "mine".
      try {
        const ids: string[] = JSON.parse(localStorage.getItem("my_bio_ip_ids") || "[]");
        ids.push(newAssetId);
        localStorage.setItem("my_bio_ip_ids", JSON.stringify(ids));
      } catch (e) {
        console.warn("[register] localStorage 저장 실패:", e);
      }
    };

    try {
      // Promise.all also gives us the "실패 시 연출 중단" behavior for free:
      // if doUpload() rejects, this rejects immediately regardless of how far
      // the stage timer has gotten.
      await Promise.all([runStageTimer(), doUpload()]);

      setShowHighlight(false);
      setRegisterState("done");
      await new Promise((r) => setTimeout(r, 700));
      router.push("/my-bio-ip");
    } catch (err) {
      setShowHighlight(false);
      const msg = err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.";
      console.error("[register] 실패:", msg);
      setError(msg);
      setRegisterState("idle");
    }
  }, [router, watermarkResult, contentType, ownerName, characterName, performanceType, performanceGenre]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current)   cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
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

  // ── Live video CSS: mirror the front camera only ──────────────────────────────
  const videoTransform = facingMode === "user" ? "scaleX(-1)" : "none";

  // ── Does the actual stream orientation match how the phone is held? ──────────
  // This is the ground truth check the whole render depends on: if they match,
  // it's safe to fill the screen with a small, honest cover-crop; if they don't
  // (a portrait phone got a landscape stream, or vice versa), cropping further
  // would blow the framing up into a close-up — so instead the full frame is
  // shown letterboxed, uncropped, at its own true aspect ratio.
  const isScreenPortrait = orientation === "portrait";
  const isStreamPortrait = streamDims ? streamDims.height > streamDims.width : null;
  const mismatch = isStreamPortrait !== null && isStreamPortrait !== isScreenPortrait;

  const containerAspect = mismatch && streamDims
    ? streamDims.width / streamDims.height
    : (isScreenPortrait ? 9 / 16 : 16 / 9);

  const videoFitClass = mismatch ? "object-contain" : "object-cover";

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-black">
      {/* ── Hidden file input ─────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ── Camera viewport ──────────────────────────────────────────────────
          Orientation matches → fixed 9:16 / 16:9 box, object-cover (small,
          honest crop). Orientation mismatched → box sized to the stream's own
          real aspect ratio, object-contain (full FoV, letterboxed, zero crop,
          zero zoom). ─────────────────────────────────────────────────────── */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          aspectRatio: containerAspect,
          width:    containerAspect >= 1 ? "100%" : "auto",
          height:   containerAspect >= 1 ? "auto" : "100%",
          maxWidth:  "100%",
          maxHeight: "100%",
        }}
      >
        {/* ── Live camera feed — always mounted ──────────────────────────── */}
        <video
          ref={liveVideoRef}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          className={`absolute inset-0 h-full w-full ${videoFitClass} transition-opacity duration-200 ${isLive ? "opacity-100" : "opacity-0"}`}
          style={{ transform: videoTransform, transformOrigin: "center center" }}
        />

        {/* ── Watermarked preview — the recorded file is the stream's native ──
            resolution untouched, so object-contain always shows it in full ── */}
        {isPreview && previewUrl && (
          <video
            ref={previewVideoRef}
            autoPlay
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </div>

      {/* ── DEBUG — actual stream resolution, remove once orientation behavior
          is confirmed on target devices ─────────────────────────────────── */}
      {isLive && (
        <div
          className="absolute bottom-2 left-2 z-30 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-white/50"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {streamDims ? `${streamDims.width}x${streamDims.height}${mismatch ? " (mismatch)" : ""}` : "…"}
        </div>
      )}

      {/* ── Registration highlight — full-screen, covers everything else ─── */}
      {showHighlight && (
        <RegistrationHighlight videoBlob={rawBlobRef.current} stageIndex={highlightStage} />
      )}

      {/* ── Resolution fallback notice ─────────────────────────────────────── */}
      {resolutionNotice && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs font-medium text-white backdrop-blur-md"
          style={{ top: "max(6rem, calc(env(safe-area-inset-top, 0px) + 4.5rem))" }}
        >
          {resolutionNotice}
        </div>
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
            onClick={() => startCamera(facingMode, resolutionMode)}
            className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-600 shadow-xl shadow-orange-900/60 active:scale-95"
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
          <Spinner className="h-14 w-14 text-orange-400" />
          <div className="w-full max-w-xs space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-500"
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
          TOP BAR — back / flip / watermark ID
      ════════════════════════════════════════════════════════════════════ */}
      {(isLive || isPreview) && !isRecording && (
        <div
          className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4"
          style={{ paddingTop: "max(3rem, calc(env(safe-area-inset-top, 0px) + 1.5rem))" }}
        >
          <div className="flex items-center gap-2">
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

            {/* Bio-sensor status — no landmarks ever drawn on the face itself */}
            {captureState === "ready" && bioSensorReady && (
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 backdrop-blur-md">
                <span
                  className={`h-2 w-2 rounded-full ${
                    faceDetected ? "animate-pulse bg-orange-500" : "bg-zinc-500"
                  }`}
                />
                <span className="text-xs font-medium text-white/70">생체 인식 중</span>
              </div>
            )}
          </div>

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
          BOTTOM — record + controls
      ════════════════════════════════════════════════════════════════════ */}
      {isLive && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          style={{ paddingBottom: "max(2.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))" }}
        >
          <div className="bg-gradient-to-t from-black/80 to-transparent pt-16">
            {/* Voice waveform — recording preview only, sits well below any
                face framing and is never part of the saved video. */}
            {isRecording && (
              <div className="mb-5 flex justify-center px-10">
                <canvas
                  ref={waveformCanvasRef}
                  width={280}
                  height={24}
                  className="h-6 w-full max-w-xs"
                />
              </div>
            )}
            <div className="flex items-end justify-center gap-10">
              {/* Left: file upload + resolution toggle (ready) or spacer (recording) */}
              {captureState === "ready" ? (
                <div className="flex flex-col items-center gap-2">
                  {/* Resolution toggle — hidden entirely while recording, so it
                      can never be changed mid-capture. */}
                  <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur-md">
                    <button
                      onClick={() => changeResolutionMode("standard")}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        resolutionMode === "standard" ? "bg-white text-black" : "text-white/70"
                      }`}
                    >
                      표준
                    </button>
                    <button
                      onClick={() => changeResolutionMode("high")}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        resolutionMode === "high" ? "bg-white text-black" : "text-white/70"
                      }`}
                    >
                      고화질
                    </button>
                  </div>
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
                </div>
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
          <div className="max-h-[85vh] overflow-y-auto bg-gradient-to-t from-black/95 via-black/65 to-transparent px-5 pt-20">

            {/* Registration error */}
            {error && registerState === "idle" && (
              <div className="mb-3 rounded-xl border border-red-800/60 bg-red-950/50 px-4 py-3 text-xs text-red-300">
                ⚠️ {error}
              </div>
            )}

            {registerState === "idle" && (
              <div className="flex flex-col gap-3">
                {/* Content type selector */}
                <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
                  <p className="mb-2.5 text-center text-xs font-medium text-white/70">이 영상은 어떤 모습인가요?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setContentType("self")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                        contentType === "self"
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-white/15 text-white/70"
                      }`}
                    >
                      🙋 내 모습 그대로
                    </button>
                    <button
                      onClick={() => setContentType("character")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                        contentType === "character"
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-white/15 text-white/70"
                      }`}
                    >
                      🎭 내가 만든 캐릭터
                    </button>
                  </div>
                </div>

                {/* Owner name (required) */}
                <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
                  <label className="mb-1.5 block text-xs font-medium text-white/70">
                    소유자 이름 <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="예: 한우진"
                    className="h-12 w-full rounded-xl bg-white/10 px-4 text-base text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Performance type (required) */}
                <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
                  <p className="mb-2.5 text-xs font-medium text-white/70">
                    퍼포먼스 유형 <span className="text-orange-400">*</span>
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PERFORMANCE_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setPerformanceType(type)}
                        className={`flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                          performanceType === type
                            ? "bg-orange-600 text-white shadow-md"
                            : "bg-white/15 text-white/70"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Genre (optional, placeholder depends on performance type) */}
                <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
                  <label className="mb-1.5 block text-xs font-medium text-white/70">장르 (선택)</label>
                  <input
                    type="text"
                    value={performanceGenre}
                    onChange={(e) => setPerformanceGenre(e.target.value)}
                    placeholder={performanceType ? GENRE_PLACEHOLDER[performanceType] : "퍼포먼스 유형을 먼저 선택하세요"}
                    className="h-12 w-full rounded-xl bg-white/10 px-4 text-base text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Character name (optional, character content type only) */}
                {contentType === "character" && (
                  <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
                    <label className="mb-1.5 block text-xs font-medium text-white/70">캐릭터 이름 (선택)</label>
                    <input
                      type="text"
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="h-12 w-full rounded-xl bg-white/10 px-4 text-base text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                )}

                <button
                  onClick={registerBioIP}
                  disabled={!canRegister}
                  className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-600 text-base font-bold text-white shadow-lg shadow-orange-900/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40 disabled:shadow-none"
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

            {/* registerState === "working" has no UI here — the full-screen
                RegistrationHighlight overlay (z-50) covers the whole screen
                for the entire duration instead. */}

            {registerState === "done" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-emerald-300">
                  {contentType === "character"
                    ? "🎭 캐릭터 IP 등록 완료! 저작권으로 보호됩니다."
                    : "🙋 본인 Bio-IP 등록 완료! 퍼블리시티권으로 보호됩니다."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
