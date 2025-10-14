// src/components/GAReporter.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function GAReporter({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!window.gtag || !gaId) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    // Регистрируем просмотр страницы при каждом клиентском переходе
    window.gtag("config", gaId, { page_path: url });
  }, [pathname, searchParams, gaId]);

  return null;
}
