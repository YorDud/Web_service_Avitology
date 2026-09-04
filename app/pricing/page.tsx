import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatRuDateTime } from "@/lib/dates";
import { getServiceSettings } from "@/lib/service-settings";
import BuyBasicButton from "./buy-basic-button";

function getSubscriptionClass(level: string) {
  switch (level.toLowerCase()) {
    case "admin":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "basic":
      return "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#028c36]";
    default:
      return "border-black/10 bg-black/[0.03] text-black/60";
  }
}

export default async function PricingPage() {
  const sessionUser = await getSessionUser();
  const serviceSettings = await getServiceSettings();

  let user = null;

  if (sessionUser) {
    user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
  }

  const canUseFreeTrial =
    !!user &&
    !user.usedFreeTrial &&
    !user.subscriptionPaidAt &&
    serviceSettings.isFreeTrialEnabled;

  const paymentMode = serviceSettings.isYookassaEnabled
    ? "ЮKassa"
    : "Тестовый режим";

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main internal-page-shell pb-12">
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

                <h1 className="text-3xl font-extrabold tracking-[-0.04em] md:text-4xl">
                  Тарифы и
                  <span className="text-[#03bd48]"> доступ</span>
                </h1>

                <p className="mt-2 text-sm text-white/60">
                  Подключите инструменты платформы и работайте в личном
                  кабинете.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {sessionUser && (
                <Link href="/dashboard" className="btn-secondary">
                  В кабинет
                </Link>
              )}

              <Link href="/" className="btn-secondary">
                На главную
              </Link>
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <section className="white-card min-w-0 p-5">
            <div className="badge-green mb-3">Подключение платформы</div>

            <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-black">
              Один тариф — все основные инструменты
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-black/50">
              Подписка Basic открывает доступ к рабочим модулям, личному
              кабинету и текущим сервисам HelpSell.
            </p>
          </section>

          <section className="rounded-[26px] bg-black px-5 py-5 text-white shadow-[0_14px_30px_rgba(16,24,40,0.14)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/45">
              Режим оплаты
            </div>

            <div className="mt-2 text-xl font-extrabold text-[#03bd48]">
              {paymentMode}
            </div>

            <div className="mt-1 max-w-xs text-sm leading-6 text-white/55">
              {serviceSettings.isYookassaEnabled
                ? "После выбора срока будет открыта страница оплаты."
                : "Доступна тестовая активация подписки."}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="overflow-hidden rounded-[30px] bg-black p-6 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
            <div className="flex flex-col gap-6 border-b border-white/10 pb-7 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold">
                  BASIC
                </div>

                <h2 className="mt-5 text-4xl font-extrabold tracking-[-0.05em]">
                  Доступ к
                  <span className="text-[#03bd48]"> HelpSell</span>
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
                  Выберите удобный срок и получите доступ к сервисным
                  инструментам, аналитике и личному кабинету.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl bg-[#03bd48] px-4 py-3 text-white">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/70">
                  От
                </div>

                <div className="mt-1 text-2xl font-extrabold">
                  299 ₽
                </div>

                <div className="text-xs font-semibold text-white/80">
                  за 1 месяц
                </div>
              </div>
            </div>

            

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#03bd48] text-sm font-extrabold">
                    ✓
                  </span>

                  <div>
                    <div className="font-extrabold">Сервисы платформы</div>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Доступ к текущим рабочим инструментам HelpSell.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#03bd48] text-sm font-extrabold">
                    ✓
                  </span>

                  <div>
                    <div className="font-extrabold">Личный кабинет</div>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Тариф, профиль и управление состоянием аккаунта.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#03bd48] text-sm font-extrabold">
                    ✓
                  </span>

                  <div>
                    <div className="font-extrabold">Аналитика Авито</div>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Места в поиске и работа с результатами выдачи.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#03bd48] text-sm font-extrabold">
                    ✓
                  </span>

                  <div>
                    <div className="font-extrabold">Новые возможности</div>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      Доступ к расширению и новым модулям платформы.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7">
              {!sessionUser ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/auth" className="btn-primary">
                    Войти для покупки
                  </Link>

                  <Link href="/auth" className="btn-secondary">
                    Создать аккаунт
                  </Link>
                </div>
              ) : (
                <BuyBasicButton
                  isYookassaEnabled={serviceSettings.isYookassaEnabled}
                  isFreeTrialEnabled={serviceSettings.isFreeTrialEnabled}
                  canUseFreeTrial={canUseFreeTrial}
                />
              )}
            </div>
          </section>

          <section className="white-card min-w-0 p-6 md:p-8">
            <div className="badge-green mb-3">Аккаунт</div>

            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">
              Состояние доступа
            </h2>

            <p className="mt-2 text-sm leading-7 text-black/50">
              Актуальные данные пользователя и текущего тарифа.
            </p>

            {!user ? (
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl bg-black/[0.025] p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">
                    Статус
                  </div>

                  <div className="mt-2 text-xl font-extrabold text-black">
                    Гость
                  </div>
                </div>

                <div className="rounded-2xl border border-[#03bd48]/20 bg-[#03bd48]/[0.06] p-4">
                  <div className="text-sm font-extrabold text-[#027a30]">
                    Войдите в аккаунт
                  </div>

                  <p className="mt-2 text-sm leading-6 text-black/60">
                    После входа вы сможете оплатить подписку или активировать
                    пробный доступ, если он доступен для аккаунта.
                  </p>
                </div>

                <Link href="/auth" className="btn-primary mt-2 w-full">
                  Войти или зарегистрироваться
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-black/[0.025] p-4 sm:col-span-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">
                    Пользователь
                  </div>

                  <div className="mt-2 break-words text-xl font-extrabold text-black">
                    {user.name}
                  </div>

                  <div className="mt-1 break-all text-sm text-black/50">
                    {user.email}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/[0.025] p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">
                    Подписка
                  </div>

                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase ${getSubscriptionClass(
                        user.subscriptionLevel
                      )}`}
                    >
                      {user.subscriptionLevel}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#03bd48]/20 bg-[#03bd48]/[0.06] p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#027a30]/65">
                    Пробный доступ
                  </div>

                  <div className="mt-2 text-sm font-extrabold text-[#027a30]">
                    {user.usedFreeTrial
                      ? "Использован"
                      : canUseFreeTrial
                        ? "Доступен"
                        : "Недоступен"}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/[0.025] p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">
                    Дата оплаты
                  </div>

                  <div className="mt-2 text-sm font-bold leading-6 text-black">
                    {formatRuDateTime(user.subscriptionPaidAt) || "—"}
                  </div>
                </div>

                <div className="rounded-2xl bg-black/[0.025] p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">
                    Действует до
                  </div>

                  <div className="mt-2 text-sm font-bold leading-6 text-black">
                    {formatRuDateTime(user.subscriptionEndsAt) || "—"}
                  </div>
                </div>

                <div className="mt-2 sm:col-span-2">
                  <Link href="/dashboard" className="btn-secondary w-full">
                    Открыть личный кабинет
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}