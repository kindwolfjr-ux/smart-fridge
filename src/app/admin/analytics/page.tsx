export const dynamic = "force-dynamic";

type StatsShort = {
  ok: boolean;
  today: Record<string, number>;
  last7: Record<string, number>;
};

function getCount(obj: Record<string, number> | undefined, ...keys: string[]) {
  if (!obj) return 0;
  for (const k of keys) {
    if (typeof obj[k] === "number") return obj[k]!;
  }
  return 0;
}

async function getStats(): Promise<StatsShort> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/admin/stats`, {
    method: "GET",
    cache: "no-store",
    headers: { "x-admin-secret": process.env.ADMIN_SECRET ?? "" }, // SSR доступ через middleware
  });
  if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
  return res.json();
}

export default async function AdminAnalyticsPage() {
  const data = await getStats();
  const today = data?.today ?? {};
  const last7 = data?.last7 ?? {};

  // Поддерживаем разные названия полей (photo_upload vs photo_uploaded и т.п.)
  const kToday = {
    total: Object.values(today).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0),
    app_open: getCount(today, "app_open"),
    photo: getCount(today, "photo_upload", "photo_uploaded"),
    manual_input: getCount(today, "manual_input"),
    recipes_requested: getCount(today, "recipes_requested"),
    token_spent: getCount(today, "token_spent"),
  };

  const k7 = {
    total: Object.values(last7).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0),
    app_open: getCount(last7, "app_open"),
    photo: getCount(last7, "photo_upload", "photo_uploaded"),
    manual_input: getCount(last7, "manual_input"),
    recipes_requested: getCount(last7, "recipes_requested"),
    token_spent: getCount(last7, "token_spent"),
  };

  const Card = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value ?? 0}</div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card label="Today / total" value={kToday.total} />
        <Card label="Today / opens" value={kToday.app_open} />
        <Card label="Today / photos" value={kToday.photo} />
        <Card label="Today / manual" value={kToday.manual_input} />
        <Card label="Today / recipes" value={kToday.recipes_requested} />
        <Card label="Today / tokens" value={kToday.token_spent} />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card label="Last 7d / total" value={k7.total} />
        <Card label="Last 7d / opens" value={k7.app_open} />
        <Card label="Last 7d / photos" value={k7.photo} />
        <Card label="Last 7d / manual" value={k7.manual_input} />
        <Card label="Last 7d / recipes" value={k7.recipes_requested} />
        <Card label="Last 7d / tokens" value={k7.token_spent} />
      </section>

      {/* Когда решим расширить API — добавим таблицу последних событий и график */}
    </div>
  );
}
