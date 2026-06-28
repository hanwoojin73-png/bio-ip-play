"use server";

import { cookies } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { AssetStatus } from "@/types/bio-ip";
import { ADMIN_COOKIE } from "./_constants";

// Internal — not exported, so doesn't need to be async
function checkAuth(): boolean {
  return cookies().get(ADMIN_COOKIE)?.value === "1";
}

// ─── Asset moderation ─────────────────────────────────────────────────────────

export async function approveAsset(assetId: string): Promise<{ error?: string }> {
  if (!checkAuth()) return { error: "권한이 없습니다." };

  const db = createAdminSupabaseClient();
  // Supabase generic resolves Update to `never` with our custom Database type.
  // Casting the table builder to `any` unblocks; the runtime value is still correct.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = db.from("bio_ip_assets") as any;
  const { error } = await q
    .update({ status: "registered" satisfies AssetStatus })
    .eq("id", assetId);

  return error ? { error: (error as { message: string }).message } : {};
}

export async function rejectAsset(assetId: string): Promise<{ error?: string }> {
  if (!checkAuth()) return { error: "권한이 없습니다." };

  const db = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = db.from("bio_ip_assets") as any;
  const { error } = await q
    .update({ status: "revoked" satisfies AssetStatus })
    .eq("id", assetId);

  return error ? { error: (error as { message: string }).message } : {};
}
