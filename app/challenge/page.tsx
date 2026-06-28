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

// ─── Types ────────────────────────────────────────────────────────────────────

type CaptureState    = "idle" | "ready" | "recording" | "preview";
type RegisterState   = "idle" | "signing" | "registering" | "done";
type AnalysisState   = "idle" | "extracting" | "done" | "error";

const REGISTER_STEPS: { key: RegisterState; label: string; doneLabel: string }[] = [
  { key: "signing",     label: "서명 생성 중...",    doneLabel: "서명 생성됨" },
  { key: "registering", label: "블록체인 등록 중...", doneLabel: "블록체인 등록됨" },
  { key: "done",        label: "등록 완료!",          doneLabel: "등록 완료!" },
];

const INTERACTION_STYLE_META: Record<string, { label: string; className: string }> = {
  expansive:  { label: "확장형",   className: "bg-violet-900/60 text-violet-300" },
  moderate:   { label: "보통",     className: "bg-blue-900/60 text-blue-300" },
  contained:  { label: "절제형",   className: "bg-zinc-700 text-zinc-300" },
  asymmetric: { label: "비대칭형", className: "bg-amber-900/60 text-amber-300" },
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}초` : `${Math.round(ms)}ms`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function WarnIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: CaptureState }) {
  const map: Record<CaptureState, { label: string; cls: string }> = {
    idle:      { label: "대기",    cls: "bg-zinc-700 text-zinc-300" },
    ready:     { label: "준비됨",  cls: "bg-blue-900 text-blue-300" },
    recording: { label: "녹화 중", cls: "bg-red-900 text-red-300" },
    preview:   { label: "완료",    cls: "bg-emerald-900 text-emerald-300" },
  };
  const { label, cls } = map[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {state === "recording" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
      {label}
    </span>
  );
}

// ─── Visual extraction panel ──────────────────────────────────────────────────

function VisualPanel({
  state, result, error,
}: {
  state: AnalysisState;
  result: ExtractionResult | null;
  error: string | null;
}) {
  if (state === "idle") return null;

  const borderCls =
    state === "extracting" ? "border-violet-800/60 bg-violet-950/30" :
    state === "done"       ? "border-emerald-800/60 bg-emerald-950/20" :
                             "border-red-800/60 bg-red-950/20";

  return (
    <div className={`rounded-2xl border px-5 py-4 space-y-3 ${borderCls}`}>
      <div className="flex items-center gap-2.5">
        {state === "extracting" && <Spinner className="h-4 w-4 text-violet-400" />}
        {state === "done"       && <CheckIcon className="h-4 w-4 text-emerald-400" />}
        {state === "error"      && <WarnIcon  className="h-4 w-4 text-red-400" />}
        <p className={`text-sm font-semibold ${
          state === "extracting" ? "text-violet-300" :
          state === "done"       ? "text-emerald-300" : "text-red-300"
        }`}>
          {state === "extracting" && "시각·음성 레이어 분석 중…"}
          {state === "done"       && "시각 레이어 분석 완료"}
          {state === "error"      && "시각 분석 실패"}
        </p>
        {state === "extracting" && (
          <span className="ml-auto text-xs text-zinc-600">FaceMesh + Pose</span>
        )}
      </div>

      {state === "extracting" && (
        <p className="text-xs text-zinc-500">CDN 모델 로드 및 얼굴·신체 랜드마크 추출 중입니다.</p>
      )}
      {state === "error" && error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {state === "done" && result && (
        <div className="space-y-3">
          <div className="flex gap-3">
            {[
              { v: result.faceLandmarkCount, l: "얼굴 랜드마크" },
              { v: result.poseLandmarkCount, l: "신체 관절" },
              { v: result.signature.faceGeometry.length, l: "좌표 벡터" },
            ].map(({ v, l }) => (
              <div key={l} className="rounded-lg bg-zinc-900/60 px-3 py-2 text-center">
                <p className="text-lg font-bold text-white">{v}</p>
                <p className="text-[10px] text-zinc-500">{l}</p>
              </div>
            ))}
          </div>
          {result.signature.expressionRange.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">감지된 표정</p>
              <div className="flex flex-wrap gap-1.5">
                {result.signature.expressionRange.map((l) => (
                  <span key={l} className="rounded-md bg-violet-900/40 px-2 py-0.5 font-mono text-[11px] text-violet-300">{l}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 font-mono text-[11px] text-zinc-600">
            <span>skin: <span className="text-zinc-400">{result.signature.skinTexture}</span></span>
            <span>style: <span className="text-zinc-400">{result.signature.styleFingerprint}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dynamics analysis panel ──────────────────────────────────────────────────

function DynamicsPanel({
  state, result, frameCount,
}: {
  state: AnalysisState;
  result: GeneratorResult | null;
  frameCount: number;
}) {
  if (state === "idle") return null;

  const borderCls =
    state === "extracting" ? "border-blue-800/60 bg-blue-950/30" :
    state === "done"       ? "border-cyan-800/60 bg-cyan-950/20" :
                             "border-red-800/60 bg-red-950/20";

  const sig  = result?.signature;
  const info = result?.analysis;
  const styleMeta = sig
    ? (INTERACTION_STYLE_META[sig.interactionStyle] ?? INTERACTION_STYLE_META["contained"])
    : null;

  return (
    <div className={`rounded-2xl border px-5 py-4 space-y-3 ${borderCls}`}>
      <div className="flex items-center gap-2.5">
        {state === "extracting" && <Spinner className="h-4 w-4 text-blue-400" />}
        {state === "done"       && <CheckIcon className="h-4 w-4 text-cyan-400" />}
        {state === "error"      && <WarnIcon  className="h-4 w-4 text-red-400" />}
        <p className={`text-sm font-semibold ${
          state === "extracting" ? "text-blue-300" :
          state === "done"       ? "text-cyan-300" : "text-red-300"
        }`}>
          {state === "extracting" && "다이내믹스 레이어 분석 중…"}
          {state === "done"       && "다이내믹스 레이어 분석 완료"}
          {state === "error"      && "다이내믹스 분석 실패"}
        </p>
        {state === "done" && result && (
          <span className="ml-auto text-xs text-zinc-600">
            {result.frameCount}프레임 · {formatMs(result.durationMs)}
          </span>
        )}
      </div>

      {state === "extracting" && (
        <p className="text-xs text-zinc-500">
          수집된 {frameCount}개 프레임에서 속도·가속도·관절 각도 분석 중입니다.
        </p>
      )}

      {state === "done" && sig && info && (
        <div className="space-y-3">
          {/* Stats row */}
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-center">
              <p className="font-mono text-lg font-bold text-white">
                {sig.movementTempo > 0 ? sig.movementTempo : "—"}
              </p>
              <p className="text-[10px] text-zinc-500">BPM</p>
            </div>
            <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-center">
              <p className="font-mono text-lg font-bold text-white">{info.peakFrames.length}</p>
              <p className="text-[10px] text-zinc-500">모션 피크</p>
            </div>
            <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-center">
              <p className="font-mono text-lg font-bold text-white">
                {info.dominantPeriodMs > 0 ? formatMs(info.dominantPeriodMs) : "—"}
              </p>
              <p className="text-[10px] text-zinc-500">주기</p>
            </div>
            {styleMeta && (
              <div className="flex items-center">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styleMeta.className}`}>
                  {styleMeta.label}
                </span>
              </div>
            )}
          </div>

          {/* Gesture vocabulary */}
          {sig.gestureVocabulary.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">감지된 제스처</p>
              <div className="flex flex-wrap gap-1.5">
                {sig.gestureVocabulary.map((g) => (
                  <span key={g} className="rounded-md bg-cyan-900/40 px-2 py-0.5 font-mono text-[11px] text-cyan-300">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Microexpressions */}
          {sig.microexpressions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">마이크로 표정 (FACS)</p>
              <div className="flex flex-wrap gap-1.5">
                {sig.microexpressions.map((au) => (
                  <span key={au} className="rounded-md bg-violet-900/40 px-2 py-0.5 font-mono text-[11px] text-violet-300">{au}</span>
                ))}
              </div>
            </div>
          )}

          {/* Posture baseline (first 4 joints with labels) */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">자세 기준 벡터 (도°)</p>
            <div className="flex flex-wrap gap-1.5">
              {["L팔꿈치", "R팔꿈치", "L어깨", "R어깨", "L고관절", "R고관절", "L무릎", "R무릎"].map((label, i) => (
                <span key={label} className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                  {label} {sig.postureBaseline[i]?.toFixed(1) ?? "—"}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const router = useRouter();

  // Capture state
  const [captureState,  setCaptureState]  = useState<CaptureState>("idle");
  const [registerState, setRegisterState] = useState<RegisterState>("idle");
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null);
  const [elapsed,       setElapsed]       = useState(0);
  const [error,         setError]         = useState<string | null>(null);
  const [audioLevel,    setAudioLevel]    = useState(0);

  // Visual extraction
  const [visualState,  setVisualState]  = useState<AnalysisState>("idle");
  const [visualResult, setVisualResult] = useState<ExtractionResult | null>(null);
  const [visualError,  setVisualError]  = useState<string | null>(null);
  const visualResultRef = useRef<ExtractionResult | null>(null);

  // Dynamics analysis
  const [dynamicsState,  setDynamicsState]  = useState<AnalysisState>("idle");
  const [dynamicsResult, setDynamicsResult] = useState<GeneratorResult | null>(null);

  // DOM refs
  const liveVideoRef    = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Recording internals
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const chunksRef          = useRef<Blob[]>([]);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturedFramesRef  = useRef<CaptureFrame[]>([]);
  const recordingStartRef  = useRef(0);
  const isCapturingFrameRef = useRef(false);

  // Audio meter
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const animFrameRef  = useRef<number | null>(null);

  // ── Audio meter ────────────────────────────────────────────────────────────
  const startAudioMeter = useCallback((stream: MediaStream) => {
    const ctx      = new AudioContext();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setAudioLevel(Math.min(100, (avg / 128) * 100));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);
  }, []);

  // ── Enable camera ──────────────────────────────────────────────────────────
  const enableCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      startAudioMeter(stream);
      setCaptureState("ready");
    } catch {
      setError("카메라 또는 마이크 권한이 거부되었습니다.");
    }
  }, [startAudioMeter]);

  // ── Per-frame landmark capture (runs during recording) ─────────────────────
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

  // ── Visual extraction (runs after recording stops) ─────────────────────────
  const runVisualExtraction = useCallback(async () => {
    const video = liveVideoRef.current;
    if (!video) return;
    setVisualState("extracting");
    setVisualError(null);
    try {
      const result = await extractVisualSignature(video);
      visualResultRef.current = result;
      setVisualResult(result);
      setVisualState("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setVisualError(`시각 추출 실패: ${msg}`);
      setVisualState("error");
    }
  }, []);

  // ── Dynamics analysis (synchronous — runs on collected frames) ─────────────
  const runDynamicsAnalysis = useCallback(() => {
    const frames = capturedFramesRef.current;
    if (frames.length < 2) return;
    setDynamicsState("extracting");
    // requestAnimationFrame lets React flush "extracting" state before CPU work
    requestAnimationFrame(() => {
      try {
        const result = generateDynamicsSignature(frames);
        setDynamicsResult(result);
        setDynamicsState("done");
      } catch {
        setDynamicsState("error");
      }
    });
  }, []);

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current       = [];
    capturedFramesRef.current = [];
    recordingStartRef.current = Date.now();

    const mimeType =
      ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      setPreviewUrl(URL.createObjectURL(blob));
      setCaptureState("preview");
      // Run both analyses concurrently; visual uses the still-live stream frame
      runVisualExtraction();
      runDynamicsAnalysis();
    };

    recorder.start(100);
    setElapsed(0);
    setCaptureState("recording");
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

    // Capture landmark frames every 200 ms (≈ 5 fps)
    frameIntervalRef.current = setInterval(() => { captureFrame(); }, 200);
  }, [captureFrame, runVisualExtraction, runDynamicsAnalysis]);

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current)       clearInterval(timerRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsed(0);
    setVisualState("idle");  setVisualResult(null);  setVisualError(null);
    setDynamicsState("idle"); setDynamicsResult(null);
    setRegisterState("idle");
    visualResultRef.current   = null;
    capturedFramesRef.current = [];
    setCaptureState("ready");
  }, [previewUrl]);

  // ── Bio-IP registration ────────────────────────────────────────────────────
  const registerBioIP = useCallback(async () => {
    setRegisterState("signing");
    if (!visualResultRef.current && liveVideoRef.current) {
      try {
        const r = await extractVisualSignature(liveVideoRef.current);
        visualResultRef.current = r;
        setVisualResult(r);
        setVisualState("done");
      } catch { /* proceed without */ }
    } else {
      await new Promise((r) => setTimeout(r, 700));
    }
    setRegisterState("registering");
    // TODO: persist visualResultRef.current + dynamicsResult to Supabase
    await new Promise((r) => setTimeout(r, 2000));
    setRegisterState("done");
    await new Promise((r) => setTimeout(r, 800));
    router.push("/my-bio-ip");
  }, [router]);

  // ── Download ───────────────────────────────────────────────────────────────
  const downloadRecording = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl; a.download = `bio-challenge-${Date.now()}.webm`; a.click();
  }, [previewUrl]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current)        clearInterval(timerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      stopAudioMeter();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      disposeMediaPipe();
    };
  }, [stopAudioMeter]);

  // ── Sync preview src ───────────────────────────────────────────────────────
  useEffect(() => {
    if (previewVideoRef.current && previewUrl) previewVideoRef.current.src = previewUrl;
  }, [previewUrl]);

  const isLive    = captureState === "ready" || captureState === "recording";
  const isPreview = captureState === "preview";
  const isAnalyzing = visualState === "extracting" || dynamicsState === "extracting";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bio-IP Challenge Capture</h1>
            <p className="mt-0.5 text-sm text-zinc-400">웹캠·마이크 녹화 + 생체 서명 자동 분석</p>
          </div>
          <StatusBadge state={captureState} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {/* Video area */}
        <div className={`grid gap-4 ${isPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* Live feed */}
          <div className="space-y-2">
            {isLive && <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">라이브</p>}
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
              {captureState === "idle" ? (
                <div className="flex flex-col items-center gap-3 px-8 text-center">
                  <svg className="h-16 w-16 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  <p className="text-sm text-zinc-400">카메라와 마이크 접근을 허용하면 라이브 영상이 표시됩니다</p>
                </div>
              ) : (
                <video ref={liveVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              )}
              {captureState === "recording" && (
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="font-mono text-sm font-semibold">{formatTime(elapsed)}</span>
                </div>
              )}
              {captureState === "recording" && capturedFramesRef.current.length > 0 && (
                <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                  <span className="font-mono text-xs text-cyan-400">{capturedFramesRef.current.length}f</span>
                </div>
              )}
            </div>
            {isLive && (
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
                </svg>
                <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-75" style={{ width: `${audioLevel}%` }} />
                </div>
                <span className="w-8 text-right text-xs text-zinc-500">{Math.round(audioLevel)}%</span>
              </div>
            )}
          </div>

          {/* Preview */}
          {isPreview && previewUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">녹화본</p>
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
                <video ref={previewVideoRef} controls playsInline className="h-full w-full object-cover" />
              </div>
            </div>
          )}
        </div>

        {/* Analysis panels (2-column on desktop) */}
        {isPreview && (
          <div className="grid gap-4 lg:grid-cols-2">
            <VisualPanel
              state={visualState}
              result={visualResult}
              error={visualError}
            />
            <DynamicsPanel
              state={dynamicsState}
              result={dynamicsResult}
              frameCount={capturedFramesRef.current.length}
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {captureState === "idle" && (
            <button onClick={enableCamera}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-95">
              카메라 활성화
            </button>
          )}
          {captureState === "ready" && (
            <button onClick={startRecording}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95">
              <span className="h-2.5 w-2.5 rounded-full bg-white" /> 녹화 시작
            </button>
          )}
          {captureState === "recording" && (
            <button onClick={stopRecording}
              className="flex items-center gap-2 rounded-xl bg-zinc-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-600 active:scale-95">
              <span className="h-2.5 w-2.5 rounded-sm bg-white" /> 녹화 정지
            </button>
          )}

          {captureState === "preview" && registerState === "idle" && (
            <>
              <button onClick={reset}
                className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white active:scale-95">
                다시 녹화
              </button>
              <button onClick={downloadRecording}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-95">
                다운로드
              </button>
              <button onClick={registerBioIP} disabled={isAnalyzing}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition active:scale-95 ${
                  isAnalyzing
                    ? "cursor-not-allowed bg-violet-800/40 opacity-60"
                    : "bg-violet-600 hover:bg-violet-500"
                }`}>
                {isAnalyzing ? (
                  <><Spinner className="h-4 w-4 text-violet-300" /> 분석 중…</>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    Bio-IP 등록
                  </>
                )}
              </button>
            </>
          )}

          {captureState === "preview" && registerState !== "idle" && (
            <div className="w-full max-w-sm space-y-3">
              {REGISTER_STEPS.map(({ key, label, doneLabel }) => {
                const stepOrder   = REGISTER_STEPS.findIndex((s) => s.key === key);
                const activeOrder = REGISTER_STEPS.findIndex((s) => s.key === registerState);
                const isActive    = key === registerState;
                const isDone      = stepOrder < activeOrder || registerState === "done";
                return (
                  <div key={key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    isActive ? "border-violet-600 bg-violet-950/40" :
                    isDone   ? "border-emerald-800 bg-emerald-950/30" :
                               "border-zinc-800 bg-zinc-900/40 opacity-40"
                  }`}>
                    <span className="flex-shrink-0">
                      {isDone   ? <CheckIcon className="h-5 w-5 text-emerald-400" />
                       : isActive ? <Spinner className="h-5 w-5 text-violet-400" />
                       : <span className="block h-5 w-5 rounded-full border-2 border-zinc-700" />}
                    </span>
                    <span className={`text-sm font-medium ${isDone ? "text-emerald-300" : isActive ? "text-violet-200" : "text-zinc-500"}`}>
                      {isDone ? doneLabel : label}
                    </span>
                    {isActive && <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-violet-400" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-zinc-600">
          {captureState === "idle"      && "카메라 활성화 버튼을 눌러 시작하세요."}
          {captureState === "ready"     && "준비됨. 녹화 시작 버튼을 누르세요."}
          {captureState === "recording" && `녹화 중 · ${capturedFramesRef.current.length}개 프레임 수집됨.`}
          {captureState === "preview" && registerState === "idle" && isAnalyzing     && "생체 신호를 분석하고 있습니다…"}
          {captureState === "preview" && registerState === "idle" && !isAnalyzing    && "분석 완료. Bio-IP를 등록하거나 다운로드하세요."}
          {captureState === "preview" && registerState === "signing"     && "추출된 시각·다이내믹스 서명으로 서명 생성 중…"}
          {captureState === "preview" && registerState === "registering" && "블록체인에 자산을 기록하고 있습니다…"}
          {captureState === "preview" && registerState === "done"        && "등록 완료! My Bio-IP로 이동합니다."}
        </p>
      </div>
    </main>
  );
}
