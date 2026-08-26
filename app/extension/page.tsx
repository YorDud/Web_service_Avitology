import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const EXTENSION_LINKS = {
  chrome: "https://chromewebstore.google.com/detail/test-extension-id",
  yandex: "https://chromewebstore.google.com/detail/test-extension-id",
  edge: "https://chromewebstore.google.com/detail/test-extension-id",
};

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
          <div className="badge-green mb-5">Расширение для браузера</div>
          <h1 className="mb-5 text-5xl font-extrabold leading-tight">
            Установите расширение Avitology для работы с поиском Авито
          </h1>
          <p className="text-lg leading-8 text-gray-500">
            Расширение Avitology подключается к вашему аккаунту сервиса,
            проверяет действующий уровень доступа и помогает работать с
            результатами поиска Авито непосредственно в интерфейсе браузера.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="white-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Доступные браузеры
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                <a
                  href={EXTENSION_LINKS.chrome}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-5 transition hover:border-green-300 hover:bg-white"
                >
                  <div className="mb-2 text-lg font-bold">Google Chrome</div>
                  <div className="text-sm text-gray-600">
                    Установка расширения через Chrome Web Store
                  </div>
                </a>

                <a
                  href={EXTENSION_LINKS.yandex}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-5 transition hover:border-green-300 hover:bg-white"
                >
                  <div className="mb-2 text-lg font-bold">Yandex Browser</div>
                  <div className="text-sm text-gray-600">
                    Установка через страницу расширения в Chrome Web Store
                  </div>
                </a>

                <a
                  href={EXTENSION_LINKS.edge}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-5 transition hover:border-green-300 hover:bg-white"
                >
                  <div className="mb-2 text-lg font-bold">Microsoft Edge</div>
                  <div className="text-sm text-gray-600">
                    Установка через подготовленную страницу расширения
                  </div>
                </a>
              </div>
            </div>

            <div className="white-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Как установить расширение
              </h2>

              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 1
                  </div>
                  <div className="text-lg font-bold">
                    Перейдите на страницу расширения
                  </div>
                  <div className="mt-1 text-gray-600">
                    Выберите ваш браузер и откройте страницу установки
                    расширения Avitology.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 2
                  </div>
                  <div className="text-lg font-bold">
                    Установите расширение в браузер
                  </div>
                  <div className="mt-1 text-gray-600">
                    Подтвердите установку расширения стандартным способом через
                    интерфейс браузера.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 3
                  </div>
                  <div className="text-lg font-bold">
                    Авторизуйтесь на сайте Avitology
                  </div>
                  <div className="mt-1 text-gray-600">
                    Используйте тот же аккаунт, что и для доступа к сервису и
                    подписке.
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-2 text-sm font-extrabold text-green-600">
                    ШАГ 4
                  </div>
                  <div className="text-lg font-bold">
                    Откройте страницу поиска Авито
                  </div>
                  <div className="mt-1 text-gray-600">
                    После проверки доступа расширение сможет работать на
                    страницах поиска и отображать рабочие инструменты.
                  </div>
                </div>
              </div>
            </div>

            <div className="soft-green-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Возможности расширения
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Авторизация через аккаунт</div>
                  <div className="mt-1 text-gray-600">
                    Расширение использует текущий аккаунт Avitology и работает
                    в связке с личным кабинетом.
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Проверка уровня доступа</div>
                  <div className="mt-1 text-gray-600">
                    Функции расширения доступны для пользователей с активным
                    доступом к сервису.
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Работа в выдаче Авито</div>
                  <div className="mt-1 text-gray-600">
                    Инструменты сервиса отображаются непосредственно на страницах
                    поиска.
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="font-bold">Наглядная работа с объявлениями</div>
                  <div className="mt-1 text-gray-600">
                    Расширение помогает быстрее ориентироваться в результатах
                    поиска и работать с данными в удобном формате.
                  </div>
                </div>
              </div>
            </div>

            <div className="white-card p-8">
              <h2 className="mb-5 text-3xl font-extrabold">
                Важная информация
              </h2>

              <div className="space-y-4 text-gray-600 leading-8">
                <p>
                  Для полноценной работы расширения требуется авторизация на
                  сайте Avitology.
                </p>
                <p>
                  Доступ к функциональности зависит от уровня вашей подписки.
                </p>
                <p>
                  После активации подписки обновление доступа в расширении
                  обычно происходит автоматически. В отдельных случаях это может
                  занять до 15 минут.
                </p>
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
                    Требуется вход в аккаунт
                  </div>
                  <p className="mb-6 text-white/90">
                    Чтобы использовать расширение, сначала войдите в аккаунт
                    Avitology.
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
                    . Вы можете перейти на страницу установки расширения для
                    вашего браузера.
                  </p>

                  <div className="space-y-4">
                    <a
                      href={EXTENSION_LINKS.chrome}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary inline-flex"
                    >
                      Установить для Chrome
                    </a>

                    <a
                      href={EXTENSION_LINKS.yandex}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary inline-flex"
                    >
                      Установить для Yandex Browser
                    </a>

                    <a
                      href={EXTENSION_LINKS.edge}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary inline-flex"
                    >
                      Установить для Edge
                    </a>

                    <Link
                      href="/dashboard/avito-positions"
                      className="btn-secondary"
                    >
                      Перейти к услуге
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 text-3xl font-extrabold">
                    Требуется подписка Basic
                  </div>
                  <p className="mb-6 text-white/90">
                    Сейчас у вас уровень{" "}
                    <span className="font-extrabold uppercase">
                      {user.subscriptionLevel}
                    </span>
                    . Для доступа к расширению необходимо подключить подписку.
                  </p>
                  <div className="space-y-4">
                    <Link href="/pricing" className="btn-secondary">
                      Перейти к подписке
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
                Поддержка
              </div>
              <p className="mb-6 text-gray-600 leading-8">
                Если возникли вопросы по установке, авторизации или работе
                расширения, обратитесь в техническую поддержку.
              </p>
              <Link href="/support" className="btn-primary">
                Связаться с поддержкой
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}