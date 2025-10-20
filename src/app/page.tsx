"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/ui/upload-zone";
import ConfirmProductsPanel from "@/components/confirm-products-panel";
import ProgressButton from "@/components/ProgressButton";

// ▼ добавлено
import FooterActions from "@/components/ui/FooterActions";
import SettingsButton from "@/components/ui/SettingsButton";

type ProductQty = {
  name: string;
  detailed?: boolean;
  qty?: number;
  unit?: "g" | "ml" | "pcs";
};

export default function HomePage() {
  const [recognized, setRecognized] = useState<string[]>([]);
  const [recognizedQty, setRecognizedQty] = useState<ProductQty[]>([]);
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
    const names = products.map((s) => s.trim()).filter(Boolean);
    setRecognized(names);
    setRecognizedQty(names.map((n) => ({ name: n, detailed: false })));
    setIsScanning(false);
    setManualMode(false);
    revealPanelAndScroll();
  };

  const handleManualClick = () => {
    setManualMode(true);
    if (recognized.length === 0) {
      setRecognized([]);
      setRecognizedQty([]);
    }
    revealPanelAndScroll();
  };

  const shouldShowPanel = manualMode || recognized.length > 0;
  const shouldShowManualButton = !shouldShowPanel;

  const handleClearPanel = () => {
    setRecognized([]);
    setRecognizedQty([]);
    setManualMode(false);
  };

  // схлопывать, если уже есть распознанные ИЛИ пользователь включил ручной ввод
  const compactPhoto = !isScanning && (recognized.length > 0 || manualMode);

  const generateRecipes = async () => {
    setErrorMsg(null);
    const items = recognized.map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) {
      throw new Error("Добавьте продукты, чтобы показать рецепт");
    }
    try {
      const detailed = recognizedQty
        .filter((i) => i.detailed && typeof i.qty === "number" && i.unit)
        .map((i) => ({ name: i.name.trim(), qty: i.qty as number, unit: i.unit as "g" | "ml" | "pcs" }));
      sessionStorage.setItem("products_qty", JSON.stringify(detailed));
    } catch {}
    try {
      sessionStorage.removeItem("recipes_payload");
    } catch {}
    const q = encodeURIComponent(items.join(","));
    router.replace(`/recipes?items=${q}`);
  };

  return (
    <main className="p-6 pb-[calc(80px+env(safe-area-inset-bottom))] mx-auto space-y-6 text-center max-w-xl sm:max-w-2xl">
      <h1 className="whitespace-nowrap text-[22px] sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#1e1e1e] leading-tight">
        <span>Что сегодня готовим, Шеф?</span>
      </h1>

      {/* Карточка загрузки фото — единое «стекло» */}
      <div
        className={[
          "glass-card rounded-3xl",
          "transition-all duration-500 ease-out overflow-hidden",
          compactPhoto ? "p-3" : "p-0",
        ].join(" ")}
      >
        <div
          className={[
            "transition-all duration-500 ease-out",
            compactPhoto ? "max-h-40 sm:max-h-48" : "max-h-[22rem] sm:max-h-[28rem]",
          ].join(" ")}
        >
          <UploadZone
            compact={compactPhoto}
            onRecognized={handleRecognized}
            onScanningChange={setIsScanning}
          />
        </div>
      </div>

      {isScanning && <p className="text-sm text-gray-600">Распознаём продукты…</p>}

      {shouldShowManualButton && (
        <button
          type="button"
          onClick={handleManualClick}
          className="w-full rounded-2xl px-4 py-3 text-sm glass-card hover:shadow-md transition"
        >
          Написать продукты вручную
        </button>
      )}

      {shouldShowPanel && (
        <div
          ref={confirmRef}
          className={[
            "glass rounded-3xl border glass-border p-4 text-left",
            "text-slate-900",
            flashConfirm ? "ring-2 ring-black/10 animate-[pulse_0.6s_ease-in-out_2]" : "",
          ].join(" ")}
        >
          <ConfirmProductsPanel
            initialItems={recognized}
            onChange={setRecognized}
            onChangeQty={(list) => setRecognizedQty(list)}
            onClear={handleClearPanel}
            hideAction
          />

          {/* CTA «Показать рецепт» — персиковый градиент */}
          <div className="mt-4">
            <ProgressButton
              onStart={generateRecipes}
              idleText="Показать рецепт"
              onError={(e) => setErrorMsg(e instanceof Error ? e.message : "Что-то пошло не так")}
              className="btn-peach w-full rounded-[28px] px-6 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            {errorMsg && <p className="mt-2 text-sm text-red-500">Ошибка: {errorMsg}</p>}
          </div>
        </div>
      )}

      {/* ▼ тихий футер с «Настройки» справа */}
      <FooterActions>
        <div />{/* пустой левый слот */}
        <SettingsButton />
      </FooterActions>
    </main>
  );
}
