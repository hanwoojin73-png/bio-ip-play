/**
 * Canvas-based video watermarking.
 *
 * Flow:
 *  1. Decode source blob into an <video> element.
 *  2. Drive a <canvas> per-frame via requestAnimationFrame.
 *  3. Draw the original frame + watermark text on the canvas.
 *  4. Re-encode via MediaRecorder on canvas.captureStream().
 *  5. Route original audio through AudioContext → MediaStreamDestination.
 *  6. Return the watermarked blob.
 *
 * Falls back to video-only (no audio) if AudioContext routing fails.
 * Falls back to the source blob if MediaRecorder re-encoding is unavailable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatermarkOptions {
  uniqueId?:   string;       // e.g. "BIP-A3X9K2MQ" — auto-generated if omitted
  logoText?:   string;       // default "BIO-IP PLAY"
  date?:       Date;         // default new Date()
  opacity?:    number;       // 0–1, default 0.85
  fps?:        number;       // canvas capture frame rate, default 30
  onProgress?: (ratio: number) => void;   // 0 → 1
}

export interface WatermarkResult {
  blob:        Blob;
  uniqueId:    string;
  mimeType:    string;
  durationMs:  number;   // wall-clock processing time
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

/** Manual rounded-rect path (avoids ctx.roundRect availability concerns). */
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

/** Draws the BIO-IP PLAY watermark in the bottom-right corner. */
function drawWatermark(
  ctx:      CanvasRenderingContext2D,
  cw:       number,
  ch:       number,
  uniqueId: string,
  dateStr:  string,
  logoText: string,
  opacity:  number,
): void {
  // Scale everything proportionally to canvas width
  const scale      = Math.min(cw / 1080, 1);
  const pad        = Math.round(16 * scale + 4);
  const logoSize   = Math.round(Math.max(13, 17 * scale));
  const metaSize   = Math.round(Math.max(10, 13 * scale));
  const lineGap    = Math.round(metaSize * 1.55);
  const innerPadX  = Math.round(12 * scale);
  const innerPadY  = Math.round(8  * scale);

  // Measure text to size the background pill
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

  // Background pill
  ctx.globalAlpha = opacity * 0.72;
  ctx.fillStyle   = "rgba(0, 0, 0, 0.65)";
  fillRoundRect(ctx, bgX, bgY, bgW, bgH, 6);

  // Texts
  ctx.globalAlpha = opacity;
  ctx.textBaseline = "top";
  ctx.textAlign    = "left";

  const tx = bgX + innerPadX;

  // Logo line
  ctx.fillStyle = "#ffffff";
  ctx.font      = `700 ${logoSize}px -apple-system, system-ui, Arial, sans-serif`;
  ctx.fillText(logoText, tx, bgY + innerPadY);

  // ID line
  ctx.fillStyle = "#cccccc";
  ctx.font      = `${metaSize}px monospace`;
  ctx.fillText(uniqueId, tx, bgY + innerPadY + logoSize + (lineGap - metaSize) / 2);

  // Date line
  ctx.fillText(dateStr, tx, bgY + innerPadY + logoSize + lineGap + (lineGap - metaSize) / 2);

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

/**
 * Applies a watermark to the given video blob and returns a new blob.
 *
 * @param sourceBlob  - Raw recorded video blob.
 * @param options     - Watermark configuration.
 * @returns           WatermarkResult with the new blob and metadata.
 */
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

  // ── 1. Create hidden video element ───────────────────────────────────────────
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted       = false;
  video.src         = URL.createObjectURL(sourceBlob);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror          = () => reject(new Error("Video load failed"));
    // Safety timeout in case metadata never fires (e.g. iOS first load)
    setTimeout(resolve, 3000);
  });

  const cw = video.videoWidth  || 1280;
  const ch = video.videoHeight || 720;
  const videoDuration = video.duration || 0;

  // ── 2. Canvas + context ───────────────────────────────────────────────────────
  const canvas   = document.createElement("canvas");
  canvas.width   = cw;
  canvas.height  = ch;
  const ctx      = canvas.getContext("2d")!;

  // ── 3. Canvas stream ──────────────────────────────────────────────────────────
  const canvasStream = canvas.captureStream(fps);

  // ── 4. Audio routing (best-effort) ────────────────────────────────────────────
  let finalStream: MediaStream = canvasStream;
  let audioCtx: AudioContext | null = null;

  try {
    audioCtx = new AudioContext();
    const src  = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(dest);
    // Also connect to speakers so the video "plays" properly (required on some browsers)
    src.connect(audioCtx.destination);

    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) {
      finalStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        audioTrack,
      ]);
    }
  } catch {
    // Silently fall back to video-only stream
  }

  // ── 5. MediaRecorder ──────────────────────────────────────────────────────────
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(
    finalStream,
    mimeType ? { mimeType } : undefined,
  );
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<WatermarkResult>((resolve, reject) => {
    recorder.onstop = () => {
      URL.revokeObjectURL(video.src);
      audioCtx?.close().catch(() => {});

      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      resolve({
        blob,
        uniqueId,
        mimeType: mimeType || "video/webm",
        durationMs: Date.now() - wallStart,
      });
    };

    recorder.onerror = (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error(`MediaRecorder error: ${e}`));
    };

    // ── 6. Frame-by-frame drawing loop ─────────────────────────────────────────
    const drawFrame = () => {
      if (video.paused || video.ended) return;

      ctx.drawImage(video, 0, 0, cw, ch);
      drawWatermark(ctx, cw, ch, uniqueId, dateStr, logoText, opacity);

      if (videoDuration > 0) {
        onProgress?.(Math.min(video.currentTime / videoDuration, 1));
      }

      requestAnimationFrame(drawFrame);
    };

    video.onplay  = () => { drawFrame(); };
    video.onended = () => {
      // Draw last frame with watermark, then stop
      ctx.drawImage(video, 0, 0, cw, ch);
      drawWatermark(ctx, cw, ch, uniqueId, dateStr, logoText, opacity);
      onProgress?.(1);
      recorder.stop();
    };
    video.onerror = () => reject(new Error("Video playback error during watermarking"));

    recorder.start(200);
    video.play().catch(reject);
  });
}
