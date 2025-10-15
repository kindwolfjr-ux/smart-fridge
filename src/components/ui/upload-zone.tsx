"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

type Props = {
  onRecognized: (products: string[], previewDataUrl?: string) => void;
  onScanningChange?: (loading: boolean) => void;
  onFileSelected?: (file: File) => void | Promise<void>;
  compact?: boolean;
};

export default function UploadZone({
  onRecognized,
  onScanningChange,
  onFileSelected,
  compact = false,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOver, setIsOver] = useState(false);

  async function processFile(file: File) {
    try {
      await onFileSelected?.(file);

      // аналитика
      try {
        const sizeKb = Math.round(file.size / 1024);
        track("photo_uploaded", {
          source: "file_input_or_dnd",
          sizeKb,
          type: file.type,
        });
      } catch {}

      // превью
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(dataUrl);
      setLoading(true);
      onScanningChange?.(true);

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        const data = await res.json();

        const raw: string[] = Array.isArray(data?.products) ? data.products : [];
        const products = Array.from(
          new Set(raw.map((x) => String(x).trim().toLowerCase()).filter(Boolean))
        );

        if (products.length) onRecognized(products, dataUrl);
        else alert("Не удалось распознать продукты. Добавь вручную или выбери другое фото.");
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

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
        "glass-card rounded-3xl border",
        "transition-all duration-500 ease-out",
        compact ? "p-3" : "p-0",
      ].join(" ")}
    >
      <label
        className={[
          "block cursor-pointer rounded-3xl transition-all duration-300",
          isOver ? "outline outline-2 outline-white/60" : "",
        ].join(" ")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

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
                  {/* Камера с ореолом и пульсацией */}
                  <div className="camera-wrap mb-5 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 camera-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.7}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7h3l1.5-2h9L18 7h3a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1zm9 3a4 4 0 100 8 4 4 0 000-8z"
                      />
                    </svg>
                  </div>

                  <div className="text-1xl font-extrabold tracking-tight text-[#1e1e1e]">
                    Нажми, чтобы сфоткать продукты
                  </div>
                  <div className="mt-0 text-sm text-gray-600">
                    Покажи что у тебя есть
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="preview"
                className={[
                  "mx-auto w-auto rounded-xl object-contain",
                  "transition-all duration-500 ease-out",
                  compact ? "h-28" : "max-h-64",
                ].join(" ")}
              />
              {loading && (
                <div className="mt-2 text-xs text-gray-600">
                  Распознаём продукты…
                </div>
              )}
            </div>
          )}
        </div>
      </label>
    </div>
  );
}
