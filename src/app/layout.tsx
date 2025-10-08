import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart Fridge",
  description: "Scan fridge, confirm items, get recipes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-white text-gray-900 safe-top safe-bottom">
        {children}
      </body>
    </html>
  );
}
