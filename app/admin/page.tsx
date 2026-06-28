import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import AdminDashboard, { type AdminData } from "./dashboard";
import { ADMIN_COOKIE } from "./_constants";
import type { BioIPAssetRow, ChallengeRow, RoyaltyPaymentRow } from "@/types/database";

// ─── Server-side data fetch ───────────────────────────────────────────────────

async function fetchAdminData(): Promise<AdminData> {
  try {
    const db = createAdminSupabaseClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { count: totalUsers },
      { count: totalAssets },
      { count: todaySignups },
      { data: confirmedPayments },
      { data: challenges },
      { data: pendingAssets },
      { data: recentPurchases },
      { data: allAssets },
    ] = await Promise.all([
      db.from("users").select("*", { count: "exact", head: true }),
      db.from("bio_ip_assets").select("*", { count: "exact", head: true }),
      db
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
      db
        .from("royalty_payments")
        .select("*")
        .eq("status", "confirmed"),
      db
        .from("challenges")
        .select("*")
        .order("filed_at", { ascending: false })
        .limit(10),
      db
        .from("bio_ip_assets")
        .select("*")
        .eq("status", "draft")
        .order("registered_at", { ascending: false }),
      db
        .from("royalty_payments")
        .select("*")
        .order("paid_at", { ascending: false })
        .limit(10),
      db.from("bio_ip_assets").select("*"),
    ]);

    const safePayments  = (confirmedPayments as RoyaltyPaymentRow[] | null) ?? [];
    const safeAllAssets = (allAssets         as BioIPAssetRow[]         | null) ?? [];

    const totalRevenue = safePayments.reduce(
      (sum, p) => sum + (p.amount_value ?? 0),
      0,
    );

    const assetMap = Object.fromEntries(
      safeAllAssets.map((a) => [a.id, a.title]),
    );

    return {
      stats: {
        totalUsers:   totalUsers   ?? 0,
        totalAssets:  totalAssets  ?? 0,
        totalRevenue,
        todaySignups: todaySignups ?? 0,
      },
      challenges:    ((challenges    as ChallengeRow[]       | null) ?? []),
      purchases:     ((recentPurchases as RoyaltyPaymentRow[] | null) ?? []),
      pendingAssets: ((pendingAssets  as BioIPAssetRow[]     | null) ?? []),
      assetMap,
    };
  } catch (err) {
    return {
      stats: { totalUsers: 0, totalAssets: 0, totalRevenue: 0, todaySignups: 0 },
      challenges:    [],
      purchases:     [],
      pendingAssets: [],
      assetMap:      {},
      fetchError: err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.",
    };
  }
}

// ─── Login form (inline server action — no "use client" needed) ───────────────

function LoginPage({ loginError }: { loginError?: boolean }) {
  async function handleLogin(formData: FormData) {
    "use server";

    const password  = formData.get("password") as string;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (!adminPass || password !== adminPass) {
      redirect("/admin?error=1");
    }

    cookies().set(ADMIN_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge:  60 * 60 * 8, // 8 h
      path:    "/admin",
      sameSite: "strict",
    });

    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        {/* Logo */}
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-700/50 bg-violet-900/40">
            <svg className="h-7 w-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-zinc-500">BIO-IP Play 관리자 전용</p>
        </div>

        {loginError && (
          <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-2.5 text-center text-sm text-red-300">
            비밀번호가 올바르지 않습니다.
          </div>
        )}

        <form action={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pw" className="text-xs font-medium text-zinc-400">
              관리자 비밀번호
            </label>
            <input
              id="pw"
              name="password"
              type="password"
              required
              autoFocus
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98]"
          >
            로그인
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600">
          환경변수 <code className="font-mono text-zinc-500">ADMIN_PASSWORD</code> 로 설정된 값을 입력하세요.
        </p>
      </div>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const isAuthed = cookies().get(ADMIN_COOKIE)?.value === "1";

  if (!isAuthed) {
    return <LoginPage loginError={searchParams.error === "1"} />;
  }

  const data = await fetchAdminData();

  async function handleLogout() {
    "use server";
    cookies().delete(ADMIN_COOKIE);
    redirect("/admin");
  }

  return <AdminDashboard data={data} logoutAction={handleLogout} />;
}
