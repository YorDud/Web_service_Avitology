import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

async function buyBasicAction() {
  "use server";

  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/auth");
  }

  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  if (sessionUser.subscriptionLevel !== "admin") {
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        subscriptionLevel: "basic",
        subscriptionPrice: 299,
        subscriptionPaidAt: now,
        subscriptionEndsAt: endDate,
      },
    });
  }

  redirect("/dashboard");
}

export default async function PricingPage() {
  const sessionUser = await getSessionUser();

  let user = null;

  if (sessionUser) {
    user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
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
            Пока мы используем тестовую оплату без подключения ЮKassa. После
            нажатия кнопки подписка Basic активируется на 30 дней и открывает
            доступ к основной услуге сервиса.
          </p>
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
              <li>• В будущем здесь будет интеграция с ЮKassa</li>
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
                  Оплатить тестово
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
                    {formatDate(user.subscriptionPaidAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Дата окончания</div>
                  <div className="mt-1 text-xl font-bold">
                    {formatDate(user.subscriptionEndsAt)}
                  </div>
                </div>

                {user.subscriptionLevel === "basic" && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
                    Подписка Basic активна. Доступ к основной услуге открыт.
                  </div>
                )}

                {user.subscriptionLevel === "admin" && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
                    Уровень admin уже имеет полный доступ ко всем функциям.
                  </div>
                )}

                {user.subscriptionLevel === "free" && (
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
                    Сейчас у вас бесплатный уровень. Для доступа к услуге
                    необходимо активировать Basic.
                  </div>
                )}
              </div>
            )}
          </div>
		  <p className="subscription-note">
		  
		  После оплаты подписки доступ к расширению активируется автоматически. В некоторых случаях обновление доступа может занять до 15 минут.
		  </p>
		  
        </div>
      </div>
    </main>
  );
}