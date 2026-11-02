/**
 * MediaPipe Tasks Vision (FaceLandmarker) wrapper.
 *
 * This module has a static `@mediapipe/tasks-vision` import at the top, so it
 * must only ever be reached via a dynamic `import("@/lib/bio-extractor/face-landmarker")`
 * from the challenge page — never imported statically from anywhere else —
 * so the (fairly heavy) WASM + model payload stays out of every other page's
 * bundle.
 */

import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

// Pinned to the installed npm version (package-lock) so the JS API and the
// WASM runtime never drift apart. Bump both together.
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let resolverPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;

function getVisionResolver() {
  if (!resolverPromise) resolverPromise = FilesetResolver.forVisionTasks(WASM_URL);
  return resolverPromise;
}

async function createFaceLandmarker(runningMode: "VIDEO" | "IMAGE"): Promise<FaceLandmarker> {
  const resolver = await getVisionResolver();
  try {
    return await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode,
      numFaces: 1,
    });
  } catch (e) {
    // GPU delegate isn't available on every device/browser — fall back to CPU.
    console.warn("[face-landmarker] GPU delegate failed, retrying on CPU:", e);
    return await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      runningMode,
      numFaces: 1,
    });
  }
}

let liveLandmarkerPromise: Promise<FaceLandmarker> | null = null;

/**
 * Singleton VIDEO-mode landmarker for the live "생체 인식 중" status dot.
 * Kept warm for the lifetime of the challenge page — call disposeLiveFaceLandmarker()
 * when the page unmounts.
 */
export function getLiveFaceLandmarker(): Promise<FaceLandmarker> {
  if (!liveLandmarkerPromise) liveLandmarkerPromise = createFaceLandmarker("VIDEO");
  return liveLandmarkerPromise;
}

export async function disposeLiveFaceLandmarker(): Promise<void> {
  if (!liveLandmarkerPromise) return;
  const instance = liveLandmarkerPromise;
  liveLandmarkerPromise = null;
  try { (await instance).close(); } catch { /* already gone */ }
}

/**
 * One-shot IMAGE-mode detection for a single still frame (the registration
 * highlight's landmark-dot animation). Creates and immediately closes its
 * own instance so it never competes with the live VIDEO-mode singleton.
 */
export async function detectFaceLandmarksOnImage(
  image: HTMLImageElement | HTMLCanvasElement,
): Promise<NormalizedLandmark[]> {
  const landmarker = await createFaceLandmarker("IMAGE");
  try {
    const result = landmarker.detect(image);
    return result.faceLandmarks?.[0] ?? [];
  } finally {
    landmarker.close();
  }
}
