import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatRuDateTime } from "@/lib/dates";
import { getServiceSettings } from "@/lib/service-settings";
import BuyBasicButton from "./buy-basic-button";

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

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main page-shell">
        <div className="page-header">
          <div className="page-header-row">
            <div className="brand-badge">
              <div className="brand-logo-wrap">
                <img src="/logo.png" alt="HelpSell logo" />
              </div>
              <div className="brand-copy">
                <div className="brand-title">HelpSell</div>
                <div className="brand-subtitle">Тарифы и доступ к платформе</div>
              </div>
            </div>

            <Link href="/" className="page-back-link">
              ← На главную
            </Link>
          </div>

          <div className="page-intro">
            <div className="badge-green mb-4">Тарифы</div>
            <h1 className="page-title">Подключение к платформе HelpSell</h1>
            <p className="page-subtitle">
              Один тариф для доступа к текущим инструментам, личному кабинету и дальнейшему развитию сервиса.
            </p>
          </div>
        </div>

        <div className="mb-6 info-card">
          <div className="text-sm text-black/45">Режим оплаты</div>
          <div className="mt-1 text-2xl font-extrabold text-black">
            {serviceSettings.isYookassaEnabled ? "ЮKassa" : "Тестовый режим"}
          </div>
          <div className="mt-2 text-sm leading-7 text-black/55">
            {serviceSettings.isYookassaEnabled
              ? "После выбора срока откроется страница оплаты ЮKassa."
              : "Сейчас доступна тестовая активация подписки без внешнего платёжного шлюза."}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.06fr_0.94fr]">
          <div className="green-3d-card p-8 text-white md:p-10">
            <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
              BASIC
            </div>

            <h2 className="mb-4 text-4xl font-extrabold leading-tight">
              Выберите срок подписки
            </h2>
            <p className="mb-8 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
              Доступ к инструментам платформы, личному кабинету и основным сервисным модулям.
            </p>

            <ul className="mb-8 space-y-3 text-[15px] text-white/95">
              <li>• 1 месяц — 299 ₽</li>
              <li>• 3 месяца — 807 ₽ со скидкой 10%</li>
              <li>• 6 месяцев — 1345 ₽ со скидкой 25%</li>
              <li>• Доступ к веб-инструментам платформы</li>
              <li>• Личный кабинет и рабочие сценарии</li>
              <li>• Доступ к расширению и сопутствующим модулям</li>
            </ul>

            {!sessionUser ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/auth" className="btn-secondary">
                  Войти для покупки
                </Link>
                <Link href="/" className="btn-secondary">
                  На главную
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

          <div className="white-card p-8 md:p-10">
            <div className="mb-5 text-2xl font-extrabold">Состояние аккаунта</div>

            {!user ? (
              <div className="space-y-4">
                <div className="metric-card">
                  <div className="text-sm text-black/45">Статус</div>
                  <div className="mt-1 text-xl font-extrabold text-black">Гость</div>
                </div>

                <div className="info-card text-sm leading-7 text-black/58">
                  Войдите в аккаунт, чтобы оплатить подписку или активировать пробный период.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="metric-card">
                  <div className="text-sm text-black/45">Имя</div>
                  <div className="mt-1 text-xl font-extrabold text-black">{user.name}</div>
                </div>

                <div className="metric-card">
                  <div className="text-sm text-black/45">Подписка</div>
                  <div className="mt-1 text-xl font-extrabold uppercase text-black">
                    {user.subscriptionLevel}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="text-sm text-black/45">Дата оплаты</div>
                  <div className="mt-1 text-base font-semibold text-black">
                    {formatRuDateTime(user.subscriptionPaidAt)}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="text-sm text-black/45">Действует до</div>
                  <div className="mt-1 text-base font-semibold text-black">
                    {formatRuDateTime(user.subscriptionEndsAt)}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="text-sm text-black/45">Пробный доступ</div>
                  <div className="mt-1 text-base font-semibold text-black">
                    {user.usedFreeTrial ? "Использован" : "Доступен"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
