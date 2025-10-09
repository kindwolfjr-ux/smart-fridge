"use client";

import { useRef, useState } from "react";
import UploadZone from "@/components/ui/upload-zone";
import ConfirmProductsPanel from "@/components/confirm-products-panel";

export default function HomePage() {
  const [recognized, setRecognized] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [flashConfirm, setFlashConfirm] = useState(false); // подсветка панели

  // якорь для скролла к панели
  const confirmRef = useRef<HTMLDivElement | null>(null);

  const revealPanelAndScroll = () => {
    // даём React дорисовать панель и мягко скроллим к ней
    setTimeout(() => {
      confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // короткая подсветка панели, чтобы глаз зацепился
      setFlashConfirm(true);
      setTimeout(() => setFlashConfirm(false), 1200);
    }, 100);
  };

  const handleRecognized = (products: string[]) => {
    setRecognized(products);
    setIsScanning(false);   // важно: гасим подпись «Распознаём…»
    setManualMode(false);   // если был ручной режим — выключаем
    revealPanelAndScroll();
  };

  const handleManualClick = () => {
    // включаем ручной режим и показываем (в т.ч. пустую) панель
    setManualMode(true);
    if (recognized.length === 0) setRecognized([]); // панель рендерится даже если пусто
    revealPanelAndScroll();
  };

  // панель показываем либо при ручном режиме, либо когда уже есть распознанные продукты
  const shouldShowPanel = manualMode || recognized.length > 0;
  // кнопку ручного ввода показываем только когда панель ещё не отображается
  const shouldShowManualButton = !shouldShowPanel;

  // панель присылает "очистить" → скрываем панель и возвращаем кнопку
  const handleClearPanel = () => {
    setRecognized([]);
    setManualMode(false);
  };

  return (
    <main className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Что приготовить?</h1>

      {/* drop-зона */}
      <UploadZone
        onRecognized={handleRecognized}
        onScanningChange={setIsScanning}
      />

      {/* подпись под зоной при распознавании */}
      {isScanning && <p className="text-sm text-gray-500">Распознаём продукты…</p>}

      {/* кнопка "Написать продукты вручную" — скрываем после распознавания/при показанной панели */}
      {shouldShowManualButton && (
        <button
          type="button"
          onClick={handleManualClick}
          className="w-full rounded-xl border px-4 py-3 text-sm hover:bg-gray-50"
        >
          Написать продукты вручную
        </button>
      )}

      {/* панель подтверждения + якорь для скролла */}
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
            onClear={handleClearPanel}
          />
        </div>
      )}
    </main>
  );
}
