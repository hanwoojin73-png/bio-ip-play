// Visual layer: appearance-based biometric traits
export interface VisualSignature {
  faceGeometry: number[];       // 3D landmark embedding
  skinTexture: string;          // perceptual hash
  bodyProportions: number[];    // normalized ratio vector
  expressionRange: string[];    // canonical expression labels
  styleFingerprint: string;     // clothing / aesthetic hash
}

// Vocal layer: voice-based biometric traits
export interface VocalSignature {
  pitchContour: number[];       // Hz time-series
  timbreEmbedding: number[];    // spectral feature vector
  speechRhythm: number;         // average syllables/sec
  accentProfile: string;        // BCP-47 locale + accent tag
  breathingPattern: string;     // perceptual descriptor
}

// Dynamics layer: motion & behavioural biometric traits
export interface DynamicsSignature {
  gestureVocabulary: string[];  // named gesture identifiers
  movementTempo: number;        // avg BPM of motion cycles
  microexpressions: string[];   // FACS action unit codes
  postureBaseline: number[];    // skeletal joint-angle vector
  interactionStyle: string;     // e.g. "expansive" | "contained"
}

// Aggregated biometric identity across all three layers
export interface BioSignature {
  id: string;
  ownerId: string;
  createdAt: string;            // ISO-8601
  visual: VisualSignature;
  vocal: VocalSignature;
  dynamics: DynamicsSignature;
  confidence: number;           // 0–1 match confidence
  version: number;
}

// ─── Challenge ────────────────────────────────────────────────────────────────

export type ChallengeStatus = "pending" | "active" | "resolved" | "dismissed";
export type ChallengeType =
  | "identity_dispute"
  | "unauthorised_use"
  | "ownership_claim"
  | "similarity_claim";

export interface Challenge {
  id: string;
  assetId: string;
  challengerOwnerId: string;
  type: ChallengeType;
  status: ChallengeStatus;
  evidence: string[];           // URLs or IPFS CIDs
  description: string;
  filedAt: string;              // ISO-8601
  resolvedAt?: string;
  resolution?: string;
}

// ─── BioIPAsset ───────────────────────────────────────────────────────────────

/** 'self' = 본인 모습 (퍼블리시티권), 'character' = 창작 캐릭터 (저작권) */
export type ContentType = "self" | "character";

export type LicenseScope = "exclusive" | "non_exclusive" | "personal_only";
export type AssetStatus = "draft" | "registered" | "disputed" | "revoked";

export interface LicenseTerms {
  scope: LicenseScope;
  allowedUseCases: string[];    // e.g. ["advertising", "entertainment"]
  prohibitedUseCases: string[];
  territoryCodes: string[];     // ISO-3166-1 alpha-2
  expiresAt?: string;           // ISO-8601; omit for perpetual
  royaltyRateBps: number;       // basis points, e.g. 1000 = 10 %
}

export interface BioIPAsset {
  id: string;
  ownerId: string;
  bioSignatureId: string;
  title: string;
  description: string;
  status: AssetStatus;
  contentType: ContentType;     // 'self' | 'character'
  licenseTerms: LicenseTerms;
  registeredAt: string;         // ISO-8601
  updatedAt: string;
  challenges: string[];         // Challenge IDs
  metadataUri?: string;         // IPFS / Arweave URI
}

// ─── RoyaltyPayment ───────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "confirmed" | "failed" | "refunded";
export type PaymentCurrency = "USD" | "ETH" | "USDC" | "MATIC";

export interface RoyaltyPayment {
  id: string;
  assetId: string;
  payerId: string;
  payeeId: string;              // asset owner
  amountBps: number;            // basis points of usage fee
  amountValue: number;          // absolute amount
  currency: PaymentCurrency;
  status: PaymentStatus;
  usageDescription: string;
  periodStart: string;          // ISO-8601
  periodEnd: string;
  paidAt?: string;
  txHash?: string;              // on-chain tx reference
}
