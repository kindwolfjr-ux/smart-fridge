"use client";

import { useEffect, useState, PropsWithChildren } from "react";
import clsx from "clsx";

type Props = { className?: string };

export default function FooterActions({ children, className }: PropsWithChildren<Props>) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handleFocus = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // если фокус внутри input, textarea или contenteditable — скрываем футер
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true"
      ) {
        setHidden(true);
      }
    };

    const handleBlur = () => {
      // показываем футер обратно через небольшую задержку (когда клавиатура закрывается)
      setTimeout(() => setHidden(false), 150);
    };

    window.addEventListener("focusin", handleFocus);
    window.addEventListener("focusout", handleBlur);
    return () => {
      window.removeEventListener("focusin", handleFocus);
      window.removeEventListener("focusout", handleBlur);
    };
  }, []);

  return (
    <div
      role="contentinfo"
      className={clsx(
        "fixed bottom-0 inset-x-0 z-50 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        "pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] transition-all duration-300",
        hidden ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100",
        className
      )}
    >
      <div className="mx-auto w-full max-w-3xl px-4 flex items-center justify-between gap-3">
        {children}
      </div>
    </div>
  );
}
