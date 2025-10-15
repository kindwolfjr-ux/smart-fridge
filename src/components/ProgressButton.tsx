"use client";

import { useEffect, useRef, useState } from "react";
import { ChefHat } from "lucide-react";

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

  // показ подсказки при 90–99%
  useEffect(() => {
    if (!loading || progress < 90 || progress >= 100) {
      setShowHint(false);
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
      return;
    }
    if (hintTimerRef.current == null) {
      hintTimerRef.current = window.setTimeout(() => setShowHint(true), hintDelayMs);
    }
    return () => {
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
    <div className={`relative`}>
      {/* мягкое «свечение» вокруг кнопки */}
      <div className="pointer-events-none absolute -inset-3 rounded-[32px] opacity-80 blur-lg"
           style={{
             background: "radial-gradient(60% 80% at 50% 50%, rgba(244, 167, 120, 0.45), rgba(244, 167, 120, 0.18) 60%, transparent 70%)"
           }} />

      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          // основная «пилюля» с живым градиентом
          `relative z-[1] w-full rounded-[28px] px-6 py-4 text-white font-medium shadow-lg 
           transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/30
           disabled:opacity-80 disabled:cursor-not-allowed
           ${className}`
        }
        style={{
          background:
            "linear-gradient(135deg, #F6B089 0%, #F09A79 25%, #F29D7B 50%, #F6B089 75%, #F09A79 100%)",
          backgroundSize: "200% 200%",
          animation: "gradient-move 6s ease infinite",
          boxShadow:
            "0 8px 24px rgba(244, 167, 120, 0.45), 0 2px 8px rgba(240, 154, 121, 0.35)",
        }}
        aria-busy={loading}
        aria-live="polite"
      >
        {!loading && (
          <span className="inline-flex items-center gap-2 justify-center">
            <ChefHat size={18} className="opacity-95" />
            {idleText}
          </span>
        )}

        {loading && (
          <>
            <div className="flex items-center gap-2">
              <span className="shrink-0">Готовим…</span>
              <span className="ml-auto tabular-nums text-white/90">
                {Math.round(progress)}%
              </span>
            </div>

            {/* прогресс-бар на оранжевом фоне — светлый */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25" aria-hidden>
              <div
                className="h-full w-0 transition-[width] duration-200 bg-white"
                style={{ width: `${progress}%` }}
              />
            </div>

            {showHint && (
              <p className="mt-2 text-xs text-white/85 animate-pulse">
                {hintText}
              </p>
            )}
          </>
        )}
      </button>

      {/* keyframes прямо в компоненте */}
      <style jsx>{`
        @keyframes gradient-move {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
