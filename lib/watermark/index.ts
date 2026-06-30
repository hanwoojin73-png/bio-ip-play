/**
 * Canvas-only watermarking — generates a watermarked JPEG thumbnail
 * from the last frame of a recorded video blob. No ffmpeg, no MediaRecorder.
 *
 * Flow:
 *  1. Load source Blob into a hidden <video>.
 *  2. Fix WebM Infinity duration via 1e101 seek trick.
 *  3. Seek to the last frame.
 *  4. Draw that frame + text watermark overlay onto a <canvas>.
 *  5. Export the canvas as a JPEG blob.
 *
 * The original video is preserved unchanged. Only the thumbnail carries
 * the visible watermark.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatermarkOptions {
  uniqueId?:    string;
  logoText?:    string;
  contentType?: "self" | "character";
  date?:        Date;
  opacity?:     number;                       // 0–1, default 0.85
  onProgress?:  (ratio: number) => void;      // 0 → 1
}

export interface WatermarkResult {
  blob:       Blob;          // JPEG thumbnail with watermark overlay
  uniqueId:   string;
  mimeType:   "image/jpeg";
  durationMs: number;
}

// ─── ID generation ────────────────────────────────────────────────────────────

const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateWatermarkId(): string {
  let id = "BIP-";
  for (let i = 0; i < 8; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return id;
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

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
  const logoW    = ctx.measureText(logoText).width;
  ctx.font = `${metaSize}px monospace`;
  const idW      = ctx.measureText(uniqueId).width;
  const dateW    = ctx.measureText(dateStr).width;
  const maxTextW = Math.max(logoW, idW, dateW);

  const bgW = maxTextW + innerPadX * 2;
  const bgH = logoSize + lineGap * 2 + innerPadY * 2;
  const bgX = cw - bgW - pad;
  const bgY = ch - bgH - pad;

  ctx.save();

  ctx.globalAlpha = opacity * 0.72;
  ctx.fillStyle   = "rgba(0,0,0,0.65)";
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

// ─── WebM duration fix ────────────────────────────────────────────────────────
// WebM files recorded by MediaRecorder have duration = Infinity.
// Seeking past the end forces the browser to clamp to the real duration.

async function fixWebMDuration(video: HTMLVideoElement): Promise<void> {
  if (isFinite(video.duration) && video.duration > 0) return;

  await new Promise<void>((resolve) => {
    const done = () => { video.onseeked = null; resolve(); };
    video.onseeked = done;
    setTimeout(done, 2500);
    video.currentTime = 1e101;
  });

  await new Promise<void>((resolve) => {
    const done = () => { video.onseeked = null; resolve(); };
    video.onseeked = done;
    setTimeout(done, 1000);
    video.currentTime = 0;
  });
}

// ─── Core API ─────────────────────────────────────────────────────────────────

export async function applyWatermark(
  sourceBlob: Blob,
  options:    WatermarkOptions = {},
): Promise<WatermarkResult> {
  const {
    uniqueId:    providedId,
    contentType = "self",
    date        = new Date(),
    opacity     = 0.85,
    onProgress,
  } = options;
  const logoText = options.logoText
    ?? (contentType === "character" ? "BIO-IP PLAY · 캐릭터IP" : "BIO-IP PLAY · 본인인증");

  const uniqueId = providedId ?? generateWatermarkId();
  const dateStr  = date.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const wallStart = Date.now();

  onProgress?.(0.05);

  // ── 1. Load video ────────────────────────────────────────────────────────────
  const video = document.createElement("video");
  video.muted       = true;
  video.playsInline = true;
  const objectUrl   = URL.createObjectURL(sourceBlob);
  video.src         = objectUrl;

  await new Promise<void>((resolve) => {
    const done = () => { video.onseeked = null; resolve(); };
    video.onseeked = done;
    video.onerror = () => done();
    setTimeout(done, 6000);
    video.currentTime = 0.5;
    video.load();
  });

  onProgress?.(0.25);

  // ── 2. Fix WebM Infinity duration ────────────────────────────────────────────
  try { await fixWebMDuration(video); } catch (e) {
    console.warn("[watermark] fixWebMDuration:", e);
  }

  onProgress?.(0.55);

  // ── 3. Seek to last frame ────────────────────────────────────────────────────
  const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  if (dur > 0) {
    await new Promise<void>((resolve) => {
      const done = () => { video.onseeked = null; resolve(); };
      video.onseeked = done;
      setTimeout(done, 1500);
      video.currentTime = Math.max(0, dur - 0.05);
    });
  }

  onProgress?.(0.75);

  // ── 4. Draw frame + watermark to canvas ──────────────────────────────────────
  const cw = video.videoWidth  || 1280;
  const ch = video.videoHeight || 720;
  const canvas  = document.createElement("canvas");
  canvas.width  = cw;
  canvas.height = ch;
  const ctx     = canvas.getContext("2d")!;

  ctx.drawImage(video, 0, 0, cw, ch);
  drawWatermark(ctx, cw, ch, uniqueId, dateStr, logoText, opacity);

  URL.revokeObjectURL(objectUrl);
  onProgress?.(0.9);

  // ── 5. Export JPEG ───────────────────────────────────────────────────────────
  const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("썸네일 JPEG 생성 실패"));
      },
      "image/jpeg",
      0.92,
    );
  });

  onProgress?.(1);

  console.log(`[watermark] thumbnail OK  ${(thumbnailBlob.size / 1024).toFixed(0)} kB  ${Date.now() - wallStart}ms`);

  return {
    blob:       thumbnailBlob,
    uniqueId,
    mimeType:   "image/jpeg",
    durationMs: Date.now() - wallStart,
  };
}
