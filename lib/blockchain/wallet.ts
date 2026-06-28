/**
 * wagmi v3 + viem config for Polygon Amoy (chainId 80002).
 *
 * Usage:
 *   - Wrap your app with <Web3Provider> (components/Web3Provider.tsx)
 *   - Import CONTRACT_ADDRESS and AMOY_EXPLORER as needed in hooks/pages
 */

import { createConfig, http } from "wagmi";
import { polygonAmoy } from "viem/chains";
import { injected } from "wagmi/connectors";

// ─── Chain ────────────────────────────────────────────────────────────────────

export const AMOY = polygonAmoy;             // re-export for convenience
export const AMOY_EXPLORER = "https://amoy.polygonscan.com";
export const AMOY_RPC      = "https://rpc-amoy.polygon.technology";

// ─── Contract ─────────────────────────────────────────────────────────────────

/** BioIPRegistry contract address — set NEXT_PUBLIC_BIO_IP_CONTRACT_ADDRESS in .env.local */
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_BIO_IP_CONTRACT_ADDRESS ?? "") as `0x${string}`;

// ─── wagmi config ─────────────────────────────────────────────────────────────

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors: [
    injected(), // MetaMask / any injected browser wallet
  ],
  transports: {
    [polygonAmoy.id]: http(AMOY_RPC),
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shortened address for display: "0x1234…5678" */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Block-explorer URL for a transaction. */
export function amoyTxUrl(txHash: string): string {
  return `${AMOY_EXPLORER}/tx/${txHash}`;
}
