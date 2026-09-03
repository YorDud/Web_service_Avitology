import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export default async function AvitoPositionsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/auth");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  if (!user) {
    redirect("/auth");
  }

  const hasAccess =
    user.subscriptionLevel === "basic" || user.subscriptionLevel === "admin";

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-white">
        <div className="container-main internal-page-shell">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="brand-badge">
                <div className="brand-logo-wrap">
                  <img src="/logo.png" alt="HelpSell logo" />
                </div>
                <div className="brand-copy">
                  <div className="brand-title">HelpSell</div>
                  <div className="brand-subtitle">Сервисные инструменты</div>
                </div>
              </div>

              <Link href="/dashboard" className="page-back-link">
                ← В кабинет
              </Link>
            </div>

            <section className="overflow-hidden rounded-[32px] bg-black p-6 text-white shadow-[0_30px_80px_rgba(16,24,40,0.2)] md:p-10">
              <div className="max-w-3xl">
                <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                  Услуга недоступна
                </div>

                <h1 className="text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
                  Места в поиске
                  <span className="text-[#03bd48]"> Авито</span>
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                  Для работы с инструментом нужна активная подписка Basic.
                  После подключения доступ откроется автоматически.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/pricing" className="btn-primary">
                    Подключить Basic
                  </Link>
                  <Link href="/dashboard" className="btn-secondary">
                    Вернуться в кабинет
                  </Link>
                </div>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">
                    Данные
                  </div>
                  <div className="mt-2 text-lg font-bold">Позиции в поиске</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">
                    Аналитика
                  </div>
                  <div className="mt-2 text-lg font-bold">Продавцы и выдача</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">
                    Расширение
                  </div>
                  <div className="mt-2 text-lg font-bold">Работа в браузере</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  const capabilities = [
    {
      number: "01",
      title: "Позиции в поиске",
      text: "Показывает место объявления в поисковой выдаче.",
    },
    {
      number: "02",
      title: "Данные продавца",
      text: "Помогает быстро увидеть связанный аккаунт продавца.",
    },
    {
      number: "03",
      title: "Рейтинг и отзывы",
      text: "Добавляет ключевые сигналы для быстрой оценки продавца.",
    },
    {
      number: "04",
      title: "Подсветка объявлений",
      text: "Выделяет важные результаты прямо внутри выдачи.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Войдите в HelpSell",
      text: "Используйте единый аккаунт платформы.",
    },
    {
      number: "02",
      title: "Установите расширение",
      text: "Подключите его через страницу расширения.",
    },
    {
      number: "03",
      title: "Откройте поиск Авито",
      text: "Перейдите к результатам поиска нужного запроса.",
    },
    {
      number: "04",
      title: "Начните анализ",
      text: "Расширение покажет доступные данные по выдаче.",
    },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main internal-page-shell">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="brand-badge">
            <div className="brand-logo-wrap">
              <img src="/logo.png" alt="HelpSell logo" />
            </div>
            <div className="brand-copy">
              <div className="brand-title">HelpSell</div>
              <div className="brand-subtitle">Сервисный модуль</div>
            </div>
          </div>

          <Link href="/dashboard" className="page-back-link">
            ← В кабинет
          </Link>
        </div>

        <section className="overflow-hidden rounded-[32px] bg-black p-6 text-white shadow-[0_30px_80px_rgba(16,24,40,0.2)] md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                Основная услуга
              </div>

              <h1 className="max-w-3xl text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl md:text-6xl">
                Места в поиске
                <span className="text-[#03bd48]"> Авито</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                Анализируйте позиции объявлений, данные продавцов и ключевые
                сигналы внутри поисковой выдачи через расширение HelpSell.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/extension" className="btn-primary">
                  Установить расширение
                </Link>

                <Link href="/dashboard" className="btn-secondary">
                  В кабинет
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/45">
                  Подписка
                </div>
                <div className="mt-2 text-3xl font-extrabold uppercase">
                  {user.subscriptionLevel}
                </div>
                <div className="mt-2 text-sm text-white/65">
                  Доступ к инструменту активен
                </div>
              </div>

              <div className="rounded-3xl border border-[#03bd48]/30 bg-[#03bd48]/10 p-5">
                <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#78f8a6]">
                  Статус
                </div>
                <div className="mt-2 text-xl font-extrabold">
                  Готово к работе
                </div>
                <div className="mt-2 text-sm text-white/72">
                  Откройте расширение и начните анализ поиска.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="white-card p-6 md:p-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="badge-green mb-3">Возможности</div>
                  <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                    Что делает инструмент
                  </h2>
                </div>

                <div className="text-sm font-semibold text-black/45">
                  Поиск · Позиции · Продавцы
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {capabilities.map((item) => (
                  <div
                    key={item.number}
                    className="rounded-3xl border border-black/8 bg-black/[0.02] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#03bd48]/30 hover:bg-white hover:shadow-[0_18px_38px_rgba(3,189,72,0.1)]"
                  >
                    <div className="text-xs font-extrabold tracking-[0.16em] text-[#03bd48]">
                      {item.number}
                    </div>
                    <div className="mt-3 text-xl font-extrabold tracking-[-0.03em] text-black">
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-black/55">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="white-card p-6 md:p-8">
              <div className="badge-green mb-3">Быстрый старт</div>
              <h2 className="mb-6 text-3xl font-extrabold tracking-[-0.04em] text-black">
                Как пользоваться
              </h2>

              <div className="grid gap-3">
                {steps.map((step) => (
                  <div
                    key={step.number}
                    className="flex gap-4 rounded-2xl border border-black/8 bg-black/[0.02] p-5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-extrabold text-white">
                      {step.number}
                    </div>

                    <div>
                      <div className="text-lg font-extrabold text-black">
                        {step.title}
                      </div>
                      <div className="mt-1 text-sm leading-7 text-black/55">
                        {step.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[30px] bg-[#03bd48] p-6 text-white shadow-[0_20px_50px_rgba(3,189,72,0.22)] md:p-8">
              <div className="mb-4 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold">
                Доступ открыт
              </div>

              <h2 className="text-3xl font-extrabold tracking-[-0.04em]">
                Работайте через расширение
              </h2>

              <p className="mt-4 text-sm leading-7 text-white/88">
                Расширение добавляет инструмент в рабочую среду браузера и помогает анализировать выдачу.
              </p>

              <div className="mt-7 grid gap-3">
                <Link href="/extension" className="btn-secondary">
                  Открыть расширение
                </Link>

                <Link
                  href="/pricing"
                  className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-center text-sm font-bold text-white transition hover:bg-white/20"
                >
                  Управление подпиской
                </Link>
              </div>
            </section>

            <section className="rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
              <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/45">
                Логика доступа
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="font-extrabold text-white">Basic</div>
                <div className="mt-2 text-sm leading-7 text-white/65">
                  Доступ к анализу позиций и браузерному расширению HelpSell.
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="font-extrabold text-white">Платформа</div>
                <div className="mt-2 text-sm leading-7 text-white/65">
                  Новые модули и инструменты будут подключаться в рамках общей системы.
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}