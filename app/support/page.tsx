import Link from "next/link";

const supportLinks = {
  telegram: "https://t.me/your_support_username",
  max: "https://max.ru/u/f9LHodD0cOLQhj1ORGcTK_PXXtBYr2fb_KRkNVZaHCCClz_o8ETjP4uQIPM",
  email: "mailto:avitology.help@yandex.ru",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="section-space">
        <div className="container-main max-w-5xl">
          <div className="mb-10 text-center">
            <div className="badge-green mb-5 inline-flex">Техническая поддержка</div>
            <h1 className="section-title mb-5">
              Свяжитесь со службой поддержки Avitology
            </h1>
            <p className="section-text mx-auto max-w-3xl">
              Если у вас возникли вопросы по доступу к сервису, подписке,
              работе личного кабинета или использованию расширения, вы можете
              обратиться в техническую поддержку удобным для вас способом.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <a
              href={supportLinks.telegram}
              target="_blank"
              rel="noreferrer"
              className="white-card p-8 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 text-4xl">📨</div>
              <h2 className="mb-3 text-2xl font-extrabold">Telegram</h2>
              <p className="card-text mb-6">
                Быстрый способ связаться с поддержкой и получить ответ по
                текущим вопросам сервиса.
              </p>
              <div className="btn-primary inline-flex">Написать в Telegram</div>
            </a>

            <a
              href={supportLinks.max}
              target="_blank"
              rel="noreferrer"
              className="white-card p-8 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 text-4xl">💬</div>
              <h2 className="mb-3 text-2xl font-extrabold">MAX</h2>
              <p className="card-text mb-6">
                Канал связи для обращений по вопросам использования сервиса и
                сопровождения пользователей.
              </p>
              <div className="btn-primary inline-flex">Открыть MAX</div>
            </a>

            <a
              href={supportLinks.email}
              className="white-card p-8 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 text-4xl">✉️</div>
              <h2 className="mb-3 text-2xl font-extrabold">Электронная почта</h2>
              <p className="card-text mb-6">
                Подходит для официальных запросов, обращений по доступу,
                документам и общим вопросам по сервису.
              </p>
              <div className="btn-primary inline-flex">Написать на почту</div>
            </a>
          </div>

          <div className="mt-10 soft-green-card p-8 md:p-10">
            <h3 className="mb-4 text-2xl font-extrabold">
              По каким вопросам можно обратиться
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="font-bold">Доступ к аккаунту</div>
                <div className="card-text mt-2">
                  Вопросы по входу в личный кабинет, восстановлению доступа и
                  проверке статуса учетной записи.
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="font-bold">Подписка и оплата</div>
                <div className="card-text mt-2">
                  Консультации по тарифу, оплате, срокам действия доступа и
                  дальнейшему использованию сервиса.
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="font-bold">Работа расширения</div>
                <div className="card-text mt-2">
                  Помощь по установке, авторизации и использованию инструментов
                  расширения на страницах Авито.
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="font-bold">Технические вопросы</div>
                <div className="card-text mt-2">
                  Сообщения об ошибках, некорректной работе функций и
                  предложения по улучшению сервиса.
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/" className="btn-secondary">
                Вернуться на главную
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}