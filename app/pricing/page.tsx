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
      <div className="container-main py-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.08)]">
            <img
              src="/logo.png"
              alt="Avitology logo"
              className="h-12 w-12 object-cover"
            />
          </div>
          <div>
            <div className="text-xl font-extrabold">Авитология</div>
            <div className="text-sm text-gray-500">Avitology</div>
          </div>
        </div>

        <div className="mb-10 max-w-3xl">
          <div className="badge-green mb-5">Подписка</div>
          <h1 className="mb-5 text-5xl font-extrabold leading-tight">
            Подписка Basic для доступа к сервисам Avitology
          </h1>
          <p className="text-lg leading-8 text-gray-500">
            Подписка Basic открывает доступ к основному инструменту сервиса,
            личному кабинету и работе с расширением Avitology.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <div className="text-sm text-gray-500">Текущий режим оплаты</div>
          <div className="mt-1 text-xl font-bold">
            {serviceSettings.isYookassaEnabled ? "ЮKassa" : "Тестовый режим"}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {serviceSettings.isYookassaEnabled
              ? "При оформлении будет выполнен переход на страницу оплаты ЮKassa."
              : "Сейчас используется тестовая активация подписки без внешнего платежного шлюза."}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="green-3d-card p-8 text-white md:p-10">
            <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
              BASIC
            </div>

            <div className="mb-4 text-4xl font-extrabold">
              Выберите срок подписки
            </div>
            <div className="mb-8 text-white/90">
              Доступ к услуге “Места в поиске Авито”, личному кабинету и
              скачиванию расширения Avitology.
            </div>

            <ul className="mb-8 space-y-3 text-[15px] text-white/95">
              <li>• 1 месяц — 299 ₽</li>
              <li>• 3 месяца — 807 ₽ со скидкой 10%</li>
              <li>• 6 месяцев — 1345 ₽ со скидкой 25%</li>
              <li>• Доступ к аналитике мест в поиске Авито</li>
              <li>• Доступ к скачиванию расширения</li>
              <li>• Доступ к личному кабинету и основной услуге</li>
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

          <div className="white-card p-8">
            <div className="mb-5 text-2xl font-extrabold">
              Состояние аккаунта
            </div>

            {!user ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Статус</div>
                  <div className="mt-1 text-lg font-bold">Гость</div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                  Войдите в аккаунт, чтобы оплатить подписку или активировать
                  пробный период.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Имя</div>
                  <div className="mt-1 text-lg font-bold">{user.name}</div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Подписка</div>
                  <div className="mt-1 text-lg font-bold uppercase">
                    {user.subscriptionLevel}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Дата оплаты</div>
                  <div className="mt-1 text-base font-semibold">
                    {formatRuDateTime(user.subscriptionPaidAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Действует до</div>
                  <div className="mt-1 text-base font-semibold">
                    {formatRuDateTime(user.subscriptionEndsAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Пробный период</div>
                  <div className="mt-1 text-base font-semibold">
                    {user.usedFreeTrial ? "Уже использован" : "Ещё доступен"}
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