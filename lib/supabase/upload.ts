/**
 * Supabase Storage + DB helpers for Bio-IP captures.
 *
 * Required Supabase setup (run once in Dashboard → SQL Editor):
 * ─────────────────────────────────────────────────────────────
 * -- 1. Add columns to existing table
 * ALTER TABLE bio_ip_assets
 *   ADD COLUMN IF NOT EXISTS video_url     TEXT,
 *   ADD COLUMN IF NOT EXISTS face_landmarks JSONB,
 *   ADD COLUMN IF NOT EXISTS pose_landmarks JSONB,
 *   ADD COLUMN IF NOT EXISTS watermark_id  TEXT;
 *
 * -- 2. Make required columns nullable for capture-only rows
 * ALTER TABLE bio_ip_assets
 *   ALTER COLUMN bio_signature_id DROP NOT NULL,
 *   ALTER COLUMN description      DROP NOT NULL;
 *
 * -- 3. Create Storage bucket  (Dashboard → Storage → New bucket)
 * --    Name: bio-ip-videos  |  Public: true  |  File size: 500 MB
 *
 * -- 4. Storage RLS policies (Dashboard → Storage → bio-ip-videos → Policies)
 * --    INSERT: auth.uid()::text = (storage.foldername(name))[1]
 *    OR for anon uploads during dev: true
 * ─────────────────────────────────────────────────────────────
 */

import { getSupabaseClient } from "@/lib/supabase";

// ─── Local types ──────────────────────────────────────────────────────────────

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface SaveBioIPAssetInput {
  userId:         string;
  videoUrl:       string;
  faceLandmarks:  Landmark[];
  poseLandmarks:  Landmark[];
  watermarkId:    string;
  title?:         string;
}

/** Shape returned by getBioIPAssets */
export interface BioIPAssetRecord {
  id:              string;
  owner_id:        string;
  video_url:       string | null;
  watermark_id:    string | null;
  title:           string;
  status:          string;
  registered_at:   string;
  updated_at:      string;
  face_landmarks:  Landmark[] | null;
  pose_landmarks:  Landmark[] | null;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Uploads a video Blob to the `bio-ip-videos` bucket.
 * Returns the public URL of the uploaded file.
 */
export async function uploadVideo(blob: Blob, userId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const timestamp = Date.now();
  const ext  = blob.type.includes("mp4") ? "mp4" : "webm";
  const path = `${userId}/${userId}_${timestamp}.${ext}`;

  const { error } = await supabase.storage
    .from("bio-ip-videos")
    .upload(path, blob, { contentType: blob.type, upsert: false });

  if (error) throw new Error(`영상 업로드 실패: ${error.message}`);

  const { data } = supabase.storage.from("bio-ip-videos").getPublicUrl(path);
  return data.publicUrl;
}

// ─── Database ─────────────────────────────────────────────────────────────────

/**
 * Inserts a new Bio-IP asset row.
 * Returns the auto-generated row ID.
 */
export async function saveBioIPAsset(input: SaveBioIPAssetInput): Promise<string> {
  const supabase = getSupabaseClient();

  const dateLabel = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  // `as any` is intentional: the Database generic doesn't include the new
  // video_url / face_landmarks / pose_landmarks / watermark_id columns yet.
  const { data, error } = await (supabase.from("bio_ip_assets") as any)
    .insert({
      id:               crypto.randomUUID(),
      owner_id:         input.userId,
      video_url:        input.videoUrl,
      face_landmarks:   input.faceLandmarks,
      pose_landmarks:   input.poseLandmarks,
      watermark_id:     input.watermarkId,
      title:            input.title ?? `Bio-IP Capture ${dateLabel}`,
      bio_signature_id: input.watermarkId,
      description:      "",
      status:           "draft",
      license_terms:    {
        scope:               "personal_only",
        allowedUseCases:     [],
        prohibitedUseCases:  [],
        territoryCodes:      [],
        royaltyRateBps:      0,
      },
      challenge_ids:    [],
      metadata_uri:     null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`DB 저장 실패: ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Fetches all Bio-IP assets for a given user, newest first.
 */
export async function getBioIPAssets(userId: string): Promise<BioIPAssetRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await (supabase.from("bio_ip_assets") as any)
    .select(
      "id, owner_id, video_url, watermark_id, title, status, registered_at, updated_at, face_landmarks, pose_landmarks",
    )
    .eq("owner_id", userId)
    .order("registered_at", { ascending: false });

  if (error) throw new Error(`조회 실패: ${error.message}`);
  return (data ?? []) as BioIPAssetRecord[];
}

// ─── Auth / guest ID ──────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's ID, or creates/retrieves a guest UUID
 * stored in localStorage for anonymous sessions.
 */
export async function getOrCreateUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data }  = await supabase.auth.getUser();
  if (data.user) return data.user.id;

  const KEY = "bio_ip_guest_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
