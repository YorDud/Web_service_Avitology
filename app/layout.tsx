import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";

export const metadata: Metadata = {
  metadataBase: new URL("https://helpsell.ru"),
  title: {
    default: "HelpSell — веб-сервис для продавцов и команд",
    template: "%s | HelpSell",
  },
  description:
    "HelpSell — современный веб-сервис для продавцов, команд и сервисного бизнеса: аналитика, личный кабинет, доступы, отчёты и прикладные инструменты.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://helpsell.ru",
    siteName: "HelpSell",
    title: "HelpSell — веб-сервис для продавцов и команд",
    description:
      "HelpSell — современный веб-сервис для продавцов, команд и сервисного бизнеса: аналитика, личный кабинет, доступы, отчёты и прикладные инструменты.",
    locale: "ru_RU",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google18ea0d4b12b0b15c",
    yandex: "bbb317ce1290b3fe",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
