"use client";

import { useState } from "react";

type Props = {
  /** сообщим родителю, что распознали продукты + отдадим превью */
  onRecognized: (products: string[], previewDataUrl?: string) => void; // <-- 2-й аргумент необязательный
  /** показать/скрыть индикатор "Распознаем продукты..." на родителе */
  onScanningChange?: (loading: boolean) => void;
  /** по желанию: уведомить о выбранном файле */
  onFileSelected?: (file: File) => void | Promise<void>;
  /** компактный режим (после распознавания) */
  compact?: boolean; // <-- добавили
};

export default function UploadZone({
  onRecognized,
  onScanningChange,
  onFileSelected,
  compact = false, // <-- дефолт
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOver, setIsOver] = useState(false); // подсветка при drag&drop

  // общая функция обработки файла (используем и для выбора, и для dnd)
  async function processFile(file: File) {
    try {
      try {
        await onFileSelected?.(file);
      } catch {}

      // читаем превью
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(dataUrl);

      // запрос в /api/scan
      setLoading(true);
      onScanningChange?.(true);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        const data = await res.json();

        // нормализуем продукты
        const rawProducts: string[] = Array.isArray(data?.products) ? data.products : [];
        const products = Array.from(
          new Set(
            rawProducts
              .map((x) => String(x).trim().toLowerCase())
              .filter(Boolean)
          )
        );

        if (products.length) {
          onRecognized(products, dataUrl); // второй аргумент опционален
        } else {
          alert("Не удалось распознать продукты. Добавь вручную или выбери другое фото.");
        }
      } catch (err) {
        console.error(err);
        alert("Ошибка при сканировании.");
      } finally {
        setLoading(false);
        onScanningChange?.(false);
      }
    } catch (e) {
      console.error(e);
      alert("Не удалось прочитать файл.");
    }
  }

  // выбор файла через инпут
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  // dnd-обработчики
  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsOver(true);
  }
  function handleDragLeave() {
    setIsOver(false);
  }
  async function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  return (
    <div
      className={[
        "rounded-2xl border border-dashed",
        "transition-all duration-500 ease-out",
        compact ? "p-3" : "p-0", // меньше паддинги в компактном
      ].join(" ")}
    >
      <label
        className={[
          "block cursor-pointer transition-all duration-300",
          isOver ? "outline outline-2 outline-black/40" : "",
        ].join(" ")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          // на айфоне появится выбор: камера/медиатека/файлы
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* оболочка drop-зоны */}
        <div
          className={[
            "flex flex-col items-center justify-center text-center",
            "transition-all duration-500 ease-out",
            compact ? "px-3 py-4" : "px-5 py-10",
          ].join(" ")}
        >
          {!preview ? (
            <>
              {!compact && (
                <>
                  <div className="mb-2 text-base font-medium">Выбрать фото продуктов</div>
                  <div className="text-xs text-gray-500">
                    Нажми или перетащи сюда фото (камера/галерея)
                  </div>

                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white">
                    {loading ? "Сканируем…" : "Загрузить фото"}
                  </div>
                </>
              )}
              {/* В компактном режиме до превью ничего не показываем */}
            </>
          ) : (
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="preview"
                className={[
                  "mx-auto w-auto rounded-xl object-contain transition-all duration-500 ease-out",
                  compact ? "h-28" : "max-h-64",
                ].join(" ")}
              />
              {/* подпись показываем только если реально идёт сканирование */}
              {loading && (
                <div className="mt-2 text-xs text-gray-500">Распознаём продукты…</div>
              )}
            </div>
          )}
        </div>
      </label>
    </div>
  );
}
