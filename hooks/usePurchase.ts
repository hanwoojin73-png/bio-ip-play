"use client";

/**
 * usePurchase — wagmi v3 hook for purchasing a Bio-IP license on Polygon Amoy.
 *
 * Flow:
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
  const { switchChainAsync }  = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [status,  setStatus]  = useState<PurchaseStatus>("idle");
  const [error,   setError]   = useState<string | null>(null);
  const [txHash,  setTxHash]  = useState<`0x${string}` | undefined>(undefined);

  // Prevents double Supabase insert in React StrictMode
  const savedRef         = useRef(false);
  const pendingBioIpRef  = useRef<string | null>(null);
  const pendingAddrRef   = useRef<string | null>(null);

  // ── Wait for on-chain confirmation ─────────────────────────────────────────
  const { data: receipt, isSuccess: receiptSuccess, isError: receiptError } =
    useWaitForTransactionReceipt({ hash: txHash, chainId: AMOY.id });

  // ── Supabase save when receipt lands ──────────────────────────────────────
  useEffect(() => {
    if (!receiptSuccess || !receipt || savedRef.current) return;
    const bioIpId = pendingBioIpRef.current;
    const addr    = pendingAddrRef.current;
    if (!bioIpId || !addr) return;

    savedRef.current = true;
    setStatus("saving");

    const supabase = getSupabaseClient();
    // `as any` — Database generic resolves insert type to never for new tables
    (supabase.from("licenses") as any)
      .insert({
        bio_ip_id:     bioIpId,
        buyer_address: addr,
        tx_hash:       receipt.transactionHash,
        purchased_at:  new Date().toISOString(),
      })
      .then(({ error: dbErr }: { error: { message: string } | null }) => {
        if (dbErr) {
          // DB save failed, but tx succeeded on-chain — log and continue
          console.warn("[usePurchase] Supabase insert failed:", dbErr.message);
        }
        setStatus("success");
      });
  }, [receiptSuccess, receipt]);

  // ── Handle receipt error ──────────────────────────────────────────────────
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

      setError(null);
      setStatus("idle");
      savedRef.current        = false;
      pendingBioIpRef.current = bioIpId;
      pendingAddrRef.current  = address;

      try {
        // 1. Ensure Polygon Amoy network
        if (chainId !== AMOY.id) {
          setStatus("switching-network");
          await switchChainAsync({ chainId: AMOY.id });
        }

        // 2. Send the transaction — waits for wallet signature
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
        setStatus("pending");
        // receipt flow continues in the useEffect above
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (/user rejected|4001/i.test(msg)) {
          setError("트랜잭션이 거부되었습니다.");
        } else if (/insufficient funds/i.test(msg)) {
          setError("MATIC 잔액이 부족합니다.");
        } else if (/contract address/i.test(msg)) {
          setError(msg);
        } else {
          // Truncate long viem error messages
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
  };
}
