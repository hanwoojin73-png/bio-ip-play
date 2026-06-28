/**
 * BioIPRegistry contract client — Polygon Amoy (chain 80002).
 */

import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  keccak256,
  AbiCoder,
  parseEther,
  formatEther,
  toBeHex,
  type Eip1193Provider,
  type TransactionReceipt,
  type Log,
  type Provider,
  type Signer,
} from "ethers";
import type { BioSignature, LicenseScope } from "@/types/bio-ip";
import { BIO_IP_REGISTRY_ABI, LicenseScopeEnum } from "./abi";

// ─── Network config ───────────────────────────────────────────────────────────

export const NETWORK = {
  chainId:     80002,
  chainIdHex:  "0x13882",
  name:        "Polygon Amoy",
  rpcUrl:      process.env.NEXT_PUBLIC_AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology",
  explorerUrl: "https://amoy.polygonscan.com",
  currency:    { name: "MATIC", symbol: "MATIC", decimals: 18 },
} as const;

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_BIO_IP_CONTRACT_ADDRESS ?? "") as `0x${string}`;

// ─── Result types ─────────────────────────────────────────────────────────────

export interface MintResult {
  tokenId:   bigint;
  txHash:    string;
  receipt:   TransactionReceipt;
  assetUrl:  string;  // explorer link
}

export interface TransferResult {
  licenseId: bigint;
  txHash:    string;
  receipt:   TransactionReceipt;
  txUrl:     string;
}

export interface ClaimResult {
  amountWei:   bigint;
  amountMatic: string;  // human-readable, e.g. "0.42"
  txHash:      string;
  receipt:     TransactionReceipt;
  txUrl:       string;
}

export interface PendingRoyalty {
  amountWei:   bigint;
  amountMatic: string;
  periodStart: Date;
  periodEnd:   Date;
}

// ─── Typed contract errors ────────────────────────────────────────────────────

export class ContractError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "WRONG_NETWORK"
      | "NO_WALLET"
      | "NOT_OWNER"
      | "ASSET_NOT_ACTIVE"
      | "LICENSE_EXPIRED"
      | "INSUFFICIENT_FUNDS"
      | "NO_PENDING_ROYALTY"
      | "INVALID_ROYALTY_BPS"
      | "CONTRACT_PAUSED"
      | "ADDRESS_MISSING"
      | "TX_FAILED"
      | "UNKNOWN",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ContractError";
  }
}

// ─── Provider helpers ─────────────────────────────────────────────────────────

/** Read-only provider backed by the public Amoy RPC. */
export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(NETWORK.rpcUrl, NETWORK.chainId);
}

/** Returns a signer from the user's injected wallet (MetaMask, etc.). */
export async function getSigner(): Promise<Signer> {
  if (typeof window === "undefined" || !("ethereum" in window)) {
    throw new ContractError("Web3 지갑이 감지되지 않았습니다. MetaMask를 설치해주세요.", "NO_WALLET");
  }
  const provider = new BrowserProvider(window.ethereum as Eip1193Provider);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

/** Asserts the user's wallet is connected to Amoy and switches if possible. */
export async function ensureAmoyNetwork(): Promise<void> {
  if (typeof window === "undefined" || !("ethereum" in window)) return;

  const provider = new BrowserProvider(window.ethereum as Eip1193Provider);
  const { chainId } = await provider.getNetwork();

  if (Number(chainId) === NETWORK.chainId) return;

  // Cast to Eip1193Provider for typed request() calls
  const eip1193 = window.ethereum as Eip1193Provider;

  try {
    await eip1193.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: NETWORK.chainIdHex }],
    });
  } catch (switchErr: unknown) {
    // Chain not added yet — add it
    const err = switchErr as { code?: number };
    if (err?.code === 4902) {
      await eip1193.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:           NETWORK.chainIdHex,
          chainName:         NETWORK.name,
          nativeCurrency:    NETWORK.currency,
          rpcUrls:           [NETWORK.rpcUrl],
          blockExplorerUrls: [NETWORK.explorerUrl],
        }],
      });
    } else {
      throw new ContractError(
        `네트워크 전환 실패. ${NETWORK.name}으로 수동 전환 후 다시 시도하세요.`,
        "WRONG_NETWORK",
        switchErr,
      );
    }
  }
}

// ─── Contract factory ─────────────────────────────────────────────────────────

function getReadContract(provider: Provider = getReadProvider()) {
  if (!CONTRACT_ADDRESS) {
    throw new ContractError(
      "NEXT_PUBLIC_BIO_IP_CONTRACT_ADDRESS 환경변수가 설정되지 않았습니다.",
      "ADDRESS_MISSING",
    );
  }
  return new Contract(CONTRACT_ADDRESS, BIO_IP_REGISTRY_ABI, provider);
}

function getWriteContract(signer: Signer) {
  if (!CONTRACT_ADDRESS) {
    throw new ContractError(
      "NEXT_PUBLIC_BIO_IP_CONTRACT_ADDRESS 환경변수가 설정되지 않았습니다.",
      "ADDRESS_MISSING",
    );
  }
  return new Contract(CONTRACT_ADDRESS, BIO_IP_REGISTRY_ABI, signer);
}

// ─── Signature hashing ────────────────────────────────────────────────────────

/**
 * Deterministically hashes a BioSignature into a bytes32 for on-chain storage.
 * ABI-encodes the three layer identifiers + owner ID, then keccak256-hashes them.
 */
export function hashBioSignature(sig: BioSignature): string {
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ["string", "bytes32[]", "bytes32[]", "bytes32[]"],
    [
      sig.ownerId,
      // Visual: flatten key fields to bytes32 strings (padded)
      [
        keccak256(coder.encode(["uint256[]"], [sig.visual.faceGeometry.slice(0, 16)])),
        keccak256(coder.encode(["string"],   [sig.visual.skinTexture])),
        keccak256(coder.encode(["string"],   [sig.visual.styleFingerprint])),
      ],
      // Vocal
      [
        keccak256(coder.encode(["uint256[]"], [sig.vocal.timbreEmbedding.slice(0, 8).map(Math.round)])),
        keccak256(coder.encode(["string"],    [sig.vocal.accentProfile])),
      ],
      // Dynamics
      [
        keccak256(coder.encode(["string[]"], [sig.dynamics.gestureVocabulary])),
        keccak256(coder.encode(["string[]"], [sig.dynamics.microexpressions])),
      ],
    ],
  );
  return keccak256(encoded);
}

// ─── Event parsers ─────────────────────────────────────────────────────────────

function parseBioIPMintedLog(logs: readonly Log[], contract: Contract): bigint | null {
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "BioIPMinted") return parsed.args.tokenId as bigint;
    } catch { /* skip unparseable logs */ }
  }
  return null;
}

function parseLicenseTransferredLog(logs: readonly Log[], contract: Contract): bigint | null {
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "LicenseTransferred") return parsed.args.licenseId as bigint;
    } catch { /* skip unparseable logs */ }
  }
  return null;
}

function parseRoyaltyClaimedLog(logs: readonly Log[], contract: Contract): bigint | null {
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "RoyaltyClaimed") return parsed.args.amountWei as bigint;
    } catch { /* skip */ }
  }
  return null;
}

// ─── Error mapper ─────────────────────────────────────────────────────────────

function mapContractError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("NotTokenOwner"))     throw new ContractError("이 자산의 소유자가 아닙니다.",             "NOT_OWNER",             err);
  if (msg.includes("AssetNotActive"))    throw new ContractError("비활성화된 자산입니다.",                    "ASSET_NOT_ACTIVE",      err);
  if (msg.includes("LicenseExpired"))    throw new ContractError("라이선스가 만료되었습니다.",                "LICENSE_EXPIRED",       err);
  if (msg.includes("InsufficientFunds")) throw new ContractError("잔액이 부족합니다.",                        "INSUFFICIENT_FUNDS",    err);
  if (msg.includes("NoPendingRoyalty"))  throw new ContractError("청구 가능한 로열티가 없습니다.",             "NO_PENDING_ROYALTY",    err);
  if (msg.includes("InvalidRoyaltyBps"))throw new ContractError("로열티 비율이 올바르지 않습니다(0-10000).", "INVALID_ROYALTY_BPS",   err);
  if (msg.includes("ContractPaused"))    throw new ContractError("컨트랙트가 일시 중지되었습니다.",           "CONTRACT_PAUSED",       err);
  if (msg.includes("user rejected"))     throw new ContractError("트랜잭션이 거부되었습니다.",                "TX_FAILED",             err);

  throw new ContractError(`트랜잭션 실패: ${msg}`, "UNKNOWN", err);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Mints a new Bio-IP NFT.
 *
 * Hashes the BioSignature client-side, then calls `mintBioIP` on-chain.
 * The caller must be connected to Polygon Amoy with enough MATIC for gas.
 *
 * @param signature  - Extracted BioSignature (from lib/bio-extractor + lib/signature)
 * @param metadataUri - IPFS or Arweave URI pointing to the asset JSON
 * @param royaltyBps  - Royalty rate in basis points (100 = 1 %, max 10 000)
 */
export async function mintBioIP(
  signature:   BioSignature,
  metadataUri: string,
  royaltyBps:  number,
): Promise<MintResult> {
  await ensureAmoyNetwork();
  const signer   = await getSigner();
  const contract = getWriteContract(signer);

  const sigHash = hashBioSignature(signature);

  try {
    const tx      = await contract.mintBioIP(sigHash, metadataUri, royaltyBps);
    const receipt = (await tx.wait()) as TransactionReceipt;

    if (receipt.status === 0) throw new ContractError("트랜잭션이 reverted 되었습니다.", "TX_FAILED");

    const tokenId = parseBioIPMintedLog(receipt.logs, contract) ?? BigInt(0);

    return {
      tokenId,
      txHash:   receipt.hash,
      receipt,
      assetUrl: `${NETWORK.explorerUrl}/token/${CONTRACT_ADDRESS}?a=${tokenId}`,
    };
  } catch (err) {
    if (err instanceof ContractError) throw err;
    mapContractError(err);
  }
}

/**
 * Issues a license for an existing Bio-IP asset.
 *
 * Calls `transferLicense` as a payable transaction — the buyer must attach
 * enough MATIC to cover the license fee (fetched from royaltyInfo on-chain).
 *
 * @param assetId   - Token ID of the Bio-IP NFT (as string to handle bigint safely)
 * @param buyer     - Wallet address of the licensee
 * @param scope     - License scope: "exclusive" | "non_exclusive" | "personal_only"
 * @param expiresAt - Expiry date; omit for a perpetual license
 */
export async function transferLicense(
  assetId:    string,
  buyer:      string,
  scope:      LicenseScope,
  expiresAt?: Date,
): Promise<TransferResult> {
  await ensureAmoyNetwork();
  const signer   = await getSigner();
  const contract = getWriteContract(signer);

  const tokenId    = BigInt(assetId);
  const scopeEnum  = LicenseScopeEnum[scope];
  const expiryTs   = expiresAt ? BigInt(Math.floor(expiresAt.getTime() / 1000)) : BigInt(0);

  // Estimate license fee from royaltyInfo (price of 1 MATIC as nominal sale value)
  const readContract = getReadContract();
  const [, royaltyAmount] = await readContract.royaltyInfo(tokenId, parseEther("1")) as [string, bigint];

  try {
    const tx = await contract.transferLicense(tokenId, buyer, scopeEnum, expiryTs, {
      value: royaltyAmount,
    });
    const receipt = (await tx.wait()) as TransactionReceipt;

    if (receipt.status === 0) throw new ContractError("트랜잭션이 reverted 되었습니다.", "TX_FAILED");

    const licenseId = parseLicenseTransferredLog(receipt.logs, contract) ?? BigInt(0);

    return {
      licenseId,
      txHash:  receipt.hash,
      receipt,
      txUrl:   `${NETWORK.explorerUrl}/tx/${receipt.hash}`,
    };
  } catch (err) {
    if (err instanceof ContractError) throw err;
    mapContractError(err);
  }
}

/**
 * Claims all pending royalties for a Bio-IP asset.
 *
 * Only the token owner can call this. Transfers accumulated MATIC to msg.sender.
 *
 * @param assetId - Token ID of the Bio-IP NFT
 */
export async function claimRoyalty(assetId: string): Promise<ClaimResult> {
  await ensureAmoyNetwork();
  const signer   = await getSigner();
  const contract = getWriteContract(signer);

  const tokenId = BigInt(assetId);

  try {
    const tx      = await contract.claimRoyalty(tokenId);
    const receipt = (await tx.wait()) as TransactionReceipt;

    if (receipt.status === 0) throw new ContractError("트랜잭션이 reverted 되었습니다.", "TX_FAILED");

    const amountWei   = parseRoyaltyClaimedLog(receipt.logs, contract) ?? BigInt(0);
    const amountMatic = formatEther(amountWei);

    return {
      amountWei,
      amountMatic,
      txHash:  receipt.hash,
      receipt,
      txUrl:   `${NETWORK.explorerUrl}/tx/${receipt.hash}`,
    };
  } catch (err) {
    if (err instanceof ContractError) throw err;
    mapContractError(err);
  }
}

// ─── Read-only helpers ────────────────────────────────────────────────────────

/** Returns pending royalties without sending a transaction. */
export async function getPendingRoyalties(assetId: string): Promise<PendingRoyalty> {
  const contract = getReadContract();
  const [amountWei, periodStart, periodEnd] = await contract.getPendingRoyalties(BigInt(assetId)) as [bigint, bigint, bigint];
  return {
    amountWei,
    amountMatic: formatEther(amountWei),
    periodStart: new Date(Number(periodStart) * 1000),
    periodEnd:   new Date(Number(periodEnd)   * 1000),
  };
}

/** Returns the owner address of a given token. */
export async function getTokenOwner(assetId: string): Promise<string> {
  const contract = getReadContract();
  return contract.ownerOf(BigInt(assetId)) as Promise<string>;
}

/** Checks whether a license is still valid at a given point in time. */
export async function isLicenseValid(
  licenseId: string,
  at: Date = new Date(),
): Promise<boolean> {
  const contract = getReadContract();
  const ts = BigInt(Math.floor(at.getTime() / 1000));
  return contract.isLicenseValid(BigInt(licenseId), ts) as Promise<boolean>;
}

/** Checks whether the contract is paused. */
export async function isContractPaused(): Promise<boolean> {
  const contract = getReadContract();
  return contract.paused() as Promise<boolean>;
}

/** Returns a block-explorer URL for a transaction hash. */
export function txUrl(hash: string): string {
  return `${NETWORK.explorerUrl}/tx/${hash}`;
}

/** Returns a block-explorer URL for a token. */
export function tokenUrl(tokenId: bigint | string): string {
  return `${NETWORK.explorerUrl}/token/${CONTRACT_ADDRESS}?a=${tokenId}`;
}

// Re-export toBeHex for use in tests / other modules
export { toBeHex };
