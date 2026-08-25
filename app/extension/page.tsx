import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function ExtensionPage() {
  const sessionUser = await getSessionUser();

  let user = null;

  if (sessionUser) {
    user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
  }

  const hasAccess =
    user?.subscriptionLevel === "basic" || user?.subscriptionLevel === "admin";

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main py-16">
        <div className="mb-10 flex items-center gap-3">
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

        <div className="mb-10 max-w-4xl">
          <div className="badge-green mb-5">Установка расширения</div>
          <h1 className="mb-5 text-5xl font-extrabold leading-tight">
            Расширение Avitology для работы с поиском Авито
          </h1>
          <p className="text-lg leading-8 text-gray-500">
            Это расширение будет авторизовываться через ваш аккаунт Avitology,
            проверять подписку и помогать анализировать места в поиске Авито
            прямо на странице поиска.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="white-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Как установить расширение локально
              </h2>

              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 1
                  </div>
                  <div className="text-lg font-bold">
                    Скачайте папку расширения Avitology
                  </div>
                  <div className="mt-1 text-gray-600">
                    На следующем этапе мы создадим реальные файлы расширения и
                    кнопку скачивания.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 2
                  </div>
                  <div className="text-lg font-bold">
                    Откройте страницу расширений Chrome
                  </div>
                  <div className="mt-1 text-gray-600">
                    Перейдите в браузере по адресу chrome://extensions/
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 3
                  </div>
                  <div className="text-lg font-bold">
                    Включите режим разработчика
                  </div>
                  <div className="mt-1 text-gray-600">
                    После этого появится кнопка “Загрузить распакованное
                    расширение”.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 4
                  </div>
                  <div className="text-lg font-bold">
                    Выберите папку расширения Avitology
                  </div>
                  <div className="mt-1 text-gray-600">
                    После загрузки значок расширения появится в браузере.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 5
                  </div>
                  <div className="text-lg font-bold">
                    Авторизуйтесь в расширении
                  </div>
                  <div className="mt-1 text-gray-600">
                    Используйте те же почту и пароль, что и на сайте Avitology.
                  </div>
                </div>
              </div>
            </div>

            <div className="soft-green-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Что будет уметь расширение
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Авторизация</div>
                  <div className="mt-1 text-gray-600">
                    Вход через существующий аккаунт Avitology.
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Проверка подписки</div>
                  <div className="mt-1 text-gray-600">
                    Доступ к функциям только для Basic и Admin.
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Панель на странице Авито</div>
                  <div className="mt-1 text-gray-600">
                    Таблица с данными по найденным объявлениям.
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Подсветка объявлений</div>
                  <div className="mt-1 text-gray-600">
                    Отметка объявлений прямо в выдаче зеленым контуром.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="green-3d-card p-8 text-white">
              <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                Статус доступа
              </div>

              {!user ? (
                <>
                  <div className="mb-3 text-3xl font-extrabold">
                    Вы не авторизованы
                  </div>
                  <p className="mb-6 text-white/90">
                    Чтобы использовать расширение, сначала войдите в аккаунт.
                  </p>
                  <Link href="/auth" className="btn-secondary">
                    Войти в аккаунт
                  </Link>
                </>
              ) : hasAccess ? (
                <>
                  <div className="mb-3 text-3xl font-extrabold">
                    Доступ к расширению открыт
                  </div>
                  <p className="mb-6 text-white/90">
                    У вас активный уровень{" "}
                    <span className="font-extrabold uppercase">
                      {user.subscriptionLevel}
                    </span>
                    . После создания файлов расширения здесь появится кнопка
                    скачивания.
                  </p>

                  <div className="space-y-4">
                    <button className="btn-secondary" disabled>
                      Скачать расширение (будет на следующем этапе)
                    </button>
                    <Link href="/dashboard/avito-positions" className="btn-secondary">
                      Назад к услуге
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 text-3xl font-extrabold">
                    Нужна подписка Basic
                  </div>
                  <p className="mb-6 text-white/90">
                    Сейчас у вас уровень{" "}
                    <span className="font-extrabold uppercase">
                      {user.subscriptionLevel}
                    </span>
                    . Для доступа к расширению нужно активировать Basic.
                  </p>
                  <div className="space-y-4">
                    <Link href="/pricing" className="btn-secondary">
                      Купить подписку
                    </Link>
                    <Link href="/dashboard" className="btn-secondary">
                      В личный кабинет
                    </Link>
                  </div>
                </>
              )}
            </div>

            <div className="white-card p-8">
              <div className="mb-4 text-2xl font-extrabold">
                Подготовка к интеграции
              </div>
              <p className="text-gray-600 leading-8">
                На следующем этапе мы создадим API для расширения и саму
                структуру браузерного расширения, чтобы оно могло проходить
                авторизацию через Avitology и работать с доступом по подписке.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}