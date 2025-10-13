import "./globals.css";
import type { Metadata } from "next";
import ConsentModal from "@/components/ConsentModal"; // ← добавили

export const metadata: Metadata = {
  title: "Smart Fridge",
  description: "Scan fridge, confirm items, get recipes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-white text-gray-900 safe-top safe-bottom">
        {/* модалка показывает опт-ин и при согласии запускает аналитику */}
        <ConsentModal />
        {children}
      </body>
    </html>
  );
}
