"use client";

import Link from "next/link";

export default function SettingsButton() {
  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40"
      aria-label="Открыть настройки"
    >
      <span>Настройки</span>
    </Link>
  );
}
