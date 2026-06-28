/**
 * MediaPipe extractor — browser only, loads FaceMesh & Pose via CDN.
 *
 * Usage:
 *   const sig = await extractVisualSignature(videoElement);
 */

import type { VisualSignature } from "@/types/bio-ip";

// ─── CDN config ───────────────────────────────────────────────────────────────

const CDN_BASE = "https://cdn.jsdelivr.net/npm";
const FACE_MESH_VERSION = "0.4.1633559619";
const POSE_VERSION      = "0.5.1675469404";

const FACE_MESH_CDN = `${CDN_BASE}/@mediapipe/face_mesh@${FACE_MESH_VERSION}`;
const POSE_CDN      = `${CDN_BASE}/@mediapipe/pose@${POSE_VERSION}`;

// ─── Minimal type declarations for CDN globals ────────────────────────────────

interface NormalizedLandmark {
  x: number;          // 0–1 normalised
  y: number;
  z: number;
  visibility?: number;
}

interface FaceMeshResults {
  multiFaceLandmarks?: NormalizedLandmark[][];
  image: HTMLCanvasElement | HTMLVideoElement;
}

interface PoseResults {
  poseLandmarks?: NormalizedLandmark[];
  image: HTMLCanvasElement | HTMLVideoElement;
}

interface FaceMeshOptions {
  maxNumFaces?: number;
  refineLandmarks?: boolean;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

interface PoseOptions {
  modelComplexity?: 0 | 1 | 2;
  smoothLandmarks?: boolean;
  enableSegmentation?: boolean;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

// These are set on window by the CDN scripts.
declare class FaceMesh {
  constructor(config: { locateFile: (file: string) => string });
  setOptions(opts: FaceMeshOptions): void;
  onResults(cb: (results: FaceMeshResults) => void): void;
  send(inputs: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): void;
}

declare class Pose {
  constructor(config: { locateFile: (file: string) => string });
  setOptions(opts: PoseOptions): void;
  onResults(cb: (results: PoseResults) => void): void;
  send(inputs: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): void;
}

// ─── Script loader ────────────────────────────────────────────────────────────

const _loaded = new Set<string>();

function loadScript(src: string): Promise<void> {
  if (_loaded.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src          = src;
    el.crossOrigin  = "anonymous";
    el.onload  = () => { _loaded.add(src); resolve(); };
    el.onerror = () => reject(new Error(`Failed to load MediaPipe script: ${src}`));
    document.head.appendChild(el);
  });
}

async function loadMediaPipeLibs(): Promise<void> {
  await loadScript(`${FACE_MESH_CDN}/face_mesh.js`);
  await loadScript(`${POSE_CDN}/pose.js`);
}

// ─── Singleton instances ──────────────────────────────────────────────────────

let _faceMesh: FaceMesh | null = null;
let _pose: Pose | null = null;

async function getFaceMesh(): Promise<FaceMesh> {
  if (_faceMesh) return _faceMesh;
  await loadMediaPipeLibs();
  // eslint-disable-next-line no-undef
  const fm = new FaceMesh({ locateFile: (f) => `${FACE_MESH_CDN}/${f}` });
  fm.setOptions({
    maxNumFaces:            1,
    refineLandmarks:        true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });
  _faceMesh = fm;
  return fm;
}

async function getPose(): Promise<Pose> {
  if (_pose) return _pose;
  await loadMediaPipeLibs();
  // eslint-disable-next-line no-undef
  const p = new Pose({ locateFile: (f) => `${POSE_CDN}/${f}` });
  p.setOptions({
    modelComplexity:        1,
    smoothLandmarks:        true,
    enableSegmentation:     false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });
  _pose = p;
  return p;
}

// ─── Frame capture ────────────────────────────────────────────────────────────

function captureFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  return canvas;
}

// ─── Landmark extractors ──────────────────────────────────────────────────────

/** Returns the 468 FaceMesh landmarks (x, y, z each) or empty on no detection. */
export async function extractFaceLandmarks(
  video: HTMLVideoElement,
): Promise<NormalizedLandmark[]> {
  const fm = await getFaceMesh();
  return new Promise((resolve) => {
    fm.onResults((results) => {
      resolve(results.multiFaceLandmarks?.[0] ?? []);
    });
    fm.send({ image: video });
  });
}

/** Returns the 33 Pose landmarks or empty on no detection. */
export async function extractPoseLandmarks(
  video: HTMLVideoElement,
): Promise<NormalizedLandmark[]> {
  const p = await getPose();
  return new Promise((resolve) => {
    p.onResults((results) => {
      resolve(results.poseLandmarks ?? []);
    });
    p.send({ image: video });
  });
}

// ─── faceGeometry ─────────────────────────────────────────────────────────────
// Flatten 468 × {x, y, z} → 1404-element number array.

function buildFaceGeometry(lms: NormalizedLandmark[]): number[] {
  const out: number[] = [];
  for (const { x, y, z } of lms) {
    out.push(
      parseFloat(x.toFixed(6)),
      parseFloat(y.toFixed(6)),
      parseFloat(z.toFixed(6)),
    );
  }
  return out;
}

// ─── skinTexture (perceptual hash) ───────────────────────────────────────────
// Crops the face bounding box, samples an 8×8 grid, encodes as 16-char hex.

function computeSkinTextureHash(
  canvas: HTMLCanvasElement,
  lms: NormalizedLandmark[],
): string {
  if (lms.length === 0) return "0".repeat(16);

  const xs = lms.map((l) => l.x);
  const ys = lms.map((l) => l.y);
  const x0 = Math.max(0, Math.min(...xs));
  const y0 = Math.max(0, Math.min(...ys));
  const x1 = Math.min(1, Math.max(...xs));
  const y1 = Math.min(1, Math.max(...ys));

  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d")!;

  // Sample 8×8 grid inside the bounding box
  const GRID = 8;
  const luminances: number[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const px = Math.floor((x0 + (x1 - x0) * (gx / GRID)) * W);
      const py = Math.floor((y0 + (y1 - y0) * (gy / GRID)) * H);
      const px_data = ctx.getImageData(px, py, 1, 1).data;
      const r = px_data[0], g = px_data[1], b = px_data[2];
      // BT.709 luma
      luminances.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
  }

  const mean = luminances.reduce((a, b) => a + b, 0) / luminances.length;
  // Build 64-bit hash: 1 if above mean, 0 otherwise
  let bits = "";
  for (const l of luminances) bits += l >= mean ? "1" : "0";

  // Convert 4-bit chunks to hex
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex; // 16 hex chars
}

// ─── expressionRange ──────────────────────────────────────────────────────────
// Detects basic FACS-aligned expressions from FaceMesh landmark geometry.

const FACE_IDX = {
  mouthTop:    13,  mouthBottom: 14,
  mouthLeft:   61,  mouthRight:  291,
  leftEyeTop:  159, leftEyeBot:  145,
  leftEyeLeft: 33,  leftEyeRight:133,
  rightEyeTop: 386, rightEyeBot: 374,
  rightEyeLeft:362, rightEyeRight:263,
  leftBrow:    65,  rightBrow:   295,
  noseTip:     1,
} as const;

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function computeExpressionLabels(lms: NormalizedLandmark[]): string[] {
  if (lms.length < 468) return [];
  const labels: string[] = [];
  const i = FACE_IDX;

  // Mouth aspect ratio
  const mouthH = dist(lms[i.mouthTop],    lms[i.mouthBottom]);
  const mouthW = dist(lms[i.mouthLeft],   lms[i.mouthRight]);
  const mar    = mouthW > 0 ? mouthH / mouthW : 0;
  labels.push(mar > 0.3 ? "mouth_open" : "mouth_closed");
  if (mar > 0.55) labels.push("smile_wide");

  // Eye aspect ratio (left)
  const leH = dist(lms[i.leftEyeTop],  lms[i.leftEyeBot]);
  const leW = dist(lms[i.leftEyeLeft], lms[i.leftEyeRight]);
  const lear = leW > 0 ? leH / leW : 0;
  labels.push(lear < 0.2 ? "eyes_squinting" : "eyes_open");

  // Brow raise — brow y vs eye y (lower y = higher in image)
  const browRaise = lms[i.leftEyeTop].y - lms[i.leftBrow].y;
  if (browRaise > 0.04) labels.push("brow_raised");

  // Nose symmetry proxy
  const noseDx = Math.abs(lms[i.noseTip].x - 0.5);
  if (noseDx < 0.02) labels.push("face_frontal");
  else labels.push(lms[i.noseTip].x < 0.5 ? "face_turned_left" : "face_turned_right");

  return Array.from(new Set(labels));
}

// ─── bodyProportions ──────────────────────────────────────────────────────────
// Computes 7 normalised skeletal ratios from Pose landmarks.

const POSE_IDX = {
  nose: 0, leftShoulder: 11, rightShoulder: 12,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
  leftWrist: 15, rightWrist: 16,
  leftElbow: 13, rightElbow: 14,
} as const;

function midpoint(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function computeBodyProportions(lms: NormalizedLandmark[]): number[] {
  if (lms.length < 29) return new Array(7).fill(0);

  const p = POSE_IDX;
  const shoulderMid = midpoint(lms[p.leftShoulder], lms[p.rightShoulder]);
  const hipMid      = midpoint(lms[p.leftHip],      lms[p.rightHip]);
  const kneeMid     = midpoint(lms[p.leftKnee],     lms[p.rightKnee]);
  const ankleMid    = midpoint(lms[p.leftAnkle],    lms[p.rightAnkle]);

  const shoulderW   = dist(lms[p.leftShoulder], lms[p.rightShoulder]);
  const hipW        = dist(lms[p.leftHip],      lms[p.rightHip]);
  const torsoH      = dist(shoulderMid,          hipMid);
  const thighH      = dist(hipMid,               kneeMid);
  const shinH       = dist(kneeMid,              ankleMid);
  const upperArmL   = dist(lms[p.leftShoulder],  lms[p.leftElbow]);
  const foreArmL    = dist(lms[p.leftElbow],     lms[p.leftWrist]);

  const ref = torsoH || 1; // normalise against torso height
  return [
    parseFloat((shoulderW / ref).toFixed(4)),   // [0] shoulder width ratio
    parseFloat((hipW       / ref).toFixed(4)),   // [1] hip width ratio
    parseFloat((thighH     / ref).toFixed(4)),   // [2] thigh-to-torso ratio
    parseFloat((shinH      / ref).toFixed(4)),   // [3] shin-to-torso ratio
    parseFloat((upperArmL  / ref).toFixed(4)),   // [4] upper arm ratio
    parseFloat((foreArmL   / ref).toFixed(4)),   // [5] forearm ratio
    parseFloat((shoulderW  / (hipW || 1)).toFixed(4)), // [6] shoulder-to-hip ratio
  ];
}

// ─── styleFingerprint ─────────────────────────────────────────────────────────
// Samples dominant colour hue in the torso region (below shoulders, above hips)
// and encodes as an 8-char hex colour signature.

function computeStyleFingerprint(
  canvas: HTMLCanvasElement,
  poseLms: NormalizedLandmark[],
): string {
  if (poseLms.length < 25) return "00000000";

  const p = POSE_IDX;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d")!;

  const x0 = Math.min(poseLms[p.leftShoulder].x,  poseLms[p.rightShoulder].x);
  const x1 = Math.max(poseLms[p.leftShoulder].x,  poseLms[p.rightShoulder].x);
  const y0 = Math.min(poseLms[p.leftShoulder].y,  poseLms[p.rightShoulder].y);
  const y1 = Math.max(poseLms[p.leftHip].y,        poseLms[p.rightHip].y);

  const px0 = Math.floor(x0 * W), py0 = Math.floor(y0 * H);
  const pw  = Math.max(1, Math.floor((x1 - x0) * W));
  const ph  = Math.max(1, Math.floor((y1 - y0) * H));

  const imageData = ctx.getImageData(px0, py0, pw, ph).data;

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < imageData.length; i += 16) { // sample every 4th pixel
    rSum += imageData[i];
    gSum += imageData[i + 1];
    bSum += imageData[i + 2];
    count++;
  }

  if (count === 0) return "00000000";

  const rAvg = Math.round(rSum / count);
  const gAvg = Math.round(gSum / count);
  const bAvg = Math.round(bSum / count);

  // Dominant hue + avg colour → 8-char hex
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `${hex(rAvg)}${hex(gAvg)}${hex(bAvg)}${hex(Math.round((rAvg + gAvg + bAvg) / 3))}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExtractionResult {
  signature: VisualSignature;
  faceLandmarkCount: number;    // 468 when detected
  poseLandmarkCount: number;    // 33 when detected
  detectedAt: string;           // ISO-8601
}

/**
 * Main entry point.
 * Runs FaceMesh + Pose on a single video frame and returns a VisualSignature.
 *
 * @param video - A playing <video> element (e.g. from getUserMedia)
 */
export async function extractVisualSignature(
  video: HTMLVideoElement,
): Promise<ExtractionResult> {
  if (typeof window === "undefined") {
    throw new Error("extractVisualSignature must be called in a browser environment.");
  }

  const [faceLms, poseLms] = await Promise.all([
    extractFaceLandmarks(video),
    extractPoseLandmarks(video),
  ]);

  const canvas = captureFrame(video);

  const signature: VisualSignature = {
    faceGeometry:     buildFaceGeometry(faceLms),
    skinTexture:      computeSkinTextureHash(canvas, faceLms),
    bodyProportions:  computeBodyProportions(poseLms),
    expressionRange:  computeExpressionLabels(faceLms),
    styleFingerprint: computeStyleFingerprint(canvas, poseLms),
  };

  return {
    signature,
    faceLandmarkCount: faceLms.length,
    poseLandmarkCount: poseLms.length,
    detectedAt:        new Date().toISOString(),
  };
}

/**
 * Release MediaPipe WASM resources.
 * Call when the capturing component unmounts.
 */
export function disposeMediaPipe(): void {
  _faceMesh?.close();
  _pose?.close();
  _faceMesh = null;
  _pose     = null;
}
