/**
 * Canvas-based video watermarking.
 *
 * Flow:
 *  1. Decode source blob into a hidden <video> element (muted for autoplay policy).
 *  2. Drive a <canvas> per-frame via requestAnimationFrame.
 *  3. Draw the original frame + watermark overlay on the canvas.
 *  4. Re-encode via MediaRecorder on canvas.captureStream().
 *  5. Return the watermarked blob.
 *
 * Falls back to source blob if re-encoding is unavailable or times out.
 *
 * Key fixes vs. original:
 *  - video.muted = true  (autoplay policy: unmuted programmatic play is blocked)
 *  - isFinite(duration) check (MediaRecorder webm has duration = Infinity)
 *  - Elapsed-time progress fallback when duration is unknown
 *  - 30-second hard timeout
 *  - console.error on every failure path
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatermarkOptions {
  uniqueId?:   string;
  logoText?:   string;
  date?:       Date;
  opacity?:    number;       // 0–1, default 0.85
  fps?:        number;       // canvas capture fps, default 30
  onProgress?: (ratio: number) => void;   // 0 → 1
}

export interface WatermarkResult {
  blob:        Blob;
  uniqueId:    string;
  mimeType:    string;
  durationMs:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateWatermarkId(): string {
  let id = "BIP-";
  for (let i = 0; i < 8; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return id;
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawWatermark(
  ctx:      CanvasRenderingContext2D,
  cw:       number,
  ch:       number,
  uniqueId: string,
  dateStr:  string,
  logoText: string,
  opacity:  number,
): void {
  const scale     = Math.min(cw / 1080, 1);
  const pad       = Math.round(16 * scale + 4);
  const logoSize  = Math.round(Math.max(13, 17 * scale));
  const metaSize  = Math.round(Math.max(10, 13 * scale));
  const lineGap   = Math.round(metaSize * 1.55);
  const innerPadX = Math.round(12 * scale);
  const innerPadY = Math.round(8  * scale);

  ctx.font = `700 ${logoSize}px -apple-system, system-ui, Arial, sans-serif`;
  const logoW   = ctx.measureText(logoText).width;
  ctx.font = `${metaSize}px monospace`;
  const idW     = ctx.measureText(uniqueId).width;
  const dateW   = ctx.measureText(dateStr).width;
  const maxTextW = Math.max(logoW, idW, dateW);

  const bgW = maxTextW + innerPadX * 2;
  const bgH = logoSize + lineGap * 2 + innerPadY * 2;
  const bgX = cw - bgW - pad;
  const bgY = ch - bgH - pad;

  ctx.save();

  ctx.globalAlpha = opacity * 0.72;
  ctx.fillStyle   = "rgba(0, 0, 0, 0.65)";
  fillRoundRect(ctx, bgX, bgY, bgW, bgH, 6);

  ctx.globalAlpha  = opacity;
  ctx.textBaseline = "top";
  ctx.textAlign    = "left";
  const tx = bgX + innerPadX;

  ctx.fillStyle = "#ffffff";
  ctx.font      = `700 ${logoSize}px -apple-system, system-ui, Arial, sans-serif`;
  ctx.fillText(logoText, tx, bgY + innerPadY);

  ctx.fillStyle = "#cccccc";
  ctx.font      = `${metaSize}px monospace`;
  ctx.fillText(uniqueId, tx, bgY + innerPadY + logoSize + (lineGap - metaSize) / 2);
  ctx.fillText(dateStr,  tx, bgY + innerPadY + logoSize + lineGap + (lineGap - metaSize) / 2);

  ctx.restore();
}

// ─── MIME detection ───────────────────────────────────────────────────────────

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

// ─── Core API ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30_000;

export async function applyWatermark(
  sourceBlob: Blob,
  options:    WatermarkOptions = {},
): Promise<WatermarkResult> {
  const {
    uniqueId:   providedId,
    logoText  = "BIO-IP PLAY",
    date      = new Date(),
    opacity   = 0.85,
    fps       = 30,
    onProgress,
  } = options;

  const uniqueId = providedId ?? generateWatermarkId();
  const dateStr  = date.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  const mimeType = pickMimeType();
  const wallStart = Date.now();

  // ── 1. Hidden video element ───────────────────────────────────────────────────
  const video = document.createElement("video");
  video.playsInline = true;
  // FIX: must be muted — browsers block programmatic play() on unmuted elements
  // without a user gesture. Muting lets autoplay succeed.
  video.muted = true;
  video.src   = URL.createObjectURL(sourceBlob);

  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = (e) => {
      console.error("[watermark] loadedmetadata error:", e);
      resolve(); // continue anyway with defaults
    };
    setTimeout(resolve, 3000); // safety: iOS can be slow
  });

  const cw = video.videoWidth  || 1280;
  const ch = video.videoHeight || 720;

  // FIX: MediaRecorder webm files have duration = Infinity — guard against it.
  const videoDuration = isFinite(video.duration) && video.duration > 0
    ? video.duration
    : 0;

  // ── 2. Canvas ─────────────────────────────────────────────────────────────────
  const canvas  = document.createElement("canvas");
  canvas.width  = cw;
  canvas.height = ch;
  const ctx     = canvas.getContext("2d")!;

  // ── 3. Streams ────────────────────────────────────────────────────────────────
  const canvasStream = canvas.captureStream(fps);

  // ── 4. MediaRecorder ──────────────────────────────────────────────────────────
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(
    canvasStream,
    mimeType ? { mimeType } : undefined,
  );
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  // ── 5. Main promise with timeout ──────────────────────────────────────────────
  return new Promise<WatermarkResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(video.src);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      console.error("[watermark] failed:", err.message);
      cleanup();
      reject(err);
    };

    const succeed = (blob: Blob) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ blob, uniqueId, mimeType: mimeType || "video/webm", durationMs: Date.now() - wallStart });
    };

    // Hard timeout — user gets an error instead of infinite spinner
    const timeoutId = setTimeout(() => {
      console.error("[watermark] Timeout after 30s");
      try { recorder.stop(); } catch {}
      fail(new Error("워터마크 처리 시간 초과 (30초). 짧은 영상으로 다시 시도해주세요."));
    }, TIMEOUT_MS);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      succeed(blob);
    };

    recorder.onerror = (e) => {
      console.error("[watermark] MediaRecorder error:", e);
      fail(new Error("MediaRecorder 오류가 발생했습니다."));
    };

    // ── 6. Frame drawing loop ─────────────────────────────────────────────────────
    const drawFrame = () => {
      if (settled || video.paused || video.ended) return;

      try {
        ctx.drawImage(video, 0, 0, cw, ch);
        drawWatermark(ctx, cw, ch, uniqueId, dateStr, logoText, opacity);
      } catch (e) {
        console.error("[watermark] drawFrame error:", e);
      }

      // Progress reporting
      if (videoDuration > 0) {
        // Known duration: report exact ratio
        onProgress?.(Math.min(video.currentTime / videoDuration, 0.99));
      } else {
        // Unknown duration (webm): estimate from wall-clock elapsed
        // Assume encoding takes ~1.5× real-time playback speed, cap at 95%
        const elapsedSec = (Date.now() - wallStart) / 1000;
        const estimatedTotal = Math.max(video.currentTime * 1.5 + 2, 5);
        onProgress?.(Math.min(elapsedSec / estimatedTotal, 0.95));
      }

      requestAnimationFrame(drawFrame);
    };

    video.onplay  = () => { drawFrame(); };
    video.onended = () => {
      try {
        ctx.drawImage(video, 0, 0, cw, ch);
        drawWatermark(ctx, cw, ch, uniqueId, dateStr, logoText, opacity);
      } catch {}
      onProgress?.(1);
      recorder.stop();
    };
    video.onerror = (e) => {
      console.error("[watermark] video error during playback:", e);
      fail(new Error("영상 재생 중 오류가 발생했습니다."));
    };

    recorder.start(200);

    video.play().catch((err: Error) => {
      console.error("[watermark] video.play() rejected:", err);
      fail(new Error(`영상 재생 실패: ${err?.message ?? String(err)}`));
    });
  });
}
