"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/ui/upload-zone";
import ConfirmProductsPanel from "@/components/confirm-products-panel";
import ProgressButton from "@/components/ProgressButton";

export default function HomePage() {
  const [recognized, setRecognized] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [flashConfirm, setFlashConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const confirmRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const revealPanelAndScroll = () => {
    setTimeout(() => {
      confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFlashConfirm(true);
      setTimeout(() => setFlashConfirm(false), 1200);
    }, 100);
  };

  const handleRecognized = (products: string[]) => {
    setRecognized(products);
    setIsScanning(false);
    setManualMode(false);
    revealPanelAndScroll();
  };

  const handleManualClick = () => {
    setManualMode(true);
    if (recognized.length === 0) setRecognized([]);
    revealPanelAndScroll();
  };

  const shouldShowPanel = manualMode || recognized.length > 0;
  const shouldShowManualButton = !shouldShowPanel;

  const handleClearPanel = () => {
    setRecognized([]);
    setManualMode(false);
  };

  // Ждём генерацию на первой странице и уходим на /recipes, когда всё готово
const generateRecipes = async () => {
  setErrorMsg(null);

  const items = recognized.map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) {
    throw new Error("Добавьте продукты, чтобы показать рецепт");
  }

  // очищаем возможный старый payload
  try { sessionStorage.removeItem("recipes_payload"); } catch {}

  // обычный запрос БЕЗ AbortController/таймаутов — пусть спокойно «думает»
  const res = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products: items }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // если сервер реально упал — покажем краткую ошибку
    throw new Error(text || `Не удалось сгенерировать рецепты (HTTP ${res.status})`);
  }

  const json = await res.json();

  // кладём payload, чтобы /recipes открылся мгновенно без повторного запроса
  try {
    sessionStorage.setItem(
      "recipes_payload",
      JSON.stringify({ products: items, data: json })
    );
  } catch {}

  // и только теперь — переходим
  const q = encodeURIComponent(items.join(","));
  router.replace(`/recipes?items=${q}`);
};




  return (
    <main className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Что приготовить?</h1>

      <UploadZone onRecognized={handleRecognized} onScanningChange={setIsScanning} />

      {isScanning && <p className="text-sm text-gray-500">Распознаём продукты…</p>}

      {shouldShowManualButton && (
        <button
          type="button"
          onClick={handleManualClick}
          className="w-full rounded-xl border px-4 py-3 text-sm hover:bg-gray-50"
        >
          Написать продукты вручную
        </button>
      )}

      {shouldShowPanel && (
        <div
          ref={confirmRef}
          className={
            flashConfirm
              ? "rounded-xl ring-2 ring-black/10 animate-[pulse_0.6s_ease-in-out_2]"
              : ""
          }
        >
          <ConfirmProductsPanel
            initialItems={recognized}
            onChange={setRecognized}   // синхронизируем список из панели
            onClear={handleClearPanel}
            hideAction                 // скрываем старую кнопку внутри панели
          />

          {/* Прогресс-кнопка «Показать рецепт» */}
          <div className="mt-4">
            <ProgressButton
              onStart={generateRecipes}
              idleText="Показать рецепт"
              onError={(e) =>
                setErrorMsg(e instanceof Error ? e.message : "Что-то пошло не так")
              }
            />
            {errorMsg && (
              <p className="mt-2 text-sm text-red-500">Ошибка: {errorMsg}</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
