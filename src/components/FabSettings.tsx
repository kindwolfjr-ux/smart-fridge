"use client";

import Link from "next/link";

export default function FabSettings() {
  return (
    <Link
      href="/settings"
      className="fixed bottom-4 right-4 z-40 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg hover:opacity-90"
      aria-label="Открыть настройки"
    >
      ⚙️ Настройки
    </Link>
  );
}
