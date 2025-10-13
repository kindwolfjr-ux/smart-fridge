import AnalyticsToggle from "@/components/settings/AnalyticsToggle";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Настройки</h1>
      <AnalyticsToggle />
    </main>
  );
}
