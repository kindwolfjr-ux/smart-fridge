// src/components/ui/ToggleSwitch.tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  // чтобы клик по всей строке работал
  asButton?: boolean;
};

export default function ToggleSwitch({
  checked,
  onChange,
  id,
  disabled,
  className = "",
  asButton = false,
}: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // поддержка Enter/Space уже есть у role="switch"
  // фокус после клика по обёртке
  useEffect(() => {
    if (!asButton || !btnRef.current) return;
  }, [asButton]);

  return (
    <button
      ref={btnRef}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      id={id}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border transition",
        checked
          ? "bg-slate-900 border-slate-900"
          : "bg-slate-200 border-slate-200",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50",
        "motion-safe:transition-colors",
        className,
      ].join(" ")}
    >
      {/* «Язычок» */}
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow",
          "motion-safe:transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}
