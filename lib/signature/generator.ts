import type { DynamicsSignature } from "@/types/bio-ip";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface FrameLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** One captured video frame with associated landmark data. */
export interface CaptureFrame {
  timestamp: number;      // ms since capture start
  face: FrameLandmark[];  // 468 FaceMesh landmarks (normalised 0-1)
  pose: FrameLandmark[];  // 33 Pose landmarks (normalised 0-1)
}

/** Intermediate per-frame motion metrics, exposed for debugging / visualisation. */
export interface MotionAnalysis {
  velocityMagnitudes:     number[][];  // [frame][joint] m/frame-unit
  accelerationMagnitudes: number[][];  // [frame][joint]
  jointAngles:            number[][];  // [frame][8 key joints] degrees
  peakFrames:             number[];    // frame indices of motion peaks
  dominantPeriodMs:       number;      // estimated cycle period
}

// ─── Pose joint indices (MediaPipe Pose 33-point model) ───────────────────────

const PI = {
  nose: 0,
  leftShoulder: 11, rightShoulder: 12,
  leftElbow:    13, rightElbow:    14,
  leftWrist:    15, rightWrist:    16,
  leftHip:      23, rightHip:      24,
  leftKnee:     25, rightKnee:     26,
  leftAnkle:    27, rightAnkle:    28,
} as const;

/** Key joints tracked for velocity / acceleration. */
const TRACKED_JOINTS = [
  PI.leftWrist, PI.rightWrist,
  PI.leftElbow, PI.rightElbow,
  PI.leftShoulder, PI.rightShoulder,
  PI.leftKnee, PI.rightKnee,
] as const;

// ─── Face landmark indices (MediaPipe FaceMesh 468-point) ─────────────────────

const FI = {
  mouthTop: 13,  mouthBot: 14,  mouthLeft: 61, mouthRight: 291,
  leftEyeTop: 159, leftEyeBot: 145, leftEyeLeft: 33, leftEyeRight: 133,
  rightEyeTop: 386, rightEyeBot: 374,
  leftBrowInner: 65,  leftBrowOuter: 70,
  rightBrowInner: 295, rightBrowOuter: 300,
  leftCheek: 116, rightCheek: 345,
  chinTip: 152,  noseTip: 1,
  upperLip: 37,  lowerLip: 84,
  leftCorner: 61, rightCorner: 291,
} as const;

// ─── Math primitives ──────────────────────────────────────────────────────────

function dist3(a: FrameLandmark, b: FrameLandmark): number {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2);
}

function magnitude(a: FrameLandmark): number {
  return Math.sqrt(a.x**2 + a.y**2 + a.z**2);
}

/** Vector angle at joint B formed by A-B-C, in degrees. */
function jointAngleDeg(
  a: FrameLandmark,
  b: FrameLandmark,
  c: FrameLandmark,
): number {
  const ab = { x: a.x-b.x, y: a.y-b.y, z: a.z-b.z };
  const cb = { x: c.x-b.x, y: c.y-b.y, z: c.z-b.z };
  const dot = ab.x*cb.x + ab.y*cb.y + ab.z*cb.z;
  const magAB = Math.sqrt(ab.x**2 + ab.y**2 + ab.z**2);
  const magCB = Math.sqrt(cb.x**2 + cb.y**2 + cb.z**2);
  if (magAB === 0 || magCB === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (magAB * magCB)))) * 180) / Math.PI;
}

/** Gaussian-weighted moving average for smoothing a signal. */
function smooth(values: number[], windowSize = 5): number[] {
  const half   = Math.floor(windowSize / 2);
  const kernel = Array.from({ length: windowSize }, (_, i) => {
    const x = i - half;
    return Math.exp(-(x * x) / (2 * (half / 2) ** 2));
  });
  const kSum = kernel.reduce((a, b) => a + b, 0);
  return values.map((_, i) =>
    kernel.reduce((acc, w, ki) => {
      const idx = i - half + ki;
      return acc + w * (values[Math.max(0, Math.min(values.length - 1, idx))] ?? 0);
    }, 0) / kSum,
  );
}

// ─── Velocity & acceleration ──────────────────────────────────────────────────

/**
 * Central-difference velocity for each tracked joint.
 * Returns [frames][joints] magnitude array.
 */
function computeVelocities(frames: CaptureFrame[]): number[][] {
  const n = frames.length;
  return frames.map((frame, i) => {
    if (i === 0 || i === n - 1 || frame.pose.length === 0) {
      return TRACKED_JOINTS.map(() => 0);
    }
    const prev = frames[i - 1];
    const next = frames[i + 1];
    const dt   = (next.timestamp - prev.timestamp) / 2 || 1;

    return TRACKED_JOINTS.map((jIdx) => {
      const p = prev.pose[jIdx];
      const q = next.pose[jIdx];
      if (!p || !q) return 0;
      const dx = (q.x - p.x) / dt;
      const dy = (q.y - p.y) / dt;
      const dz = (q.z - p.z) / dt;
      return Math.sqrt(dx**2 + dy**2 + dz**2);
    });
  });
}

/**
 * Central-difference acceleration from velocity magnitudes.
 */
function computeAccelerations(velocities: number[][]): number[][] {
  const n = velocities.length;
  return velocities.map((_, i) => {
    if (i === 0 || i === n - 1) return TRACKED_JOINTS.map(() => 0);
    return TRACKED_JOINTS.map((__, j) =>
      Math.abs(velocities[i + 1][j] - velocities[i - 1][j]) / 2,
    );
  });
}

// ─── Joint angles ─────────────────────────────────────────────────────────────

/**
 * Computes 8 key joint angles per frame (degrees).
 * Order: L-elbow, R-elbow, L-shoulder, R-shoulder, L-hip, R-hip, L-knee, R-knee
 */
function computeJointAngles(frames: CaptureFrame[]): number[][] {
  return frames.map(({ pose }) => {
    if (pose.length < 29) return new Array(8).fill(0);
    return [
      jointAngleDeg(pose[PI.leftShoulder],  pose[PI.leftElbow],  pose[PI.leftWrist]),
      jointAngleDeg(pose[PI.rightShoulder], pose[PI.rightElbow], pose[PI.rightWrist]),
      jointAngleDeg(pose[PI.leftHip],       pose[PI.leftShoulder],  pose[PI.leftElbow]),
      jointAngleDeg(pose[PI.rightHip],      pose[PI.rightShoulder], pose[PI.rightElbow]),
      jointAngleDeg(pose[PI.leftShoulder],  pose[PI.leftHip],   pose[PI.leftKnee]),
      jointAngleDeg(pose[PI.rightShoulder], pose[PI.rightHip],  pose[PI.rightKnee]),
      jointAngleDeg(pose[PI.leftHip],       pose[PI.leftKnee],  pose[PI.leftAnkle]),
      jointAngleDeg(pose[PI.rightHip],      pose[PI.rightKnee], pose[PI.rightAnkle]),
    ];
  });
}

// ─── Posture baseline ─────────────────────────────────────────────────────────

/** Mean joint-angle vector across all valid frames. */
function computePostureBaseline(jointAngles: number[][]): number[] {
  const valid = jointAngles.filter((row) => row.some((v) => v > 0));
  if (valid.length === 0) return new Array(8).fill(0);
  const sums = new Array(8).fill(0) as number[];
  for (const row of valid) {
    for (let j = 0; j < 8; j++) sums[j] += row[j];
  }
  return sums.map((s) => parseFloat((s / valid.length).toFixed(2)));
}

// ─── Motion peaks & tempo ─────────────────────────────────────────────────────

/** Detect local maxima above `threshold` with minimum `minGapFrames` separation. */
function detectPeaks(signal: number[], threshold: number, minGapFrames = 5): number[] {
  const peaks: number[] = [];
  let lastPeak = -minGapFrames;
  for (let i = 1; i < signal.length - 1; i++) {
    if (
      signal[i] > threshold &&
      signal[i] >= signal[i - 1] &&
      signal[i] >= signal[i + 1] &&
      i - lastPeak >= minGapFrames
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  return peaks;
}

/**
 * Estimates movement tempo in BPM from wrist velocity peaks.
 * Falls back to 0 if fewer than 2 peaks detected.
 */
function estimateTempoBPM(frames: CaptureFrame[], velocities: number[][]): number {
  // Use left + right wrist (indices 0 and 1 in TRACKED_JOINTS)
  const wristSignal = velocities.map((v) => (v[0] + v[1]) / 2);
  const smoothed    = smooth(wristSignal, 7);
  const mean        = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
  const peaks       = detectPeaks(smoothed, mean * 1.4);

  if (peaks.length < 2) return 0;

  // Inter-peak interval → average period → BPM
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const dtMs = frames[peaks[i]].timestamp - frames[peaks[i - 1]].timestamp;
    if (dtMs > 0) intervals.push(dtMs);
  }
  if (intervals.length === 0) return 0;
  const avgPeriodMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return parseFloat(((60_000 / avgPeriodMs)).toFixed(1));
}

// ─── Gesture vocabulary ───────────────────────────────────────────────────────

interface GestureWindow {
  startFrame: number;
  endFrame:   number;
  label:      string;
}

/**
 * Rule-based gesture classifier operating on segments around each motion peak.
 * Returns de-duplicated gesture label list.
 */
function classifyGestures(
  frames:      CaptureFrame[],
  velocities:  number[][],
  peakFrames:  number[],
): string[] {
  const labels = new Set<string>();

  for (const peak of peakFrames) {
    const pose = frames[peak]?.pose;
    if (!pose || pose.length < 29) continue;

    const lWrist = pose[PI.leftWrist];
    const rWrist = pose[PI.rightWrist];
    const lShoulder = pose[PI.leftShoulder];
    const rShoulder = pose[PI.rightShoulder];
    const lHip  = pose[PI.leftHip];
    const rHip  = pose[PI.rightHip];
    const nose  = pose[PI.nose];

    const shoulderMidY = (lShoulder.y + rShoulder.y) / 2;
    const hipMidY      = (lHip.y + rHip.y) / 2;
    const shoulderW    = Math.abs(lShoulder.x - rShoulder.x);
    const wristSpread  = Math.abs(lWrist.x - rWrist.x);

    // Wrists above nose → reach up / overhead
    if (lWrist.y < nose.y && rWrist.y < nose.y) {
      labels.add("reach_overhead");
    } else if (lWrist.y < shoulderMidY || rWrist.y < shoulderMidY) {
      labels.add("reach_up");
    }

    // Wrists very close together → clap / clasp
    if (dist3(lWrist, rWrist) < shoulderW * 0.3) {
      labels.add("hands_together");
    }

    // Wide arm spread → expansive open gesture
    if (wristSpread > shoulderW * 2.2) {
      labels.add("arms_wide");
    }

    // One wrist near body centre, one extended → point / reach
    const centrX = (lShoulder.x + rShoulder.x) / 2;
    if (Math.abs(lWrist.x - centrX) > shoulderW * 1.5 && Math.abs(rWrist.x - centrX) < shoulderW * 0.5) {
      labels.add("point_left");
    }
    if (Math.abs(rWrist.x - centrX) > shoulderW * 1.5 && Math.abs(lWrist.x - centrX) < shoulderW * 0.5) {
      labels.add("point_right");
    }

    // Head bow — nose Y well below shoulder mid
    if (nose.y > shoulderMidY + 0.05) {
      labels.add("bow_head");
    }

    // Low wrists (below hips) → squat / crouch indication
    if (lWrist.y > hipMidY && rWrist.y > hipMidY) {
      labels.add("hands_low");
    }
  }

  // Wrist oscillation (wave) — check left-right alternation across peaks
  if (peakFrames.length >= 4) {
    let alternating = 0;
    for (let i = 1; i < peakFrames.length; i++) {
      const v0 = velocities[peakFrames[i - 1]];
      const v1 = velocities[peakFrames[i]];
      // If dominant wrist alternates between left (idx 0) and right (idx 1)
      if ((v0[0] > v0[1]) !== (v1[0] > v1[1])) alternating++;
    }
    if (alternating >= peakFrames.length / 2) labels.add("wave");
  }

  if (labels.size === 0) labels.add("idle");

  return Array.from(labels);
}

// ─── Microexpressions (FACS AUs) ─────────────────────────────────────────────

const AU_DEFS: { code: string; detect: (lms: FrameLandmark[]) => boolean }[] = [
  {
    // AU1 — inner brow raise
    code: "AU1",
    detect: (lms) => lms[FI.leftBrowInner].y < lms[FI.leftEyeTop].y - 0.015,
  },
  {
    // AU2 — outer brow raise
    code: "AU2",
    detect: (lms) => lms[FI.leftBrowOuter].y < lms[FI.leftEyeTop].y - 0.01,
  },
  {
    // AU4 — brow lowerer (brows converge toward nose)
    code: "AU4",
    detect: (lms) => {
      const gap = Math.abs(lms[FI.leftBrowInner].x - lms[FI.rightBrowInner].x);
      const ref = Math.abs(lms[FI.leftEyeLeft].x   - lms[FI.rightEyeTop].x);
      return gap < ref * 0.5;
    },
  },
  {
    // AU6 — cheek raiser (cheeks elevated)
    code: "AU6",
    detect: (lms) => lms[FI.leftCheek].y < lms[FI.leftEyeBot].y + 0.01,
  },
  {
    // AU12 — lip corner puller (smile)
    code: "AU12",
    detect: (lms) => {
      const mouthW = Math.abs(lms[FI.mouthLeft].x - lms[FI.mouthRight].x);
      const eyeW   = Math.abs(lms[FI.leftEyeLeft].x - lms[FI.rightEyeTop].x);
      return mouthW > eyeW * 0.85;
    },
  },
  {
    // AU17 — chin raiser
    code: "AU17",
    detect: (lms) => {
      const chinNoseGap = lms[FI.chinTip].y - lms[FI.noseTip].y;
      return chinNoseGap < 0.12;
    },
  },
  {
    // AU25 — lips part
    code: "AU25",
    detect: (lms) => {
      const lipGap = lms[FI.mouthBot].y - lms[FI.mouthTop].y;
      const mouthW = Math.abs(lms[FI.mouthLeft].x - lms[FI.mouthRight].x);
      return mouthW > 0 && lipGap / mouthW > 0.25;
    },
  },
  {
    // AU26 — jaw drop
    code: "AU26",
    detect: (lms) => {
      const lipGap = lms[FI.mouthBot].y - lms[FI.mouthTop].y;
      const mouthW = Math.abs(lms[FI.mouthLeft].x - lms[FI.mouthRight].x);
      return mouthW > 0 && lipGap / mouthW > 0.45;
    },
  },
];

/**
 * Returns FACS AUs that appear in ≥ minFrames and last < maxDurationMs
 * (short-burst = microexpression criterion).
 */
function detectMicroexpressions(
  frames: CaptureFrame[],
  minFrames    = 2,
  maxDurationMs = 250,
): string[] {
  if (frames.length < 3) return [];

  const detectedAUs = new Set<string>();

  for (const { code, detect } of AU_DEFS) {
    // Find contiguous runs where the AU is active
    let runStart: number | null = null;

    for (let i = 0; i < frames.length; i++) {
      const face = frames[i].face;
      if (face.length < 468) continue;

      const active = detect(face);

      if (active && runStart === null) {
        runStart = i;
      } else if (!active && runStart !== null) {
        const runLen = i - runStart;
        const runMs  = frames[i].timestamp - frames[runStart].timestamp;
        if (runLen >= minFrames && runMs <= maxDurationMs) {
          detectedAUs.add(code);
        }
        runStart = null;
      }
    }
  }

  return Array.from(detectedAUs);
}

// ─── Interaction style ────────────────────────────────────────────────────────

type InteractionStyle = "expansive" | "moderate" | "contained" | "asymmetric";

function classifyInteractionStyle(
  frames:     CaptureFrame[],
  velocities: number[][],
): InteractionStyle {
  const validFrames = frames.filter((f) => f.pose.length >= 29);
  if (validFrames.length === 0) return "contained";

  // Spatial range: max wrist spread relative to shoulder width
  const spreads = validFrames.map((f) => {
    const lw = f.pose[PI.leftWrist];
    const rw = f.pose[PI.rightWrist];
    const ls = f.pose[PI.leftShoulder];
    const rs = f.pose[PI.rightShoulder];
    const shoulderW = Math.abs(ls.x - rs.x) || 0.1;
    return Math.abs(lw.x - rw.x) / shoulderW;
  });
  const maxSpread = Math.max(...spreads);
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;

  // Kinetic energy proxy: average total velocity
  const avgVel = velocities.reduce((sum, v) => sum + v.reduce((a, b) => a + b, 0), 0)
    / (velocities.length * TRACKED_JOINTS.length || 1);

  // Asymmetry: compare left vs right wrist activity
  const leftEnergy  = velocities.reduce((s, v) => s + v[0], 0);
  const rightEnergy = velocities.reduce((s, v) => s + v[1], 0);
  const asymmetry   = Math.abs(leftEnergy - rightEnergy) / (leftEnergy + rightEnergy + 1e-6);

  if (asymmetry > 0.4) return "asymmetric";
  if (maxSpread > 2.5 || avgVel > 0.015) return "expansive";
  if (avgSpread > 1.5 || avgVel > 0.008) return "moderate";
  return "contained";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GeneratorResult {
  signature:  DynamicsSignature;
  analysis:   MotionAnalysis;
  frameCount: number;
  durationMs: number;
}

/**
 * Analyses a sequence of captured frames and returns a DynamicsSignature.
 *
 * @param frames  - Ordered array of CaptureFrame from a recording session.
 * @returns GeneratorResult containing the signature and intermediate analysis.
 */
export function generateDynamicsSignature(frames: CaptureFrame[]): GeneratorResult {
  if (frames.length < 2) {
    throw new Error(`generateDynamicsSignature requires at least 2 frames, got ${frames.length}.`);
  }

  // ── Core analysis ──────────────────────────────────────────────────────────
  const velocities     = computeVelocities(frames);
  const accelerations  = computeAccelerations(velocities);
  const jointAngles    = computeJointAngles(frames);

  // ── Motion peaks (using summed wrist velocities) ───────────────────────────
  const wristSignal = smooth(velocities.map((v) => v[0] + v[1]), 5);
  const velMean     = wristSignal.reduce((a, b) => a + b, 0) / wristSignal.length;
  const peakFrames  = detectPeaks(wristSignal, velMean * 1.3);

  // ── Dominant period from inter-peak intervals ──────────────────────────────
  const intervals: number[] = [];
  for (let i = 1; i < peakFrames.length; i++) {
    intervals.push(frames[peakFrames[i]].timestamp - frames[peakFrames[i - 1]].timestamp);
  }
  const dominantPeriodMs =
    intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 0;

  const analysis: MotionAnalysis = {
    velocityMagnitudes:     velocities,
    accelerationMagnitudes: accelerations,
    jointAngles,
    peakFrames,
    dominantPeriodMs,
  };

  // ── DynamicsSignature fields ───────────────────────────────────────────────
  const gestureVocabulary  = classifyGestures(frames, velocities, peakFrames);
  const movementTempo      = estimateTempoBPM(frames, velocities);
  const microexpressions   = detectMicroexpressions(frames);
  const postureBaseline    = computePostureBaseline(jointAngles);
  const interactionStyle   = classifyInteractionStyle(frames, velocities);

  const signature: DynamicsSignature = {
    gestureVocabulary,
    movementTempo,
    microexpressions,
    postureBaseline,
    interactionStyle,
  };

  const durationMs =
    frames[frames.length - 1].timestamp - frames[0].timestamp;

  return { signature, analysis, frameCount: frames.length, durationMs };
}

/**
 * Samples frames from a playing <video> element at `fps` rate,
 * runs MediaPipe externally (caller supplies landmark arrays),
 * and produces a DynamicsSignature.
 *
 * This is a convenience wrapper for testing with pre-extracted landmark arrays.
 */
export function buildFramesFromLandmarks(
  timestamps:    number[],
  faceLandmarks: FrameLandmark[][],
  poseLandmarks: FrameLandmark[][],
): CaptureFrame[] {
  const len = Math.min(timestamps.length, faceLandmarks.length, poseLandmarks.length);
  return Array.from({ length: len }, (_, i) => ({
    timestamp: timestamps[i],
    face:      faceLandmarks[i],
    pose:      poseLandmarks[i],
  }));
}
