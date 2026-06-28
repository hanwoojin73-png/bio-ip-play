import type {
  BioSignature,
  VisualSignature,
  VocalSignature,
  DynamicsSignature,
} from "@/types/bio-ip";

// ─── Layer validators ──────────────────────────────────────────────────────────

function validateVisual(v: VisualSignature): string[] {
  const errors: string[] = [];

  if (!Array.isArray(v.faceGeometry) || v.faceGeometry.length === 0)
    errors.push("visual.faceGeometry must be a non-empty number array");

  if (typeof v.skinTexture !== "string" || v.skinTexture.trim() === "")
    errors.push("visual.skinTexture must be a non-empty string");

  if (!Array.isArray(v.bodyProportions) || v.bodyProportions.length === 0)
    errors.push("visual.bodyProportions must be a non-empty number array");

  if (!Array.isArray(v.expressionRange) || v.expressionRange.length === 0)
    errors.push("visual.expressionRange must contain at least one label");

  if (typeof v.styleFingerprint !== "string" || v.styleFingerprint.trim() === "")
    errors.push("visual.styleFingerprint must be a non-empty string");

  return errors;
}

function validateVocal(v: VocalSignature): string[] {
  const errors: string[] = [];

  if (!Array.isArray(v.pitchContour) || v.pitchContour.length === 0)
    errors.push("vocal.pitchContour must be a non-empty number array");

  if (!Array.isArray(v.timbreEmbedding) || v.timbreEmbedding.length === 0)
    errors.push("vocal.timbreEmbedding must be a non-empty number array");

  if (typeof v.speechRhythm !== "number" || v.speechRhythm <= 0)
    errors.push("vocal.speechRhythm must be a positive number");

  if (typeof v.accentProfile !== "string" || v.accentProfile.trim() === "")
    errors.push("vocal.accentProfile must be a non-empty string");

  if (typeof v.breathingPattern !== "string" || v.breathingPattern.trim() === "")
    errors.push("vocal.breathingPattern must be a non-empty string");

  return errors;
}

function validateDynamics(d: DynamicsSignature): string[] {
  const errors: string[] = [];

  if (!Array.isArray(d.gestureVocabulary) || d.gestureVocabulary.length === 0)
    errors.push("dynamics.gestureVocabulary must contain at least one identifier");

  if (typeof d.movementTempo !== "number" || d.movementTempo <= 0)
    errors.push("dynamics.movementTempo must be a positive number");

  if (!Array.isArray(d.microexpressions) || d.microexpressions.length === 0)
    errors.push("dynamics.microexpressions must contain at least one FACS code");

  if (!Array.isArray(d.postureBaseline) || d.postureBaseline.length === 0)
    errors.push("dynamics.postureBaseline must be a non-empty number array");

  if (typeof d.interactionStyle !== "string" || d.interactionStyle.trim() === "")
    errors.push("dynamics.interactionStyle must be a non-empty string");

  return errors;
}

// ─── ISO-8601 guard ────────────────────────────────────────────────────────────

function isValidISODate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

// ─── Result type ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Full structural + semantic validation of a BioSignature.
 * Returns every error found so callers can surface them all at once.
 */
export function validateBioSignature(sig: BioSignature): ValidationResult {
  const errors: string[] = [];

  if (typeof sig.id !== "string" || sig.id.trim() === "")
    errors.push("id must be a non-empty string");

  if (typeof sig.ownerId !== "string" || sig.ownerId.trim() === "")
    errors.push("ownerId must be a non-empty string");

  if (!isValidISODate(sig.createdAt))
    errors.push("createdAt must be a valid ISO-8601 date string");

  if (typeof sig.confidence !== "number" || sig.confidence < 0 || sig.confidence > 1)
    errors.push("confidence must be a number between 0 and 1");

  if (typeof sig.version !== "number" || !Number.isInteger(sig.version) || sig.version < 1)
    errors.push("version must be a positive integer");

  errors.push(...validateVisual(sig.visual));
  errors.push(...validateVocal(sig.vocal));
  errors.push(...validateDynamics(sig.dynamics));

  return { valid: errors.length === 0, errors };
}

/**
 * Throws if the signature is invalid.
 * Convenient for contexts where invalid data is a programming error.
 */
export function assertBioSignature(sig: BioSignature): void {
  const result = validateBioSignature(sig);
  if (!result.valid) {
    throw new Error(`Invalid BioSignature:\n${result.errors.join("\n")}`);
  }
}

/**
 * Type guard — narrows unknown input to BioSignature.
 * Performs a shallow structural check before the full validation.
 */
export function isBioSignature(value: unknown): value is BioSignature {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.ownerId === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.confidence === "number" &&
    typeof candidate.version === "number" &&
    typeof candidate.visual === "object" &&
    typeof candidate.vocal === "object" &&
    typeof candidate.dynamics === "object"
  );
}

/**
 * Layer-level validators exported for targeted partial checks.
 */
export { validateVisual, validateVocal, validateDynamics };
