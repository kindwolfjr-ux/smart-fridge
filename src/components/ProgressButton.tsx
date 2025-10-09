"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onStart: () => Promise<void>;
  idleText?: string;
  className?: string;
  onError?: (err: unknown) => void;
  /** Задержка перед показом подсказки после достижения 90% (мс) */
  hintDelayMs?: number;
  /** Текст подсказки под прогрессом при 90–99% */
  hintText?: string;
};

export default function ProgressButton({
  onStart,
  idleText = "Показать рецепт",
  className = "",
  onError,
  hintDelayMs = 1200,
  hintText = "ничего не зависло, подождите еще чуть-чуть",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  // авто-прогресс до 90%
  useEffect(() => {
    if (!loading) return;
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => (p < 90 ? Math.min(p + Math.random() * 8, 90) : p));
    }, 300);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [loading]);

  // логика показа подсказки: включается через hintDelayMs после достижения >=90%, исчезает на 100% или при остановке
  useEffect(() => {
    // сброс хинта, если ушли с 90–99 или прекратили загрузку
    if (!loading || progress < 90 || progress >= 100) {
      setShowHint(false);
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
      return;
    }

    // если уже идёт таймер — не ставим второй
    if (hintTimerRef.current == null) {
      hintTimerRef.current = window.setTimeout(() => {
        setShowHint(true);
      }, hintDelayMs);
    }

    return () => {
      // если deps изменились (например, прогресс прыгнул назад — на всякий), то сбросим
      if (progress < 90 || progress >= 100 || !loading) {
        if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
        setShowHint(false);
      }
    };
  }, [loading, progress, hintDelayMs]);

  const handleClick = async () => {
    if (loading) return;
    setProgress(0);
    setShowHint(false);
    if (hintTimerRef.current) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    setLoading(true);
    try {
      await onStart();
      // добегаем до 100 после успешного завершения
      setProgress(100);
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
      setProgress(0);
      setShowHint(false);
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`relative w-full rounded-2xl border border-border bg-background/60 backdrop-blur p-3 text-sm font-medium transition enabled:hover:shadow-md disabled:opacity-80 ${className}`}
      aria-busy={loading}
      aria-live="polite"
    >
      {!loading && <span>{idleText}</span>}

      {loading && (
        <>
          <div className="flex items-center gap-2">
            <span className="shrink-0">Готовим…</span>
            <span className="ml-auto tabular-nums">{Math.round(progress)}%</span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-border/60" aria-hidden>
            <div
              className="h-full w-0 transition-[width] duration-200 bg-foreground/70"
              style={{ width: `${progress}%` }}
            />
          </div>

          {showHint && (
            <p className="mt-2 text-xs text-gray-500 animate-pulse">
              {hintText}
            </p>
          )}
        </>
      )}
    </button>
  );
}
