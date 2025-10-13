// src/app/api/admin/stats/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// простая утилита подсчёта
function countByName(rows: Array<{ name: string }> | null) {
  const map: Record<string, number> = {};
  for (const r of rows ?? []) {
    if (!r?.name) continue;
    map[r.name] = (map[r.name] ?? 0) + 1;
  }
  return map;
}

export async function GET() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sinceTodayISO = startOfToday.toISOString();
  const since7ISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // ⚠️ тянем только нужные поля; лимит поставим щадящий на всякий
  const LIMIT = 50000; // при росте объёма лучше перейти на RPC/SQL агрегацию

  const { data: todayRows, error: e1 } = await supabaseAdmin
    .from("events")
    .select("name")
    .gte("ts", sinceTodayISO)
    .order("ts", { ascending: false })
    .limit(LIMIT);

  const { data: w7Rows, error: e2 } = await supabaseAdmin
    .from("events")
    .select("name")
    .gte("ts", since7ISO)
    .order("ts", { ascending: false })
    .limit(LIMIT);

  if (e1 || e2) {
    return NextResponse.json(
      { ok: false, error: (e1 || e2)?.message ?? "query_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    today: countByName(todayRows),
    last7: countByName(w7Rows),
  });
}
