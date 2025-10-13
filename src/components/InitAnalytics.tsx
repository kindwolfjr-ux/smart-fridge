"use client";

import { useEffect } from "react";
import { initSession, autoAppOpenIfEnabled } from "@/lib/analytics-init";

export default function InitAnalytics() {
  useEffect(() => {
    (async () => {
      await initSession();
      autoAppOpenIfEnabled(); // если согласие уже было — шлём app_open
    })();
  }, []);

  return null;
}
