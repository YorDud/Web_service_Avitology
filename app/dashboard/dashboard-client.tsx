"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type DashboardPageProps = {
  user: {
    name: string;
    publicId: string;
    email: string;
    subscriptionLevel: string;
    subscriptionPriceText: string;
    subscriptionPaidAt: string;
    subscriptionEndsAt: string;
  };
};

export default function DashboardClientPage({
  user,
}: DashboardPageProps) {
  const [showMainInfo, setShowMainInfo] = useState(false);
  const profileMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const menu = profileMenuRef.current;

      if (!menu || !menu.open) {
        return;
      }

      if (!menu.contains(event.target as Node)) {
        menu.open = false;
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const hasAccess =
    user.subscriptionLevel === "basic" ||
    user.subscriptionLevel === "admin";

  function handleMainInfoClick() {
    setShowMainInfo((prev) => !prev);

    if (profileMenuRef.current) {
      profileMenuRef.current.open = false;
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container-main internal-page-shell dashboard-shell">
        <div className="dashboard-topbar">
          <div className="brand-badge">
            <div className="brand-logo-wrap">
              <img src="/logo.png" alt="HelpSell logo" />
            </div>

            <div className="brand-copy">
              <div className="brand-title">HelpSell</div>
              <div className="brand-subtitle">Личный кабинет</div>
            </div>
          </div>

          <div className="dashboard-top-actions">
            <Link href="/" className="btn-secondary">
              На главную
            </Link>

            <details
              ref={profileMenuRef}
              className="dashboard-profile-menu"
            >
              <summary className="dashboard-profile-trigger">
                <span className="dashboard-profile-main">
                  <span className="dashboard-profile-name">
                    {user.name}
                  </span>
                  <span className="dashboard-profile-id">
                    {user.publicId}
                  </span>
                </span>

                <span className="dashboard-profile-accent">
                  Профиль
                </span>
              </summary>

              <div className="dashboard-profile-panel">
                <button
                  type="button"
                  className="dashboard-menu-button"
                  onClick={handleMainInfoClick}
                >
                  Главная информация
                </button>

                <form action="/api/auth/logout" method="POST">
                  <button type="submit" className="dashboard-menu-button">
                    Выйти
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>

        <div className="dashboard-layout">
          <aside className="dashboard-sidebar-rail">
            {hasAccess ? (
              <Link
                href="/dashboard/avito-positions"
                className="dashboard-service-card compact"
              >
                <div className="dashboard-service-kicker">Услуга</div>
                <div className="dashboard-service-title">
                  Места в поиске Авито
                </div>
                <div className="dashboard-service-text">
                  Аналитика позиций и работа с результатами поиска.
                </div>
              </Link>
            ) : (
              <div className="dashboard-service-card compact disabled">
                <div className="dashboard-service-kicker">Услуга</div>
                <div className="dashboard-service-title">
                  Места в поиске Авито
                </div>
                <div className="dashboard-service-text">
                  Требуется подписка Basic.
                </div>
              </div>
            )}
          </aside>

          <section className="dashboard-content-area">
            {showMainInfo ? (
              <div className="dashboard-panel white-card p-8">
                <div className="mb-4 badge-green">
                  Главная информация
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="dashboard-metric-card">
                    <div className="dashboard-metric-label">Public ID</div>
                    <div className="dashboard-metric-value">
                      {user.publicId}
                    </div>
                  </div>

                  <div className="dashboard-metric-card">
                    <div className="dashboard-metric-label">Почта</div>
                    <div className="dashboard-metric-value break-all">
                      {user.email}
                    </div>
                  </div>

                  <div className="dashboard-metric-card">
                    <div className="dashboard-metric-label">
                      Уровень подписки
                    </div>
                    <div className="dashboard-metric-value uppercase">
                      {user.subscriptionLevel}
                    </div>
                  </div>

                  <div className="dashboard-metric-card">
                    <div className="dashboard-metric-label">
                      Стоимость подписки
                    </div>
                    <div className="dashboard-metric-value">
                      {user.subscriptionPriceText}
                    </div>
                  </div>

                  <div className="dashboard-metric-card">
                    <div className="dashboard-metric-label">
                      Дата оплаты
                    </div>
                    <div className="dashboard-metric-value small">
                      {user.subscriptionPaidAt}
                    </div>
                  </div>

                  <div className="dashboard-metric-card">
                    <div className="dashboard-metric-label">
                      Дата окончания
                    </div>
                    <div className="dashboard-metric-value small">
                      {user.subscriptionEndsAt}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-state-card">
                  <div className="dashboard-empty-kicker">HelpSell</div>
                  <div className="dashboard-empty-title">
                    Выберите действие в меню профиля
                  </div>
                  <div className="dashboard-empty-text">
                    Откройте главную информацию аккаунта или перейдите к
                    услугам платформы.
                  </div>
                </div>
              </div>
            )}

            {!hasAccess && (
              <div className="dashboard-panel dashboard-panel-accent mt-6 p-8">
                <h2 className="mb-4 text-3xl font-extrabold tracking-[-0.03em] text-black">
                  Подключите подписку Basic
                </h2>
                <p className="mb-6 text-base leading-8 text-black/55">
                  Это откроет доступ к основным рабочим инструментам платформы.
                </p>
                <Link href="/pricing" className="btn-primary">
                  Подключить Basic
                </Link>
              </div>
            )}

            {hasAccess && (
              <div className="dashboard-panel dashboard-panel-dark mt-6 p-8 text-white">
                <h2 className="mb-4 text-3xl font-extrabold tracking-[-0.03em]">
                  Доступ активен
                </h2>
                <p className="mb-6 text-base leading-8 text-white/72">
                  Ваш аккаунт готов к работе с сервисными инструментами и
                  аналитикой.
                </p>
                <Link
                  href="/dashboard/avito-positions"
                  className="btn-secondary"
                >
                  Открыть услугу
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}