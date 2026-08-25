import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Авитология / Avitology",
  description:
    "Сервис аналитики, автоматизации и инструментов для эффективной работы с Авито.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}