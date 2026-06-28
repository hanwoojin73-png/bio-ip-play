"use client";

/**
 * usePurchase — wagmi v3 hook for purchasing a Bio-IP license on Polygon Amoy.
 *
 * Mock mode: set NEXT_PUBLIC_MOCK_BLOCKCHAIN=true to bypass the actual blockchain
 * transaction. A fake tx hash is generated, a 2-second delay simulates mining, and
 * the Supabase licenses insert still runs. Flip the env var to false to switch to
 * the real on-chain flow without changing any other code.
 *
 * Real flow:
 *  1. switchChain  → ensure wallet is on Polygon Amoy (chainId 80002)
 *  2. writeContract → call transferLicense(assetId, buyer, scope, expiresAt) payable
 *  3. waitForTransactionReceipt → poll until tx is mined (1 confirmation)
 *  4. Supabase insert → save { bio_ip_id, buyer_address, tx_hash, purchased_at }
 *
 * Required env:  NEXT_PUBLIC_BIO_IP_CONTRACT_ADDRESS
 * Required DB:   licenses table (see SQL below)
 *
 * ── SQL migration (run in Supabase Dashboard → SQL Editor) ─────────────────
 * CREATE TABLE IF NOT EXISTS licenses (
 *   id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *   bio_ip_id      TEXT        NOT NULL,
 *   buyer_address  TEXT        NOT NULL,
 *   tx_hash        TEXT        NOT NULL UNIQUE,
 *   purchased_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "allow insert" ON licenses FOR INSERT WITH CHECK (true);
 * CREATE POLICY "allow read"   ON licenses FOR SELECT USING (true);
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { BIO_IP_REGISTRY_ABI } from "@/lib/blockchain/abi";
import { CONTRACT_ADDRESS, AMOY } from "@/lib/blockchain/wallet";
import { getSupabaseClient } from "@/lib/supabase";

// ─── Mock mode ────────────────────────────────────────────────────────────────

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_BLOCKCHAIN === "true";
const MOCK_BUYER = "0x0000000000000000000000000000000000000000" as const;

function generateMockTxHash(): `0x${string}` {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return ("0x" + Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Purchase status state machine */
export type PurchaseStatus =
  | "idle"
  | "switching-network"
  | "signing"
  | "pending"
  | "saving"
  | "success"
  | "error";

/**
 * Parameters for purchaseLicense().
 *
 * @param bioIpId    - Asset ID (marketplace string or on-chain token ID)
 * @param tokenId    - On-chain uint256 token ID (BigInt). Use 0n if unknown for demo.
 * @param price      - License price in wei (MATIC). E.g. parseEther("0.001")
 * @param scope      - 0 = exclusive | 1 = non_exclusive | 2 = personal_only
 * @param expiresAt  - Unix timestamp (BigInt); 0n = perpetual
 */
export interface PurchaseParams {
  bioIpId:    string;
  tokenId:    bigint;
  price:      bigint;
  scope?:     0 | 1 | 2;
  expiresAt?: bigint;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePurchase() {
  const { address, chainId } = useAccount();
  const { switchChainAsync }   = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [status,       setStatus]       = useState<PurchaseStatus>("idle");
  const [error,        setError]        = useState<string | null>(null);
  const [txHash,       setTxHash]       = useState<`0x${string}` | undefined>(undefined);
  // chainTxHash is only set for real on-chain txs — keeps useWaitForTransactionReceipt
  // from trying to look up a fake hash on Amoy.
  const [chainTxHash,  setChainTxHash]  = useState<`0x${string}` | undefined>(undefined);

  // Prevents double Supabase insert in React StrictMode
  const savedRef         = useRef(false);
  const pendingBioIpRef  = useRef<string | null>(null);
  const pendingAddrRef   = useRef<string | null>(null);

  // ── Wait for on-chain confirmation (real mode only) ────────────────────────
  const { data: receipt, isSuccess: receiptSuccess, isError: receiptError } =
    useWaitForTransactionReceipt({ hash: chainTxHash, chainId: AMOY.id });

  // ── Supabase save when real receipt lands ─────────────────────────────────
  useEffect(() => {
    if (!receiptSuccess || !receipt || !chainTxHash || savedRef.current) return;
    const bioIpId = pendingBioIpRef.current;
    const addr    = pendingAddrRef.current;
    if (!bioIpId || !addr) return;

    savedRef.current = true;
    setStatus("saving");

    const supabase = getSupabaseClient();
    (supabase.from("licenses") as any)
      .insert({
        bio_ip_id:     bioIpId,
        buyer_address: addr,
        tx_hash:       receipt.transactionHash,
        purchased_at:  new Date().toISOString(),
      })
      .then(({ error: dbErr }: { error: { message: string } | null }) => {
        if (dbErr) {
          console.warn("[usePurchase] Supabase insert failed:", dbErr.message);
        }
        setStatus("success");
      });
  }, [receiptSuccess, receipt, chainTxHash]);

  // ── Handle real-tx receipt error ──────────────────────────────────────────
  useEffect(() => {
    if (receiptError && status === "pending") {
      setError("트랜잭션 확인에 실패했습니다. Amoy explorer에서 직접 확인해주세요.");
      setStatus("error");
    }
  }, [receiptError, status]);

  // ── Main purchase action ──────────────────────────────────────────────────
  const purchaseLicense = useCallback(
    async ({
      bioIpId,
      tokenId,
      price,
      scope     = 1,
      expiresAt = 0n,
    }: PurchaseParams) => {
      setError(null);
      setStatus("idle");
      savedRef.current        = false;
      pendingBioIpRef.current = bioIpId;
      pendingAddrRef.current  = address ?? MOCK_BUYER;

      try {
        // ── Mock mode ────────────────────────────────────────────────────────
        if (IS_MOCK) {
          setStatus("signing");
          await new Promise((r) => setTimeout(r, 800)); // simulate wallet popup

          const mockHash = generateMockTxHash();
          setTxHash(mockHash);
          setStatus("pending");
          await new Promise((r) => setTimeout(r, 2000)); // simulate block mining

          setStatus("saving");
          const supabase = getSupabaseClient();
          const buyerAddr = address ?? MOCK_BUYER;
          savedRef.current = true;

          const { error: dbErr } = await (supabase.from("licenses") as any).insert({
            bio_ip_id:     bioIpId,
            buyer_address: buyerAddr,
            tx_hash:       mockHash,
            purchased_at:  new Date().toISOString(),
          }) as { error: { message: string } | null };

          if (dbErr) {
            console.warn("[usePurchase] Mock Supabase insert failed:", dbErr.message);
          }
          setStatus("success");
          return;
        }

        // ── Real mode ────────────────────────────────────────────────────────
        if (!address) {
          setError("지갑을 먼저 연결해주세요.");
          setStatus("error");
          return;
        }
        if (!CONTRACT_ADDRESS) {
          setError("컨트랙트 주소가 설정되지 않았습니다. (NEXT_PUBLIC_BIO_IP_CONTRACT_ADDRESS)");
          setStatus("error");
          return;
        }

        if (chainId !== AMOY.id) {
          setStatus("switching-network");
          await switchChainAsync({ chainId: AMOY.id });
        }

        setStatus("signing");
        const hash = await writeContractAsync({
          address:      CONTRACT_ADDRESS,
          abi:          BIO_IP_REGISTRY_ABI,
          functionName: "transferLicense",
          args:         [tokenId, address, scope, expiresAt],
          value:        price,
          chainId:      AMOY.id,
        });

        setTxHash(hash);
        setChainTxHash(hash); // triggers useWaitForTransactionReceipt
        setStatus("pending");
        // Supabase save continues in the useEffect above
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (/user rejected|4001/i.test(msg)) {
          setError("트랜잭션이 거부되었습니다.");
        } else if (/insufficient funds/i.test(msg)) {
          setError("MATIC 잔액이 부족합니다.");
        } else if (/contract address/i.test(msg)) {
          setError(msg);
        } else {
          setError(msg.slice(0, 120));
        }
        setStatus("error");
      }
    },
    [address, chainId, switchChainAsync, writeContractAsync],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxHash(undefined);
    setChainTxHash(undefined);
    savedRef.current        = false;
    pendingBioIpRef.current = null;
    pendingAddrRef.current  = null;
  }, []);

  return {
    purchaseLicense,
    reset,
    status,
    error,
    txHash,
    address,
    isConnected: !!address,
    isMock: IS_MOCK,
  };
}
