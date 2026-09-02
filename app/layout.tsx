import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";

export const metadata: Metadata = {
  metadataBase: new URL("https://helpsell.ru"),
  title: {
    default: "HelpSell — аналитика и инструменты для Авито",
    template: "%s | HelpSell",
  },
  description:
    "HelpSell — сервис аналитики и инструментов для работы с поиском Авито. Подписка, личный кабинет и расширение для браузера.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://helpsell.ru",
    siteName: "HelpSell",
    title: "HelpSell — аналитика и инструменты для Авито",
    description:
      "HelpSell — сервис аналитики и инструментов для работы с поиском Авито. Подписка, личный кабинет и расширение для браузера.",
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