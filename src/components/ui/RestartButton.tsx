"use client";

import { useRouter } from "next/navigation";

export default function RestartButton() {
  const router = useRouter();

  function handleRestart() {
    try {
      localStorage.removeItem("recognized");
      localStorage.removeItem("recognizedQty");
      sessionStorage.removeItem("recipes");
      sessionStorage.removeItem("sessionId");
    } catch {}
    router.push("/"); // назад на главную
  }

  return (
    <button
      type="button"
      onClick={handleRestart}
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40"
    >
      <span aria-hidden>↺</span>
      <span>Начать заново</span>
    </button>
  );
}
