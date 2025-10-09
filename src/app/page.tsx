"use client";

import { useRef, useState } from "react";
import UploadZone from "@/components/ui/upload-zone";
import ConfirmProductsPanel from "@/components/confirm-products-panel";

export default function HomePage() {
  const [recognized, setRecognized] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [flashConfirm, setFlashConfirm] = useState(false);

  const confirmRef = useRef<HTMLDivElement | null>(null);

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
          <ConfirmProductsPanel initialItems={recognized} onClear={handleClearPanel} />
        </div>
      )}
    </main>
  );
}
