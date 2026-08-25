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

  if (user.subscriptionLevel === "free") {
    return (
      <main className="min-h-screen bg-white">
        <div className="container-main py-16">
          <div className="white-card max-w-4xl p-8 md:p-10">
            <div className="badge-green mb-5">Услуга недоступна</div>
            <h1 className="mb-5 text-4xl font-extrabold">
              Необходимо купить стандартную подписку Basic
            </h1>
            <p className="mb-8 text-lg leading-8 text-gray-500">
              У пользователя с уровнем Free нет доступа к услуге “Места в
              поиске Авито”. После активации подписки Basic доступ откроется
              автоматически.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/pricing" className="btn-primary">
                Купить подписку
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                Вернуться в кабинет
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="badge-green mb-4">Основная услуга</div>
            <h1 className="text-5xl font-extrabold leading-tight">
              Места в поиске Авито
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-500">
              Инструмент помогает анализировать выдачу объявлений на Авито,
              понимать позиции в поиске, видеть данные по продавцу и работать
              через фирменное браузерное расширение Avitology.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/extension" className="btn-primary">
              Скачать расширение
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              Назад в кабинет
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="white-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Что делает этот инструмент
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                  <div className="mb-2 text-lg font-bold">
                    Определяет позиции
                  </div>
                  <div className="text-gray-600">
                    Помогает видеть место объявления в поисковой выдаче Авито.
                  </div>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                  <div className="mb-2 text-lg font-bold">
                    Показывает продавца
                  </div>
                  <div className="text-gray-600">
                    Отображает аккаунт, связанный с найденным объявлением.
                  </div>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                  <div className="mb-2 text-lg font-bold">
                    Смотрит рейтинг и отзывы
                  </div>
                  <div className="text-gray-600">
                    Позволяет быстро оценить качество продавца в таблице.
                  </div>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                  <div className="mb-2 text-lg font-bold">
                    Подсвечивает объявления
                  </div>
                  <div className="text-gray-600">
                    Отмеченные объявления выделяются зеленым контуром в выдаче.
                  </div>
                </div>
              </div>
            </div>

            <div className="white-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Как пользоваться
              </h2>

              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 1
                  </div>
                  <div className="text-lg font-bold">
                    Авторизуйтесь на сайте Avitology
                  </div>
                  <div className="mt-1 text-gray-600">
                    Используйте ваш единый аккаунт сервиса.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 2
                  </div>
                  <div className="text-lg font-bold">
                    Убедитесь, что у вас есть подписка Basic
                  </div>
                  <div className="mt-1 text-gray-600">
                    Только пользователи с уровнем Basic или Admin получают
                    доступ к инструменту.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 3
                  </div>
                  <div className="text-lg font-bold">
                    Установите расширение Avitology
                  </div>
                  <div className="mt-1 text-gray-600">
                    Расширение будет работать прямо на страницах поиска Авито.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 4
                  </div>
                  <div className="text-lg font-bold">
                    Откройте поиск Авито и нажмите “Найти”
                  </div>
                  <div className="mt-1 text-gray-600">
                    После этого расширение сможет анализировать выдачу и
                    показывать данные по объявлениям.
                  </div>
                </div>
              </div>
            </div>

            <div className="soft-green-card p-8">
              <h2 className="mb-4 text-3xl font-extrabold">
                Что будет в первой версии расширения
              </h2>

              <ul className="space-y-3 text-[16px] leading-8 text-gray-700">
                <li>• Таблица с данными прямо на странице Авито</li>
                <li>• Колонка “Пометить в выдаче”</li>
                <li>• Отображение аккаунта продавца</li>
                <li>• Определение позиции объявления в выдаче</li>
                <li>• Вывод рейтинга продавца</li>
                <li>• Вывод количества отзывов</li>
                <li>• Подсветка выбранных объявлений зеленым контуром</li>
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="green-3d-card p-8 text-white">
              <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                Доступ открыт
              </div>

              <div className="mb-3 text-3xl font-extrabold">
                У вас есть доступ к услуге
              </div>

              <div className="mb-6 text-white/90">
                Ваш уровень подписки:{" "}
                <span className="font-extrabold uppercase">
                  {user.subscriptionLevel}
                </span>
              </div>

              <div className="space-y-4">
                <Link href="/extension" className="btn-secondary">
                  Скачать расширение
                </Link>
                <Link href="/pricing" className="btn-secondary">
                  Открыть страницу подписки
                </Link>
              </div>
            </div>

            <div className="white-card p-8">
              <div className="mb-4 text-2xl font-extrabold">
                Текущая логика доступа
              </div>

              <div className="space-y-4 text-gray-600">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  Free — только просмотр сервиса без доступа к инструменту
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  Basic — доступ к услуге и скачиванию расширения
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  Admin — полный доступ плюс админ-панель
                </div>
              </div>
            </div>

            <div className="white-card p-8">
              <div className="mb-4 text-2xl font-extrabold">
                Следующий шаг
              </div>
              <p className="mb-6 text-gray-600 leading-8">
                Следом мы создадим страницу установки расширения и подготовим
                API, чтобы само расширение могло понимать, авторизован ли
                пользователь и какой у него уровень подписки.
              </p>
              <Link href="/extension" className="btn-primary">
                Перейти к установке расширения
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}