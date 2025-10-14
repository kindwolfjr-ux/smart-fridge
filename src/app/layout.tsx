// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import ConsentModal from "@/components/ConsentModal";
import InitAnalytics from "@/components/InitAnalytics";
import FabSettings from "@/components/FabSettings";

export const metadata: Metadata = {
  title: "Smart Fridge",
  description: "Scan fridge, confirm items, get recipes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-white text-gray-900 safe-top safe-bottom">
        {/* Инициализация аналитики: cookie uid + sessionId + auto app_open */}
        <InitAnalytics />

        {/* Модалка согласия — включит аналитику после клика "Разрешить" */}
        <ConsentModal />

        {/* Основной контент */}
        <main className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </main>

        {/* Плавающая кнопка "Настройки" внизу справа */}
        <FabSettings />
      </body>
    </html>
  );
}
