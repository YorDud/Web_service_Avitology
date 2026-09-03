import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const EXTENSION_LINKS = {
  chrome:
    "https://chrome.google.com/webstore/detail/oigdilhkhidoinkpkfchkdpbkaobfhng",
  yandex:
    "https://chrome.google.com/webstore/detail/oigdilhkhidoinkpkfchkdpbkaobfhng",
  edge:
    "https://chrome.google.com/webstore/detail/oigdilhkhidoinkpkfchkdpbkaobfhng",
};

const browsers = [
  {
    name: "Google Chrome",
    short: "Chrome",
    text: "Установка через Chrome Web Store.",
    href: EXTENSION_LINKS.chrome,
  },
  {
    name: "Yandex Browser",
    short: "Yandex",
    text: "Установка через страницу расширения.",
    href: EXTENSION_LINKS.yandex,
  },
  {
    name: "Microsoft Edge",
    short: "Edge",
    text: "Установка для работы в Microsoft Edge.",
    href: EXTENSION_LINKS.edge,
  },
];

const steps = [
  {
    number: "01",
    title: "Выберите браузер",
    text: "Откройте страницу установки для своего браузера.",
  },
  {
    number: "02",
    title: "Установите расширение",
    text: "Подтвердите установку в интерфейсе браузера.",
  },
  {
    number: "03",
    title: "Войдите в HelpSell",
    text: "Используйте тот же аккаунт, что и в личном кабинете.",
  },
  {
    number: "04",
    title: "Откройте поиск Авито",
    text: "Расширение начнёт работать на странице результатов поиска.",
  },
];

export default async function ExtensionPage() {
  const sessionUser = await getSessionUser();

  const user = sessionUser
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
      })
    : null;

  const hasAccess =
    user?.subscriptionLevel === "basic" || user?.subscriptionLevel === "admin";

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
              <div className="brand-subtitle">Браузерное расширение</div>
            </div>
          </div>

          <Link href="/" className="page-back-link">
            ← На главную
          </Link>
        </div>

        <section className="overflow-hidden rounded-[32px] bg-black p-6 text-white shadow-[0_30px_80px_rgba(16,24,40,0.2)] md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                Расширение HelpSell
              </div>

              <h1 className="max-w-3xl text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl md:text-6xl">
                Данные и сигналы
                <span className="text-[#03bd48]"> прямо в браузере</span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
                Расширение подключается к аккаунту HelpSell и помогает работать
                с поисковой выдачей в привычном интерфейсе браузера.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={EXTENSION_LINKS.chrome}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                >
                  Установить расширение
                </a>

                <Link href="/dashboard" className="btn-secondary">
                  В кабинет
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/45">
                  Браузеры
                </div>
                <div className="mt-2 text-2xl font-extrabold">Chrome · Yandex · Edge</div>
              </div>

              <div className="rounded-3xl border border-[#03bd48]/35 bg-[#03bd48]/10 p-5">
                <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7af8a5]">
                  Статус
                </div>
                <div className="mt-2 text-2xl font-extrabold">
                  {hasAccess ? "Доступ активен" : "Нужна подписка Basic"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-6">
            <section className="white-card p-6 md:p-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="badge-green mb-3">Установка</div>
                  <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
                    Выберите браузер
                  </h2>
                </div>

                <div className="text-sm font-semibold text-black/45">
                  Единый аккаунт HelpSell
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {browsers.map((browser) => (
                  <a
                    key={browser.name}
                    href={browser.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-3xl border border-black/8 bg-black/[0.02] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#03bd48]/30 hover:bg-white hover:shadow-[0_18px_38px_rgba(3,189,72,0.1)]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-xs font-extrabold text-white transition group-hover:bg-[#03bd48]">
                      {browser.short.slice(0, 2)}
                    </div>

                    <div className="mt-5 text-lg font-extrabold tracking-[-0.02em] text-black">
                      {browser.name}
                    </div>

                    <div className="mt-2 text-sm leading-7 text-black/55">
                      {browser.text}
                    </div>

                    <div className="mt-5 text-sm font-bold text-[#03bd48]">
                      Открыть →
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="white-card p-6 md:p-8">
              <div className="badge-green mb-3">Быстрый старт</div>
              <h2 className="mb-6 text-3xl font-extrabold tracking-[-0.04em] text-black">
                Подключение за несколько шагов
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
            <section
              className={`rounded-[30px] p-6 shadow-[0_20px_55px_rgba(16,24,40,0.16)] md:p-8 ${
                hasAccess ? "bg-[#03bd48] text-white" : "bg-black text-white"
              }`}
            >
              <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                Статус доступа
              </div>

              {hasAccess ? (
                <>
                  <h2 className="text-3xl font-extrabold tracking-[-0.04em]">
                    Расширение готово к работе
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-white/85">
                    Ваш аккаунт может использовать расширение и основные инструменты платформы.
                  </p>

                  <div className="mt-7 grid gap-3">
                    <Link href="/dashboard/avito-positions" className="btn-secondary">
                      Открыть услугу
                    </Link>

                    <Link
                      href="/dashboard"
                      className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-center text-sm font-bold text-white transition hover:bg-white/20"
                    >
                      В кабинет
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-extrabold tracking-[-0.04em]">
                    Подключите Basic
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-white/72">
                    Для полноценной работы расширения нужен активный доступ к сервису.
                  </p>

                  <div className="mt-7 grid gap-3">
                    <Link href="/pricing" className="btn-primary">
                      Выбрать тариф
                    </Link>

                    <Link href="/auth" className="btn-secondary">
                      Войти в аккаунт
                    </Link>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
              <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/45">
                Возможности
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/78">
                  Работа с результатами поиска прямо в браузере.
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/78">
                  Дополнительные данные и полезные сигналы по выдаче.
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/78">
                  Связка с подпиской и личным кабинетом HelpSell.
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}