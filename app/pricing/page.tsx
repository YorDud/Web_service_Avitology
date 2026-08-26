import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatRuDateTime } from "@/lib/dates";
import { getServiceSettings } from "@/lib/service-settings";
import { activateBasicSubscription } from "@/lib/payments/activate-basic-subscription";

export default async function PricingPage() {
  const sessionUser = await getSessionUser();
  const serviceSettings = await getServiceSettings();

  let user = null;

  if (sessionUser) {
    user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
  }

  async function buyBasicAction() {
    "use server";

    const currentSessionUser = await getSessionUser();

    if (!currentSessionUser) {
      redirect("/auth");
    }

    const settings = await getServiceSettings();

    if (settings.isYookassaEnabled) {
      const payment = await prisma.payment.create({
        data: {
          userId: currentSessionUser.id,
          provider: "yookassa",
          status: "pending",
          amount: 299,
          currency: "RUB",
          description: "Оплата подписки Basic через ЮKassa",
          metadata: JSON.stringify({
            source: "pricing-page",
            mode: "yookassa",
          }),
        },
      });

      redirect(`/payment/pending?paymentId=${payment.id}`);
    }

    const updatedUser = await activateBasicSubscription(currentSessionUser.id);

    await prisma.payment.create({
      data: {
        userId: currentSessionUser.id,
        provider: "test",
        status: "succeeded",
        amount: updatedUser.subscriptionLevel === "admin" ? 0 : 299,
        currency: "RUB",
        description: "Тестовая активация подписки Basic",
        paidAt: new Date(),
        metadata: JSON.stringify({
          source: "pricing-page",
          mode: "test",
        }),
      },
    });

    redirect("/dashboard");
  }

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
              ? "При оформлении будет создан платеж в режиме ожидания подтверждения."
              : "Сейчас используется тестовая активация подписки без внешнего платежного шлюза."}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="green-3d-card p-8 text-white md:p-10">
            <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
              BASIC
            </div>

            <div className="mb-4 text-4xl font-extrabold">299 ₽ / месяц</div>
            <div className="mb-8 text-white/90">
              Доступ к услуге “Места в поиске Авито”, личному кабинету и
              скачиванию расширения Avitology.
            </div>

            <ul className="mb-8 space-y-3 text-[15px] text-white/95">
              <li>• Доступ к аналитике мест в поиске Авито</li>
              <li>• Доступ к скачиванию расширения</li>
              <li>• Доступ к личному кабинету и основной услуге</li>
              <li>• Срок действия подписки — 30 дней</li>
              <li>• Подготовлен переход на оплату через ЮKassa</li>
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
              <form action={buyBasicAction} className="flex flex-col gap-4 sm:flex-row">
                <button type="submit" className="btn-secondary">
                  {serviceSettings.isYookassaEnabled
                    ? "Перейти к оплате"
                    : "Активировать подписку"}
                </button>
                <Link href="/dashboard" className="btn-secondary">
                  В кабинет
                </Link>
              </form>
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
                  <div className="mt-1 text-xl font-bold">Гость</div>
                </div>
                <div className="text-gray-500">
                  Войдите в аккаунт, чтобы активировать подписку.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Пользователь</div>
                  <div className="mt-1 text-xl font-bold">
                    {user.name} — ID {user.id}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Почта</div>
                  <div className="mt-1 text-xl font-bold">{user.email}</div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Текущий уровень</div>
                  <div className="mt-1 text-xl font-bold uppercase">
                    {user.subscriptionLevel}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Стоимость</div>
                  <div className="mt-1 text-xl font-bold">
                    {user.subscriptionPrice} ₽
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Дата оплаты</div>
                  <div className="mt-1 text-xl font-bold">
                    {formatRuDateTime(user.subscriptionPaidAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Дата окончания</div>
                  <div className="mt-1 text-xl font-bold">
                    {formatRuDateTime(user.subscriptionEndsAt)}
                  </div>
                </div>

                {user.subscriptionLevel === "basic" && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
                    Подписка Basic активна. Доступ к основной услуге открыт.
                  </div>
                )}

                {user.subscriptionLevel === "admin" && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
                    У пользователя с полным доступом все функции уже активны.
                  </div>
                )}

                {user.subscriptionLevel === "free" && (
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
                    Сейчас у вас базовый уровень доступа. Для использования
                    основной услуги необходимо подключить подписку Basic.
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="subscription-note">
            После подтверждения оплаты доступ к расширению активируется
            автоматически. В некоторых случаях обновление доступа может занять
            до 15 минут.
          </p>
        </div>
      </div>
    </main>
  );
}