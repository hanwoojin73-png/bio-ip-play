// ABI for BioIPRegistry — ERC-721 based NFT contract with licensing and royalty logic.
// Deploy this contract on Polygon Mumbai (or Amoy) before calling contract.ts functions.

export const BIO_IP_REGISTRY_ABI = [
  // ─── ERC-721 standard ────────────────────────────────────────────────────────
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs:  [{ name: "tokenId",  type: "uint256" }],
    outputs: [{ name: "",         type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs:  [{ name: "tokenId",  type: "uint256" }],
    outputs: [{ name: "",         type: "string"  }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs:  [{ name: "owner",    type: "address" }],
    outputs: [{ name: "",         type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs:  [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }],
    outputs: [],
  },

  // ─── ERC-2981 royalty standard ────────────────────────────────────────────────
  {
    type: "function",
    name: "royaltyInfo",
    stateMutability: "view",
    inputs: [
      { name: "tokenId",   type: "uint256" },
      { name: "salePrice", type: "uint256" },
    ],
    outputs: [
      { name: "receiver",     type: "address" },
      { name: "royaltyAmount", type: "uint256" },
    ],
  },

  // ─── Bio-IP: minting ──────────────────────────────────────────────────────────
  {
    type: "function",
    name: "mintBioIP",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signatureHash", type: "bytes32" }, // keccak256 of ABI-encoded BioSignature
      { name: "metadataUri",   type: "string"  }, // IPFS / Arweave URI
      { name: "royaltyBps",    type: "uint16"  }, // e.g. 1000 = 10 %
    ],
    outputs: [
      { name: "tokenId", type: "uint256" },
    ],
  },

  // ─── Bio-IP: asset query ──────────────────────────────────────────────────────
  {
    type: "function",
    name: "getAsset",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "signatureHash", type: "bytes32" },
          { name: "metadataUri",   type: "string"  },
          { name: "royaltyBps",    type: "uint16"  },
          { name: "mintedAt",      type: "uint64"  },
          { name: "active",        type: "bool"    },
        ],
      },
    ],
  },

  // ─── Bio-IP: license transfer ─────────────────────────────────────────────────
  {
    type: "function",
    name: "transferLicense",
    stateMutability: "payable",
    inputs: [
      { name: "assetId",   type: "uint256" }, // NFT token ID
      { name: "buyer",     type: "address" }, // licensee wallet
      { name: "scope",     type: "uint8"   }, // 0=exclusive 1=non_exclusive 2=personal_only
      { name: "expiresAt", type: "uint64"  }, // unix timestamp; 0 = perpetual
    ],
    outputs: [
      { name: "licenseId", type: "uint256" },
    ],
  },

  // ─── Bio-IP: license query ────────────────────────────────────────────────────
  {
    type: "function",
    name: "getLicense",
    stateMutability: "view",
    inputs: [{ name: "licenseId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "assetId",    type: "uint256" },
          { name: "licensee",   type: "address" },
          { name: "scope",      type: "uint8"   },
          { name: "issuedAt",   type: "uint64"  },
          { name: "expiresAt",  type: "uint64"  },
          { name: "active",     type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "isLicenseValid",
    stateMutability: "view",
    inputs: [
      { name: "licenseId", type: "uint256" },
      { name: "at",        type: "uint64"  }, // timestamp to check; 0 = block.timestamp
    ],
    outputs: [{ name: "", type: "bool" }],
  },

  // ─── Bio-IP: royalty accrual & claim ──────────────────────────────────────────
  {
    type: "function",
    name: "getPendingRoyalties",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "uint256" }],
    outputs: [
      { name: "amountWei",    type: "uint256" },
      { name: "periodStart",  type: "uint64"  },
      { name: "periodEnd",    type: "uint64"  },
    ],
  },
  {
    type: "function",
    name: "claimRoyalty",
    stateMutability: "nonpayable",
    inputs: [{ name: "assetId", type: "uint256" }],
    outputs: [
      { name: "amountWei", type: "uint256" }, // MATIC transferred to msg.sender
    ],
  },

  // ─── Admin / pausable ────────────────────────────────────────────────────────
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs:  [],
    outputs: [],
  },
  {
    type: "function",
    name: "unpause",
    stateMutability: "nonpayable",
    inputs:  [],
    outputs: [],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "bool" }],
  },

  // ─── Events ───────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "BioIPMinted",
    inputs: [
      { name: "tokenId",       type: "uint256", indexed: true  },
      { name: "owner",         type: "address", indexed: true  },
      { name: "signatureHash", type: "bytes32", indexed: false },
      { name: "metadataUri",   type: "string",  indexed: false },
      { name: "royaltyBps",    type: "uint16",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "LicenseTransferred",
    inputs: [
      { name: "licenseId", type: "uint256", indexed: true  },
      { name: "assetId",   type: "uint256", indexed: true  },
      { name: "buyer",     type: "address", indexed: true  },
      { name: "scope",     type: "uint8",   indexed: false },
      { name: "expiresAt", type: "uint64",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "RoyaltyClaimed",
    inputs: [
      { name: "assetId",   type: "uint256", indexed: true  },
      { name: "owner",     type: "address", indexed: true  },
      { name: "amountWei", type: "uint256", indexed: false },
      { name: "claimedAt", type: "uint64",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "Transfer",  // ERC-721
    inputs: [
      { name: "from",    type: "address", indexed: true },
      { name: "to",      type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },

  // ─── Custom errors ────────────────────────────────────────────────────────────
  { type: "error", name: "NotTokenOwner",     inputs: [] },
  { type: "error", name: "AssetNotActive",    inputs: [] },
  { type: "error", name: "LicenseExpired",    inputs: [{ name: "licenseId", type: "uint256" }] },
  { type: "error", name: "InsufficientFunds", inputs: [{ name: "required", type: "uint256" }] },
  { type: "error", name: "NoPendingRoyalty",  inputs: [] },
  { type: "error", name: "InvalidRoyaltyBps", inputs: [{ name: "bps", type: "uint16" }] },
  { type: "error", name: "ContractPaused",    inputs: [] },
] as const;

// Scope enum mirrors the uint8 in the contract
export const LicenseScopeEnum = {
  exclusive:     0,
  non_exclusive: 1,
  personal_only: 2,
} as const satisfies Record<string, number>;

export type LicenseScopeEnum = typeof LicenseScopeEnum[keyof typeof LicenseScopeEnum];
