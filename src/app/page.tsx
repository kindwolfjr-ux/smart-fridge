"use client";

import ScanInput from "@/components/scan-input";

export default function HomePage() {
  return (
    <main className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Что приготовить?</h1>
      <ScanInput />
      {/* здесь можешь добавить ссылки/описание/кнопки и т.п. */}
    </main>
  );
}
