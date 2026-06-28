import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// ─── Browser client (use inside Client Components) ────────────────────────────

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Singleton — avoids re-creating the client on every render.
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_client) _client = createClient();
  return _client;
}

// ─── Typed table helpers ──────────────────────────────────────────────────────
// Usage: supabase.from("bio_ip_assets").select("*")
// All return types are inferred from Database generics.

export { type Database };
