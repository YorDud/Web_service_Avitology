"use client";

import Link from "next/link";
import { useState } from "react";

type DashboardPageProps = {
  user: {
    name: string;
    publicId: string;
    email: string;
    subscriptionLevel: string;
    subscriptionPriceText: string;
    subscriptionPaidAt: string;
    subscriptionEndsAt: string;
  };
};

type DashboardSection = "profile" | "avito" | null;

function getSubscriptionStyle(level: string) {
  switch (level.toLowerCase()) {
    case "admin":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "basic":
      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";
    default:
      return "border-black/10 bg-black/[0.03] text-black/60";
  }
}

function InfoCard({
  title,
  children,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl p-4 ${
        accent
          ? "border border-[#03bd48]/20 bg-[#03bd48]/[0.06]"
          : "bg-black/[0.025]"
      }`}
    >
      <div
        className={`text-[10px] font-extrabold uppercase tracking-[0.1em] ${
          accent ? "text-[#027a30]/65" : "text-black/40"
        }`}
      >
        {title}
      </div>

      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}

export default function DashboardClientPage({
  user,
}: DashboardPageProps) {
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("profile");

  const subscriptionLevel = user.subscriptionLevel.toLowerCase();

  const hasAccess =
    subscriptionLevel === "basic" || subscriptionLevel === "admin";

  const isAdmin = subscriptionLevel === "admin";

  function toggleSection(section: Exclude<DashboardSection, null>) {
    setActiveSection((current) =>
      current === section ? null : section
    );
  }

  const menuItems = [
    {
      id: "profile" as const,
      index: "01",
      title: "Мой профиль",
      description: "Данные аккаунта и подписка",
      available: true,
    },
    {
      id: "avito" as const,
      index: "02",
      title: "Места в поиске Авито",
      description: hasAccess
        ? "Аналитика поисковых позиций"
        : "Доступно с подпиской Basic",
      available: hasAccess,
    },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main internal-page-shell pb-12">
        {/* Шапка */}
        <header className="mb-6 overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_24px_65px_rgba(16,24,40,0.2)] md:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black">
                <img
                  src="/logo.png"
                  alt="HelpSell logo"
                  className="h-[132%] w-[132%] max-w-none object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="mb-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-white/75">
                  HelpSell
                </div>

                <h1 className="truncate text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">
                  Личный
                  <span className="text-[#03bd48]"> кабинет</span>
                </h1>

                <p className="mt-2 truncate text-sm text-white/60">
                  Добро пожаловать, {user.name}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {isAdmin && (
                <Link href="/admin" className="btn-primary">
                  Админ-панель
                </Link>
              )}

              <Link href="/" className="btn-secondary">
                На главную
              </Link>

              <form action="/api/auth/logout" method="POST">
                <button type="submit" className="btn-secondary">
                  Выйти
                </button>
              </form>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
          {/* Боковое меню */}
          <aside className="h-fit rounded-[30px] bg-black p-4 text-white shadow-[0_20px_50px_rgba(16,24,40,0.16)] lg:sticky lg:top-5">
            <div className="border-b border-white/10 px-3 pb-5 pt-3">
              <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/40">
                Личный кабинет
              </div>

              <div className="mt-2 text-xl font-extrabold">Разделы</div>
            </div>

            <div className="mt-3 space-y-2">
              {menuItems.map((item) => {
                const isActive = activeSection === item.id;

                if (!item.available) {
                  return (
                    <div
                      key={item.id}
                      className="flex w-full items-center gap-3 rounded-2xl p-4 text-white/38"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs font-extrabold text-white/35">
                        {item.index}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold">
                          {item.title}
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-white/32">
                          {item.description}
                        </span>
                      </span>

                      <span className="text-base">🔒</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSection(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-2xl p-4 text-left transition ${
                      isActive
                        ? "bg-[#03bd48] text-white shadow-[0_12px_26px_rgba(3,189,72,0.22)]"
                        : "text-white/72 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                        isActive
                          ? "bg-black/20 text-white"
                          : "bg-white/10 text-white/65"
                      }`}
                    >
                      {item.index}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold">
                        {item.title}
                      </span>

                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          isActive ? "text-white/78" : "text-white/42"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>

                    <span className="text-lg font-light">
                      {isActive ? "−" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Карточка текущей подписки */}
            <div className="mx-3 mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/40">
                Текущий тариф
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xl font-extrabold text-[#03bd48]">
                  {user.subscriptionLevel.toUpperCase()}
                </span>

                {hasAccess && (
                  <span className="rounded-full bg-[#03bd48]/15 px-2 py-1 text-[10px] font-extrabold uppercase text-[#03bd48]">
                    Активен
                  </span>
                )}
              </div>

              <div className="mt-2 text-sm text-white/55">
                Стоимость: {user.subscriptionPriceText}
              </div>
            </div>
          </aside>

          {/* Контент */}
          <section className="min-w-0">
            {activeSection === null && (
              <div className="flex min-h-[460px] items-center justify-center overflow-hidden rounded-[30px] bg-black p-8 text-center text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)]">
                <div className="max-w-md">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#03bd48] text-3xl font-extrabold">
                    +
                  </div>

                  <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.04em]">
                    Раздел закрыт
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-white/60">
                    Выберите раздел слева, чтобы посмотреть данные профиля или
                    перейти к доступным инструментам HelpSell.
                  </p>
                </div>
              </div>
            )}

            {/* Профиль */}
            {activeSection === "profile" && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Мой аккаунт
                      </div>

                      <h2 className="truncate text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                        {user.name}
                      </h2>

                      <p className="mt-3 break-all text-sm text-white/60">
                        {user.email}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#03bd48] px-5 py-4 text-white">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
                        Public ID
                      </div>

                      <div className="mt-1 text-2xl font-extrabold">
                        {user.publicId}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="white-card min-w-0 p-6 md:p-8">
                  <div className="mb-7">
                    <div className="badge-green mb-3">
                      Информация о подписке
                    </div>

                    <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                      Ваши данные
                    </h2>

                    <p className="mt-2 text-sm leading-7 text-black/50">
                      Здесь отображается актуальная информация по вашему
                      аккаунту и доступу к сервису.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoCard title="Public ID" accent>
                      <div className="break-all text-lg font-extrabold text-[#027a30]">
                        {user.publicId}
                      </div>
                    </InfoCard>

                    <InfoCard title="Уровень подписки">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase ${getSubscriptionStyle(
                          user.subscriptionLevel
                        )}`}
                      >
                        {user.subscriptionLevel}
                      </span>
                    </InfoCard>

                    <InfoCard title="Стоимость">
                      <div className="text-lg font-extrabold text-black">
                        {user.subscriptionPriceText}
                      </div>
                    </InfoCard>

                    <InfoCard title="Дата оплаты">
                      <div className="text-sm font-bold leading-6 text-black">
                        {user.subscriptionPaidAt}
                      </div>
                    </InfoCard>

                    <InfoCard title="Дата окончания">
                      <div className="text-sm font-bold leading-6 text-black">
                        {user.subscriptionEndsAt}
                      </div>
                    </InfoCard>

                    <InfoCard title="Статус доступа" accent>
                      <div
                        className={`text-sm font-extrabold ${
                          hasAccess ? "text-[#028c36]" : "text-black/55"
                        }`}
                      >
                        {hasAccess
                          ? "Доступ к сервисам активен"
                          : "Требуется подписка Basic"}
                      </div>
                    </InfoCard>
                  </div>
                </section>

                {!hasAccess && (
                  <section className="overflow-hidden rounded-[30px] bg-[#03bd48] p-6 text-white shadow-[0_20px_50px_rgba(3,189,72,0.2)] md:p-8">
                    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                      <div>
                        <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                          Расширьте возможности
                        </div>

                        <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">
                          Подключите Basic
                        </h2>

                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85">
                          Подписка Basic откроет доступ к аналитике мест в
                          поиске Авито и рабочим инструментам платформы.
                        </p>
                      </div>

                      <Link
                        href="/pricing"
                        className="rounded-2xl bg-black px-5 py-4 text-sm font-extrabold text-white transition hover:bg-black/85"
                      >
                        Выбрать тариф
                      </Link>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Сервис Авито */}
            {activeSection === "avito" && hasAccess && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
                  <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                        Инструменты HelpSell
                      </div>

                      <h2 className="text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                        Места в поиске
                        <span className="text-[#03bd48]"> Авито</span>
                      </h2>

                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
                        Анализируйте позиции объявлений в поисковой выдаче,
                        отслеживайте результаты и работайте с аналитикой в
                        одном месте.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#03bd48] px-5 py-4 text-white">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
                        Статус услуги
                      </div>

                      <div className="mt-1 text-lg font-extrabold">
                        Доступ активен
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 md:grid-cols-2">
                  <div className="white-card p-6">
                    <div className="badge-green mb-4">Аналитика</div>

                    <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
                      Отслеживайте позиции
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-black/50">
                      Проверяйте, как ваши объявления отображаются в поисковой
                      выдаче Авито по выбранным запросам.
                    </p>
                  </div>

                  <div className="rounded-[30px] bg-[#03bd48] p-6 text-white shadow-[0_18px_38px_rgba(3,189,72,0.18)]">
                    <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/70">
                      Готово к работе
                    </div>

                    <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.04em]">
                      Откройте сервис
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-white/85">
                      Перейдите к инструменту, чтобы начать работу с
                      поисковыми позициями.
                    </p>

                    <Link
                      href="/dashboard/avito-positions"
                      className="mt-6 inline-flex rounded-2xl bg-black px-5 py-4 text-sm font-extrabold text-white transition hover:bg-black/85"
                    >
                      Открыть услугу
                    </Link>
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}