import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function DashboardPage() {
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

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main py-12">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.08)]">
              <img
                src="/logo.png"
                alt="Avitology logo"
                className="h-12 w-12 object-cover"
              />
            </div>
            <div>
              <div className="text-xl font-extrabold">Личный кабинет</div>
              <div className="text-sm text-gray-500">
                Авитология / Avitology
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/" className="btn-secondary">
              На главную
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button className="btn-primary">Выйти</button>
            </form>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="white-card p-6">
            <div className="mb-6 text-lg font-extrabold">Навигация</div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-4 font-bold text-green-700">
                Главная информация
              </div>

              {user.subscriptionLevel === "basic" ||
              user.subscriptionLevel === "admin" ? (
                <Link
                  href="/dashboard/avito-positions"
                  className="block rounded-2xl border border-gray-200 px-4 py-4 font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
                >
                  Места в поиске Авито
                </Link>
              ) : (
                <div className="rounded-2xl border border-gray-200 px-4 py-4 font-semibold text-gray-400">
                  Места в поиске Авито
                  <div className="mt-1 text-sm font-normal">
                    Требуется подписка Basic
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="white-card p-8">
              <div className="mb-4 badge-green">Профиль пользователя</div>
              <h1 className="mb-6 text-4xl font-extrabold">
                Здравствуйте, {user.name}
              </h1>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">ID пользователя</div>
                  <div className="mt-1 text-xl font-bold">{user.id}</div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Почта</div>
                  <div className="mt-1 text-xl font-bold">{user.email}</div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Уровень подписки</div>
                  <div className="mt-1 text-xl font-bold uppercase">
                    {user.subscriptionLevel}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">Стоимость подписки</div>
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
              </div>
            </div>

            {user.subscriptionLevel === "free" && (
              <div className="soft-green-card p-8">
                <h2 className="mb-4 text-3xl font-extrabold">
                  У вас бесплатный доступ Free
                </h2>
                <p className="mb-6 text-lg leading-8 text-gray-500">
                  Чтобы использовать основную услугу “Места в поиске Авито”,
                  необходимо купить подписку Basic.
                </p>
                <Link href="/pricing" className="btn-primary">
                  Купить подписку Basic
                </Link>
              </div>
            )}

            {(user.subscriptionLevel === "basic" ||
              user.subscriptionLevel === "admin") && (
              <div className="soft-green-card p-8">
                <h2 className="mb-4 text-3xl font-extrabold">
                  Доступ к основной услуге открыт
                </h2>
                <p className="mb-6 text-lg leading-8 text-gray-500">
                  Вы можете перейти к услуге “Места в поиске Авито” и в
                  дальнейшем скачать расширение браузера.
                </p>
                <Link
                  href="/dashboard/avito-positions"
                  className="btn-primary"
                >
                  Открыть услугу
                </Link>
              </div>
            )}
			
			{user.subscriptionLevel === "admin" && (
  <Link
    href="/admin"
    className="block rounded-2xl border border-gray-200 px-4 py-4 font-semibold text-gray-700 transition hover:border-green-300 hover:text-green-700"
  >
    Админ-панель
  </Link>
)}
          </section>
        </div>
      </div>
    </main>
  );
}