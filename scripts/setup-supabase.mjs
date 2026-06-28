/**
 * One-time Supabase setup:
 *  1. Create `bio-ip-videos` storage bucket (public, 500 MB limit)
 *  2. Apply ALTER TABLE migrations for bio_ip_assets
 *  3. Create `licenses` table if not exists
 *
 * Run: node scripts/setup-supabase.mjs
 * Requires: SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ───────────────────────────────────────────────────────────
const envRaw = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envRaw.split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL      = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY  = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes("여기는")) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다.");
  console.error("   Supabase Dashboard → Project Settings → API → service_role 키를 복사해 .env.local에 추가하세요.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── 1. Storage bucket ─────────────────────────────────────────────────────────
console.log("\n[1/3] bio-ip-videos 버킷 생성 중…");
const { data: bucket, error: bucketErr } = await sb.storage.createBucket("bio-ip-videos", {
  public: true,
  fileSizeLimit: 524_288_000,   // 500 MB
  allowedMimeTypes: ["video/webm", "video/mp4", "video/quicktime", "video/*"],
});

if (bucketErr?.message?.includes("already exists") || bucketErr?.message?.includes("Duplicate")) {
  console.log("   ✓ 버킷이 이미 존재합니다.");
} else if (bucketErr) {
  console.error("   ❌ 버킷 생성 실패:", bucketErr.message);
} else {
  console.log("   ✓ 버킷 생성 완료:", bucket);
}

// ── 2. Storage RLS policy — allow all uploads (dev) ──────────────────────────
// If you want auth-only uploads, replace `true` with `auth.uid()::text = (storage.foldername(name))[1]`
console.log("\n[2/3] bio_ip_assets 테이블 컬럼 추가 중…");
const migrations = [
  `ALTER TABLE bio_ip_assets ADD COLUMN IF NOT EXISTS video_url     TEXT`,
  `ALTER TABLE bio_ip_assets ADD COLUMN IF NOT EXISTS face_landmarks JSONB`,
  `ALTER TABLE bio_ip_assets ADD COLUMN IF NOT EXISTS pose_landmarks JSONB`,
  `ALTER TABLE bio_ip_assets ADD COLUMN IF NOT EXISTS watermark_id  TEXT`,
  `ALTER TABLE bio_ip_assets ALTER COLUMN bio_signature_id DROP NOT NULL`,
  `ALTER TABLE bio_ip_assets ALTER COLUMN description      DROP NOT NULL`,
];

for (const sql of migrations) {
  const { error } = await sb.rpc("exec_sql", { query: sql }).catch(() => ({ error: { message: "rpc unavailable" } }));
  if (error) {
    // Fall back: some Supabase tiers don't expose exec_sql — just warn
    console.log(`   ⚠️  수동 실행 필요: ${sql.slice(0, 60)}…`);
  } else {
    console.log(`   ✓ ${sql.slice(0, 60)}…`);
  }
}

// ── 3. licenses table ─────────────────────────────────────────────────────────
console.log("\n[3/3] licenses 테이블 확인 중…");
const { error: licErr } = await sb.from("licenses").select("id").limit(1);
if (licErr?.message?.includes("does not exist")) {
  console.log("   licenses 테이블이 없습니다. Supabase SQL Editor에서 아래 SQL을 실행하세요:\n");
  console.log(`CREATE TABLE IF NOT EXISTS licenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bio_ip_id    UUID REFERENCES bio_ip_assets(id),
  buyer_address TEXT NOT NULL,
  tx_hash      TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now()
);`);
} else {
  console.log("   ✓ licenses 테이블 존재 확인");
}

console.log("\n══════════════════════════════════════");
console.log("셋업 완료! 아직 SQL 마이그레이션이 적용 안 됐다면");
console.log("Supabase Dashboard → SQL Editor에서 upload.ts 상단 주석의 SQL을 실행하세요.");
console.log("══════════════════════════════════════\n");
