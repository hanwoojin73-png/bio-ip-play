export {
  mintBioIP,
  transferLicense,
  claimRoyalty,
  getPendingRoyalties,
  getTokenOwner,
  isLicenseValid,
  isContractPaused,
  hashBioSignature,
  ensureAmoyNetwork,
  getSigner,
  getReadProvider,
  txUrl,
  tokenUrl,
  ContractError,
  NETWORK,
  CONTRACT_ADDRESS,
  type MintResult,
  type TransferResult,
  type ClaimResult,
  type PendingRoyalty,
} from "./contract";

export { BIO_IP_REGISTRY_ABI, LicenseScopeEnum } from "./abi";
