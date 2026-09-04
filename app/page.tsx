import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import ScrollReveal from "@/components/scroll-reveal";

const navItems = [
  ["#features", "Возможности"],
  ["#workflow", "Сценарии"],
  ["#pricing", "Тарифы"],
  ["#platform", "Платформа"],
] as const;

async function Header() {
  const sessionUser = await getSessionUser();

  const user = sessionUser
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          name: true,
          publicId: true,
          subscriptionLevel: true,
        },
      })
    : null;

  return (
    <header className="nav-shell">
      <div className="container-main nav-shell-inner">
        <div className="nav-frame">
          <Link href="/" className="brand-link">
            <div className="brand-logo-wrap">
              <img
                src="/logo.png"
                alt="HelpSell logo"
                className="h-8 w-8 object-contain sm:h-9 sm:w-9"
              />
            </div>
            <div className="brand-copy">
              <div className="brand-title">HelpSell</div>
              <div className="brand-subtitle">Веб-сервис для продавцов и команд</div>
            </div>
          </Link>

          <nav className="nav-desktop">
            {navItems.map(([href, label]) => (
              <a key={href} href={href} className="nav-link-pill">
                {label}
              </a>
            ))}
            <Link href="/about" className="nav-link-pill nav-link-static">
              О нас
            </Link>
            <Link href="/support" className="nav-link-pill nav-link-static">
              Поддержка
            </Link>
          </nav>

          <div className="nav-actions hidden sm:flex">
            {user ? (
              <Link href="/dashboard" className="dashboard-chip dashboard-chip-wide">
                <span className="dashboard-chip-main">
                  <span className="dashboard-chip-name">{user.name}</span>
                  <span className="dashboard-chip-id">{user.publicId}</span>
                </span>
                <span className="dashboard-chip-accent">Кабинет</span>
              </Link>
            ) : (
              <>
                <Link href="/auth" className="btn-secondary btn-header-secondary">
                  Войти
                </Link>
                <Link href="/pricing" className="btn-primary btn-header-primary">
                  Начать
                </Link>
              </>
            )}
          </div>

          <details className="mobile-menu sm:hidden">
            <summary className="mobile-menu-button" aria-label="Открыть меню">
              <span />
              <span />
              <span />
            </summary>
            <div className="mobile-menu-panel">
              <div className="mobile-menu-links">
                {navItems.map(([href, label]) => (
                  <a key={href} href={href} className="mobile-nav-link">
                    {label}
                  </a>
                ))}
                <Link href="/about" className="mobile-nav-link">
                  О нас
                </Link>
                <Link href="/extension" className="mobile-nav-link">
                  Расширение
                </Link>
                <Link href="/support" className="mobile-nav-link">
                  Поддержка
                </Link>
                <Link href="/privacy" className="mobile-nav-link">
                  Политика
                </Link>
                <Link href="/personal-data-consent" className="mobile-nav-link">
                  Согласие на обработку данных
                </Link>
              </div>

              <div className="mt-4 grid gap-2">
                {user ? (
                  <Link href="/dashboard" className="btn-secondary">
                    Кабинет
                  </Link>
                ) : (
                  <>
                    <Link href="/auth" className="btn-secondary">
                      Войти
                    </Link>
                    <Link href="/pricing" className="btn-primary">
                      Начать
                    </Link>
                  </>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="section-space hero-first-section hero-section">
      <div className="container-main">
        <div className="hero-premium-grid">
          <div className="reveal-on-scroll revealed">
            <div className="badge-green mb-5">
              Единая платформа для аналитики, управления доступом и роста продаж
            </div>

            <h1 className="hero-title max-w-4xl text-black">
              HelpSell — это
              <span className="text-[#03bd48]"> современный веб-сервис </span>
              для продавцов, команд и бизнеса.
            </h1>

            <p className="hero-text mt-5 max-w-2xl">
              Аналитика, отчёты, инструменты роста, рабочие сценарии и новые
              модули в одной экосистеме. Сегодня — полезные инструменты для
              продавцов, дальше — полноценная сервисная платформа.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/pricing" className="btn-primary btn-hero-primary">
                Подключить сервис
              </Link>
              <Link href="/about" className="btn-secondary btn-hero-secondary">
                О платформе
              </Link>
            </div>
          </div>

          <div className="reveal-on-scroll revealed">
            <div className="hero-laptop-scene noise-overlay">
              <div className="hero-glow hero-glow-a" />
              <div className="hero-glow hero-glow-b" />

              <div className="hero-floating-chip chip-top-left animate-float-soft">
                <span className="chip-dot" />
                Рост +24%
              </div>

              <div className="hero-floating-chip chip-top-right animate-float-soft delay-2">
                <span className="chip-dot" />
                Live analytics
              </div>

              <div className="hero-laptop-wrap">
                <div className="hero-laptop animate-float-soft">
                  <div className="hero-laptop-screen">
                    <div className="hero-app-toolbar">
                      <div className="hero-app-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="hero-app-title">HelpSell Workspace</div>
                      <div className="hero-app-badge">Online</div>
                    </div>

                    <div className="hero-app-layout">
                      <aside className="hero-app-sidebar">
                        <div className="hero-side-item active">Сводка</div>
                        <div className="hero-side-item">Продажи</div>
                        <div className="hero-side-item">Клиенты</div>
                        <div className="hero-side-item">Отчёты</div>
                      </aside>

                      <div className="hero-app-content">
                        <div className="hero-metric-row">
                          <div className="hero-metric-card dark-card">
                            <div className="hero-metric-label">Оборот</div>
                            <div className="hero-metric-value">+18.4%</div>
                            <div className="hero-metric-note">Положительная динамика</div>
                          </div>
                          <div className="hero-mini-metric">
                            <div className="hero-metric-label">Заявки</div>
                            <div className="hero-mini-value">1 284</div>
                          </div>
                          <div className="hero-mini-metric success">
                            <div className="hero-metric-label">Рост</div>
                            <div className="hero-mini-value">7.9%</div>
                          </div>
                        </div>

                        <div className="hero-chart-panel">
                          <div className="hero-chart-header">
                            <div>
                              <div className="text-sm font-bold text-black">Общая динамика</div>
                              <div className="text-xs text-black/45">Рост по ключевым метрикам</div>
                            </div>
                            <div className="hero-chart-pill">+12.8%</div>
                          </div>

                          <div className="hero-chart-grid">
                            <div className="hero-line-chart">
                              <svg viewBox="0 0 420 180" className="hero-chart-svg" aria-hidden="true">
                                <defs>
                                  <linearGradient id="heroLineGreen" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#03bd48" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="#03bd48" stopOpacity="1" />
                                  </linearGradient>
                                  <linearGradient id="heroAreaGreen" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#03bd48" stopOpacity="0.22" />
                                    <stop offset="100%" stopColor="#03bd48" stopOpacity="0" />
                                  </linearGradient>
                                </defs>
                                <path d="M20 145 C70 138, 88 124, 122 118 S182 105, 214 98 S274 70, 312 58 S368 36, 400 22" fill="none" stroke="url(#heroLineGreen)" strokeWidth="6" strokeLinecap="round" className="path-animate" />
                                <path d="M20 145 C70 138, 88 124, 122 118 S182 105, 214 98 S274 70, 312 58 S368 36, 400 22 L400 170 L20 170 Z" fill="url(#heroAreaGreen)" />
                                <circle cx="312" cy="58" r="7" fill="#03bd48" className="pulse-point" />
                                <circle cx="400" cy="22" r="8" fill="#03bd48" className="pulse-point delay-2" />
                              </svg>
                            </div>

                            <div className="hero-bars">
                              <div className="hero-bar"><span style={{ height: "40%" }} /></div>
                              <div className="hero-bar"><span style={{ height: "58%" }} /></div>
                              <div className="hero-bar"><span style={{ height: "64%" }} /></div>
                              <div className="hero-bar"><span style={{ height: "79%" }} /></div>
                              <div className="hero-bar"><span style={{ height: "92%" }} /></div>
                            </div>
                          </div>
                        </div>

                        <div className="hero-bottom-grid">
                          <div className="hero-data-card">
                            <div className="hero-data-title">Сценарии</div>
                            <div className="hero-data-text">Аналитика, отчёты, доступы и рабочие модули в одной системе.</div>
                          </div>
                          <div className="hero-data-card success-card">
                            <div className="hero-data-title">Потенциал</div>
                            <div className="hero-data-text">Платформа всегда обновляется и расширяется под новые сервисы и направления.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="hero-laptop-base" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Единая экосистема",
      text: "Один веб-сервис для инструментов, модулей и повседневной работы команды.",
      icon: "01",
    },
    {
      title: "Отчёты и аналитика",
      text: "Понятные данные, которые помогают принимать решения быстрее.",
      icon: "02",
    },
    {
      title: "Готовность к росту",
      text: "Платформа масштабируется под новые функции, роли и сервисные сценарии.",
      icon: "03",
    },
  ];

  return (
    <section id="features" className="section-space section-compact pt-0">
      <div className="container-main">
        <div className="section-head reveal-on-scroll">
          <div>
            <div className="section-kicker">Возможности</div>
            <h2 className="section-title mt-3 max-w-2xl">
              Платформа, которая объединяет полезные сервисы в одной системе
            </h2>
          </div>
          <p className="section-head-text">
            Меньше разрозненных инструментов, больше понятной логики и удобной работы.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {features.map((item, index) => (
            <div
              key={item.title}
              className="feature-premium-card reveal-on-scroll"
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <div className="feature-premium-icon">{item.icon}</div>
              <h3 className="text-xl font-extrabold tracking-[-0.03em] text-black">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-black/58 sm:text-base">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    "Подключаете аккаунт и команду",
    "Используете нужные модули в одном интерфейсе",
    "Получаете аналитику и масштабируете процессы",
  ];

  return (
    <section id="workflow" className="section-space section-compact pt-0">
      <div className="container-main">
        <div className="workflow-shell reveal-on-scroll">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="section-kicker section-kicker-dark">Сценарии</div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-4xl">
                От первого входа до ежедневной работы
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-white/68 sm:text-base">
                Быстрый старт, понятная логика и основа для дальнейшего роста платформы.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step} className="workflow-card reveal-on-scroll">
                  <div className="text-sm font-bold text-[#03bd48]">0{index + 1}</div>
                  <div className="mt-3 text-lg font-bold leading-7 text-white">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="section-space section-compact pt-0">
      <div className="container-main">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="reveal-on-scroll">
            <div className="section-kicker">Тарифы</div>
            <h2 className="section-title mt-3">Один понятный вход в сервис и его будущие модули</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-black/55 sm:text-base">
              Подписка открывает доступ к текущим инструментам и к дальнейшему развитию платформы.
            </p>
          </div>

          <div className="pricing-panel reveal-on-scroll">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#03bd48]">
                  Basic
                </div>
                <div className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-black sm:text-4xl">
                  Доступ к платформе HelpSell
                </div>
              </div>
              <Link href="/pricing" className="btn-primary">
                Открыть тариф
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Личный кабинет и управление доступом",
                "Веб-инструменты и аналитика",
                "Экспорт и рабочие отчёты",
                "Основа для новых функций сервиса",
              ].map((item) => (
                <div key={item} className="pricing-point">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section id="platform" className="section-space section-compact pt-0">
      <div className="container-main">
        <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="platform-card reveal-on-scroll">
            <div className="section-kicker">Платформа</div>
            <h2 className="section-title mt-3">Не один инструмент, а растущая сервисная система</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-black/55 sm:text-base">
              HelpSell развивается как полноценный веб-сервис: от текущих решений для продавцов до новой линейки модулей, автоматизации и сервисных сценариев.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/about" className="btn-primary">
                Узнать больше
              </Link>
              <Link href="/extension" className="btn-secondary">
                Расширение
              </Link>
            </div>
          </div>

          <div className="platform-dark-card reveal-on-scroll">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#03bd48]">
              Направления
            </div>
            <div className="mt-4 space-y-4">
              {[
                "Аналитика и визуализация данных",
                "Рабочие инструменты для продавцов и команд",
                "Новые модули внутри одной платформы",
              ].map((item) => (
                <div key={item} className="platform-dark-item">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="pb-8 pt-2">
      <div className="container-main">
        <div className="footer-shell reveal-on-scroll revealed">
          <div className="footer-top-row">
            <div className="footer-brand-block">
              <div className="footer-brand-title">HelpSell</div>
              <div className="footer-brand-text">
                Современный веб-сервис для продавцов, команд и сервисного бизнеса
              </div>
            </div>

            <div className="footer-columns">
              <div className="footer-column">
                <div className="footer-column-title">Сервис</div>
                <Link href="/about" className="footer-link">О нас</Link>
                <Link href="/pricing" className="footer-link">Тарифы</Link>
                <Link href="/extension" className="footer-link">Расширение</Link>
              </div>

              <div className="footer-column">
                <div className="footer-column-title">Поддержка</div>
                <Link href="/support" className="footer-link">Поддержка</Link>
                <Link href="/auth" className="footer-link">Вход</Link>
                <Link href="/dashboard" className="footer-link">Кабинет</Link>
              </div>

              <div className="footer-column">
                <div className="footer-column-title">Документы</div>
                <Link href="/privacy" className="footer-link">Политика</Link>
                <Link href="/personal-data-consent" className="footer-link">Согласие на обработку данных</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default async function HomePage() {
  return (
    <>
      <ScrollReveal />
      <Header />
      <main>
        <Hero />
        <Features />
        <Workflow />
        <Pricing />
        <PlatformSection />
      </main>
      <Footer />
    </>
  );
}