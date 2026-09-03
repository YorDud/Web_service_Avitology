import Link from "next/link";

const supportLinks = {
  telegram: "https://t.me/your_support_username",
  max: "https://max.ru/u/f9LHodD0cOLQhj1ORGcTK_PXXtBYr2fb_KRkNVZaHCCClz_o8ETjP4uQIPM",
  email: "mailto:avitology.help@yandex.ru",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container-main page-shell max-w-6xl">
        <div className="page-header">
          <div className="page-header-row">
            <div className="brand-badge">
              <div className="brand-logo-wrap">
                <img src="/logo.png" alt="HelpSell logo" />
              </div>
              <div className="brand-copy">
                <div className="brand-title">HelpSell</div>
                <div className="brand-subtitle">Поддержка сервиса</div>
              </div>
            </div>

            <Link href="/" className="page-back-link">
              ← На главную
            </Link>
          </div>

          <div className="page-intro">
            <div className="badge-green mb-4">Поддержка</div>
            <h1 className="page-title">Свяжитесь с командой HelpSell</h1>
            <p className="page-subtitle">
              Выберите удобный канал для вопросов по доступу, оплате и работе сервиса.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <a href={supportLinks.telegram} target="_blank" rel="noreferrer" className="white-card p-8 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-4 text-4xl">📨</div>
            <h2 className="card-title mb-3">Telegram</h2>
            <p className="card-text mb-6">Быстрый канал связи по текущим вопросам сервиса.</p>
            <div className="btn-primary inline-flex">Написать</div>
          </a>

          <a href={supportLinks.max} target="_blank" rel="noreferrer" className="white-card p-8 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-4 text-4xl">💬</div>
            <h2 className="card-title mb-3">MAX</h2>
            <p className="card-text mb-6">Связь по сопровождению и использованию сервиса.</p>
            <div className="btn-primary inline-flex">Открыть MAX</div>
          </a>

          <a href={supportLinks.email} className="white-card p-8 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-4 text-4xl">✉️</div>
            <h2 className="card-title mb-3">Email</h2>
            <p className="card-text mb-6">Для официальных запросов, документов и общих вопросов.</p>
            <div className="btn-primary inline-flex">Написать</div>
          </a>
        </div>

        <div className="mt-6 soft-green-card p-8 md:p-10">
          <h3 className="card-title mb-4">С чем можно обратиться</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="info-card">
              <div className="font-bold text-black">Доступ к аккаунту</div>
              <div className="card-text mt-2">Вход, восстановление доступа, проверка статуса аккаунта.</div>
            </div>
            <div className="info-card">
              <div className="font-bold text-black">Подписка и оплата</div>
              <div className="card-text mt-2">Тариф, оплата, срок действия доступа и активация.</div>
            </div>
            <div className="info-card">
              <div className="font-bold text-black">Расширение</div>
              <div className="card-text mt-2">Установка, авторизация и работа с инструментами расширения.</div>
            </div>
            <div className="info-card">
              <div className="font-bold text-black">Технические вопросы</div>
              <div className="card-text mt-2">Ошибки, некорректная работа функций и предложения.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
