import Link from "next/link";
import type { Metadata } from "next";
import ServicesTabs from "./services-tabs";

export const metadata: Metadata = {
  title: "Сервисы HelpSell — возможности платформы",
  description:
    "Места в поиске Авито, финансовый анализ, бид-менеджер, автозагрузка объявлений и другие инструменты HelpSell: что делает каждый и для чего нужен.",
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="internal-page-shell section-space">
        <div className="container-main">
          <div className="mb-6">
            <Link href="/" className="text-sm font-bold text-gray-500 transition hover:text-black">
              ← На главную
            </Link>
          </div>

          <div className="mb-8 max-w-3xl">
            <div className="badge-green mb-4">Продукты и услуги</div>
            <h1 className="section-title">
              Всё, что есть в <span className="text-[#03bd48]">HelpSell</span>
            </h1>
            <p className="mt-4 text-sm leading-7 text-black/55 sm:text-base">
              Выберите сервис в списке, чтобы узнать, что он делает, для чего нужен и на каком тарифе доступен.
            </p>
          </div>

          <ServicesTabs />

          <div
            className="mt-8 bg-[#101010] text-white"
            style={{ borderRadius: 32, padding: "28px 24px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}
          >
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>Готовы попробовать?</div>
              <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)" }}>
                Basic открывает аналитику и расширение. Pro включает всё из Basic, а также бид-менеджер и автозагрузку на Авито.
              </p>
            </div>
            <Link href="/pricing" className="btn-primary">
              Выбрать тариф
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
