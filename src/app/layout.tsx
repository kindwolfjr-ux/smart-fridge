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
      <body className="relative min-h-dvh text-gray-900 safe-top safe-bottom overflow-x-hidden">
        {/* === Анимированный градиентный фон === */}
        <div className="app-gradient" />

        {/* === Инициализация аналитики === */}
        <InitAnalytics />

        {/* === Модалка согласия === */}
        <ConsentModal />

        {/* === Основной контент === */}
        <main className="relative z-10 mx-auto max-w-5xl px-4 py-6">
          {children}
        </main>

        {/* === Плавающая кнопка "Настройки" === */}
        <FabSettings />
      </body>
    </html>
  );
}
