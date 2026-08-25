import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

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
    <header className="nav-blur">
      <div className="container-main flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
  <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.08)]">
    <img
      src="/logo.png"
      alt="Avitology logo"
      className="h-12 w-12 object-cover"
    />
  </div>
  <div>
    <div className="text-xl font-extrabold tracking-tight">
      Авитология
    </div>
    <div className="text-sm text-gray-500">Avitology</div>
  </div>
</div>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#about" className="text-sm font-semibold text-gray-600 hover:text-black">
            О сервисе
          </a>
          <a href="#features" className="text-sm font-semibold text-gray-600 hover:text-black">
            Возможности
          </a>
          <a href="#pricing" className="text-sm font-semibold text-gray-600 hover:text-black">
            Подписка
          </a>
          <a href="#extension" className="text-sm font-semibold text-gray-600 hover:text-black">
            Расширение
          </a>
		  <Link href="/support" className="text-sm font-semibold text-gray-600 hover:text-black">
		  Поддержка
		  </Link>
        </nav>

        <div className="flex items-center gap-3">
  <Link href="/pricing" className="btn-primary">
    Купить подписку
  </Link>

  {user ? (
    <Link
      href="/dashboard"
      className="rounded-2xl border border-gray-200 bg-white px-4 py-2 shadow-sm transition hover:border-green-300 hover:shadow-md"
    >
      <div className="text-sm font-bold text-gray-900">{user.name}</div>
      <div className="text-xs text-gray-500">ID: {user.publicId}</div>
      <div className="text-xs font-medium text-green-600">
        {user.subscriptionLevel === "admin"
          ? "Администратор"
          : user.subscriptionLevel === "basic"
          ? "Подписка Basic"
          : "Бесплатный доступ"}
      </div>
    </Link>
  ) : (
    <Link href="/auth" className="btn-secondary">
      Войти
    </Link>
  )}
</div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="section-space">
      <div className="container-main hero-grid items-center">
        <div>
          <div className="badge-green mb-6">
            <span>●</span>
            Платформа аналитики и автоматизации для Авито
          </div>

          <h1 className="hero-title mb-6">
            Ускоряйте продажи на <span style={{ color: "#03bd48" }}>Авито</span>
            <br />
            с помощью аналитики, парсинга
            <br />и расширения Avitology
          </h1>

          <p className="hero-text mb-8 max-w-2xl">
            Avitology — это веб-сервис для продавцов и команд, которым важно
            видеть реальные позиции в поиске, быстро анализировать выдачу,
            управлять доступом по подписке и постепенно подключать новые
            инструменты для роста продаж на Авито.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/pricing" className="btn-primary">
              Купить подписку Basic
            </Link>
            <Link href="/auth" className="btn-secondary">
              Войти в личный кабинет
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="hero-stat">
              <div className="text-3xl font-extrabold">№ 1</div>
              <div className="mt-2 text-sm text-gray-500">
                по быстродействию и качеству парсинга Авито
              </div>
            </div>
            <div className="hero-stat">
              <div className="text-3xl font-extrabold">Гибкость</div>
              <div className="mt-2 text-sm text-gray-500">
                максимально обширный спектр услуг для развития
              </div>
            </div>
            <div className="hero-stat">
              <div className="text-3xl font-extrabold">100%</div>
              <div className="mt-2 text-sm text-gray-500">
                гарантия поддержки всех сервисов Авитологии
              </div>
            </div>
          </div>
        </div>

        <div className="green-3d-card p-6 text-white md:p-8">
          <div className="mb-6 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold">
            Основная услуга
          </div>

          <h3 className="mb-4 text-3xl font-extrabold leading-tight">
            Места в поиске Авито
          </h3>

          <p className="mb-6 text-base leading-7 text-white/90">
            Веб-сервис и браузерное расширение помогают анализировать выдачу
            Авито прямо на странице поиска: определять позиции объявлений,
            видеть аккаунты продавцов, рейтинг, отзывы и удобно подсвечивать
            нужные объявления в выдаче фирменным зеленым контуром.
          </p>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <div className="text-sm font-bold uppercase tracking-wide text-white/75">
                Для кого
              </div>
              <div className="mt-2 text-lg font-semibold">
                продавцы, команды, агентства, аналитики
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <div className="text-sm font-bold uppercase tracking-wide text-white/75">
                Результат
              </div>
              <div className="mt-2 text-lg font-semibold">
                больше контроля над поисковой выдачей и продвижением
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <div className="text-sm font-bold uppercase tracking-wide text-white/75">
                Доступ
              </div>
              <div className="mt-2 text-lg font-semibold">
                по подписке Basic через личный кабинет
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="section-space">
      <div className="container-main grid-2 items-center">
        <div className="white-card p-8 md:p-10">
          <div className="badge-green mb-5">О платформе</div>
          <h2 className="section-title mb-5">
            Avitology — единая среда для сервисов, которые помогают продавать на
            Авито эффективнее
          </h2>
          <p className="section-text mb-4">
            Не просто один инструмент, а платформа с понятной
            подписочной моделью, личным кабинетом, доступами по ролям и
            расширяемой архитектурой. Сегодня самая быстрорастущая платформа 
			по своему ассортименту и качеству услуг среди конкурентов.
          </p>
          <p className="section-text">
            Удобный интерфейс, моментальная регистрация и простое управление подпиской 
			— всё для комфортной работы. Доступ к сервису через сайт и расширение, 
			все возможности — в одном личном кабинете..
          </p>
        </div>

        <div className="soft-green-card p-8 md:p-10">
          <h3 className="mb-6 text-2xl font-extrabold">
            Почему это удобно уже на старте
          </h3>

          <div className="space-y-5">
            <div>
              <div className="mb-1 text-lg font-bold">Одна учетная запись</div>
              <div className="card-text">
                Сервис построен на гибкой архитектуре, которая масштабируется под растущие задачи. 
				Единый аккаунт даёт доступ ко всем интерфейсам: веб‑версии, личному кабинету и расширению.
              </div>
            </div>

            <div>
              <div className="mb-1 text-lg font-bold">Простая подписка</div>
              <div className="card-text">
                Стартовые тарифы — Free и Basic, с возможностью дальнейшего расширения возможностей.
              </div>
            </div>

            <div>
              <div className="mb-1 text-lg font-bold">Готовность к расширению</div>
              <div className="card-text">
                Гибкая архитектура адаптируется под ваши потребности.
              </div>
            </div>

            <div>
              <div className="mb-1 text-lg font-bold">Отзывчивая техническая поддержка</div>
              <div className="card-text">
                При возникновении вопросов поможет отзывчивая техническая поддержка.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: "🔎",
      title: "Аналитика выдачи",
      text: "Помогает видеть реальное положение объявлений в поиске и контролировать динамику.",
    },
    {
      icon: "🧩",
      title: "Браузерное расширение",
      text: "Инструменты работают прямо на страницах Авито без сложных действий для пользователя.",
    },
    {
      icon: "👤",
      title: "Единая авторизация",
      text: "Один аккаунт для сайта, личного кабинета и расширения с проверкой подписки.",
    },
    {
      icon: "💳",
      title: "Подписочная модель",
      text: "Гибкие уровни доступа: free и basic с постоянно обновляющимся списком функций.",
    },
    {
      icon: "📊",
      title: "Наглядные таблицы",
      text: "Понятные данные по аккаунтам, позициям, рейтингам и отзывам в удобном интерфейсе.",
    },
    {
      icon: "⚙️",
      title: "Техническая поддержка",
      text: "Отзывчивая техническая поддержка, которая всегда на связи с пользователями.",
    },
  ];

  return (
    <section id="features" className="section-space">
      <div className="container-main">
        <div className="mb-12 max-w-3xl">
          <div className="badge-green mb-5">Возможности платформы</div>
          <h2 className="section-title mb-5">
            Современный сервис для тех, кому нужна аналитика, контроль и рост
            продаж на Авито
          </h2>
          <p className="section-text">
            В основу создания сервиса лег современный подход, ориентированный на пользователя: 
			первый экран выполнен ярко и лаконично, ключевые преимущества (польза, удобство, надёжность) 
			вынесены на первый план. Сервис работает по подписочной модели, что обеспечивает 
			предсказуемость и гибкость использования.
          </p>
        </div>

        <div className="grid-3">
          {features.map((feature) => (
            <div key={feature.title} className="white-card p-7">
              <div className="feature-icon mb-5">{feature.icon}</div>
              <h3 className="card-title mb-3">{feature.title}</h3>
              <p className="card-text">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Регистрация в Avitology",
      text: "Пользователь создает аккаунт через красивую форму регистрации и получает уровень free.",
    },
    {
      num: "02",
      title: "Покупка подписки Basic",
      text: "После тестовой оплаты открывается доступ к инструментам сервиса.",
    },
    {
      num: "03",
      title: "Авторизация в расширении",
      text: "Пользователь входит в расширение под тем же аккаунтом и получает доступ по своей подписке.",
    },
    {
      num: "04",
      title: "Работа прямо в выдаче Авито",
      text: "Расширение показывает таблицу, позиции, рейтинг, отзывы и помогает работать с объявлениями, не отвлекаясь на сторонние раздражители.",
    },
  ];

  return (
    <section className="section-space">
      <div className="container-main">
        <div className="soft-green-card p-8 md:p-10">
          <div className="mb-5 badge-green">Как это работает</div>
          <h2 className="section-title mb-10">
            Простая логика для пользователя и надежная основа для роста сервиса
          </h2>

          <div className="grid-2">
            {steps.map((step) => (
              <div key={step.num} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-4 text-sm font-extrabold text-green-600">
                  Шаг {step.num}
                </div>
                <h3 className="mb-3 text-2xl font-extrabold">{step.title}</h3>
                <p className="card-text">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="section-space">
      <div className="container-main">
        <div className="mb-12 max-w-3xl">
          <div className="badge-green mb-5">Подписка</div>
          <h2 className="section-title mb-5">
            Понятный тариф для доступа к основной услуге
          </h2>
          <p className="section-text">
            
          </p>
        </div>

        <div className="grid-2">
          <div className="white-card p-8 md:p-10">
            <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-gray-500">
              FREE
            </div>
            <div className="mb-4 text-4xl font-extrabold">0 ₽</div>
            <div className="mb-6 text-gray-500">
              Для знакомства с платформой и просмотром описания сервиса
            </div>

            <ul className="space-y-3 text-[15px] text-gray-700">
              <li>• Доступ к главной странице</li>
              <li>• Доступ к описанию сервиса</li>
              <li>• Без доступа к парсеру мест</li>
              <li>• Без доступа к расширению по подписке</li>
            </ul>
          </div>

          <div className="green-3d-card p-8 text-white md:p-10">
            <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
              BASIC
            </div>
            <div className="mb-4 text-4xl font-extrabold">299 ₽ / месяц</div>
            <div className="mb-6 text-white/90">
              Основной доступ к инструменту “Места в поиске Авито”
            </div>

            <ul className="mb-8 space-y-3 text-[15px] text-white/95">
              <li>• Доступ к личному кабинету</li>
              <li>• Доступ к услуге “Места в поиске Авито”</li>
              <li>• Доступ к скачиванию расширения</li>
              <li>• Работа через сайт и расширение</li>
              <li>• Возможность первыми получать расширение набора услуг</li>
            </ul>

            <Link href="/pricing" className="btn-secondary">
              Перейти к подписке
            </Link>
          </div>
		  
        </div>
		
      </div>
    </section>
  );
}

function ExtensionSection() {
  return (
    <section id="extension" className="section-space">
      <div className="container-main">
        <div className="white-card grid-2 p-8 md:p-10">
          <div>
            <div className="badge-green mb-5">Расширение для браузера</div>
            <h2 className="section-title mb-5">
              Расширение Avitology будет работать прямо на страницах Авито
            </h2>
            <p className="section-text mb-4">
              После авторизации пользователь сможет открыть поиск Авито и 
			  получить полноценную встроенную панель с таблицей данных по
              объявлениям. В ней будут доступны отметки в выдаче, аккаунты,
              позиции, рейтинг продавца и отзывы и остальные расширенные функции.
            </p>
            <p className="section-text mb-8">
              Интерфейс расширения Avitology разработан по современным стандартам UI/UX 
			  — он интуитивно понятен и приятен в использовании: все нужные функции под рукой, 
			  а взаимодействие выстроено так, чтобы экономить ваше время.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/extension" className="btn-primary">
                Страница установки расширения
              </Link>
              <Link href="/auth" className="btn-secondary">
                Авторизоваться
              </Link>
            </div>
          </div>

          <div className="soft-green-card p-6">
  <div className="mb-4 text-lg font-extrabold">
    Возможности расширения
  </div>

  <div className="space-y-4">
    <div className="rounded-2xl border border-green-100 bg-white p-4">
      <div className="font-bold">Авторизация через аккаунт сайта</div>
      <div className="card-text mt-1">
        Все функции доступны сразу после входа — права определяются вашим уровнем подписки.
      </div>
    </div>

    <div className="rounded-2xl border border-green-100 bg-white p-4">
      <div className="font-bold">Таблица на странице выдачи</div>
      <div className="card-text mt-1">
        Данные по объявлениям уже отображаются в удобном компактном интерфейсе — всё наглядно и под рукой.
      </div>
    </div>

    <div className="rounded-2xl border border-green-100 bg-white p-4">
      <div className="font-bold">Подсветка объявлений</div>
      <div className="card-text mt-1">
        При отметке строки карточка объявления мгновенно выделяется зелёной рамкой — легко держать в фокусе важные предложения.
      </div>
    </div>

    <div className="rounded-2xl border border-green-100 bg-white p-4">
      <div className="font-bold">Гибкая архитектура сервиса</div>
      <div className="card-text mt-1">
        Расширение построено на масштабируемой структуре — это не прототип, а полноценный многофункциональный инструмент, готовый к развитию.
      </div>
    </div>
  </div>

          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer-line">
      <div className="container-main flex flex-col gap-4 py-8 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
        <div>© 2026 Авитология / Avitology. Все права защищены.</div>
        <div className="flex items-center gap-5">
          <a href="#about">О сервисе</a>
          <a href="#pricing">Подписка</a>
          <a href="#extension">Расширение</a>
		  <Link href="/support">Поддержка</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <AboutSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <ExtensionSection />
      <Footer />
    </main>
  );
}