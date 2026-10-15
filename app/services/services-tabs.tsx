"use client";

import Link from "next/link";
import { useState } from "react";

// ---------------------------------------------------------------------------
// ГДЕ МЕНЯТЬ ТЕКСТЫ: массив SERVICES ниже. Один объект = одна вкладка.
// Чтобы добавить новый сервис — допишите объект в конец массива.
// plan: "all" — все тарифы, "basic" — Basic и выше, "pro" — только Pro.
// ---------------------------------------------------------------------------

type Plan = "all" | "basic" | "pro";

type ServiceInfo = {
  id: string;
  index: string;
  title: string;
  short: string;
  plan: Plan;
  status?: "beta" | "soon";
  lead: string;
  purpose: string;
  does: string[];
  steps: string[];
};

const SERVICES: ServiceInfo[] = [
  {
    id: "positions",
    index: "01",
    title: "Места в поиске Авито",
    short: "Позиции объявлений",
    plan: "basic",
    lead: "Показывает, на каком месте ваши объявления в поисковой выдаче Авито и как это место меняется со временем.",
    purpose:
      "Чтобы понимать своё положение среди конкурентов и вовремя менять стратегию продвижения, а не гадать, почему упали просмотры.",
    does: [
      "Сохраняет результаты анализа выдачи из расширения HelpSell",
      "Показывает динамику позиций по датам",
      "Позволяет сравнивать позиции продавцов между собой",
      "Хранит историю, к которой можно вернуться в любой момент",
    ],
    steps: [
      "Устанавливаете расширение и открываете нужную выдачу на Авито",
      "Результат сохраняется в личном кабинете",
      "Сравниваете даты и продавцов, делаете выводы",
    ],
  },
  {
    id: "finance",
    index: "02",
    title: "Финансовый анализ",
    short: "Доходы, расходы, прибыль",
    plan: "basic",
    lead: "Ежедневный учёт доходов и расходов с понятной картиной чистой прибыли за выбранный период.",
    purpose:
      "Чтобы видеть реальные деньги бизнеса, а не только выручку, и принимать решения на цифрах.",
    does: [
      "Ведёт записи доходов и расходов по дням",
      "Считает чистую прибыль за любой период",
      "Показывает динамику выручки",
      "Помогает находить статьи, которые съедают прибыль",
    ],
    steps: [
      "Вносите доходы и расходы за день",
      "Выбираете период в таблице",
      "Смотрите итоги и динамику",
    ],
  },
  {
    id: "reviews",
    index: "03",
    title: "Калькулятор отзывов",
    short: "Рейтинг профиля",
    plan: "all",
    lead: "Рассчитывает рейтинг профиля Авито и помогает понять, как на него повлияют новые отзывы.",
    purpose:
      "Чтобы заранее планировать работу с репутацией и понимать, сколько отзывов нужно для нужной оценки.",
    does: [
      "Считает рейтинг по вашим данным",
      "Показывает эффект от новых оценок",
      "Работает сразу, без подключения аккаунта",
    ],
    steps: ["Вводите текущие данные профиля", "Задаёте ожидаемые оценки", "Получаете расчёт"],
  },
  {
    id: "uniqualizer",
    index: "04",
    title: "Уникализатор картинок",
    short: "Уникальные копии фото",
    plan: "all",
    lead: "Создаёт уникальные копии фотографий для объявлений, чтобы изображения не совпадали между собой.",
    purpose:
      "Чтобы публиковать несколько объявлений с одними и теми же товарами и не терять показы из-за повторяющихся фото.",
    does: [
      "Делает несколько уникальных вариантов из одного изображения",
      "Сохраняет внешний вид фото",
      "Доступен на всех тарифах",
    ],
    steps: ["Загружаете фото", "Выбираете количество копий", "Скачиваете готовые файлы"],
  },
  {
    id: "bidder",
    index: "05",
    title: "Бид-менеджер Авито",
    short: "Автоуправление ставками",
    plan: "pro",
    status: "beta",
    lead: "Автоматически управляет CPX-ставкой: проверяет позицию объявления и подстраивает ставку под вашу стратегию.",
    purpose:
      "Чтобы держать объявление на нужном месте в выдаче и не переплачивать за клики и просмотры.",
    does: [
      "Периодически проверяет позицию объявления в выдаче",
      "Повышает и снижает ставку по заданной стратегии",
      "Никогда не выходит за выставленные вами лимиты",
      "Хранит историю действий по каждой стратегии",
      "До 10 стратегий одновременно на тарифе Pro",
    ],
    steps: [
      "Подключаете аккаунт Авито",
      "Создаёте стратегию: объявление, ссылка поиска, желаемое место, лимиты",
      "Бид-менеджер работает сам, вы смотрите результат",
    ],
  },
  {
    id: "autoload",
    index: "06",
    title: "Автозагрузка объявлений Авито",
    short: "Таблицы и выгрузка через API",
    plan: "pro",
    status: "beta",
    lead: "Ведёте объявления в таблице, а сервис проверяет их и выгружает на Авито через API по расписанию.",
    purpose:
      "Чтобы не размещать и не обновлять десятки объявлений вручную, а управлять каталогом из привычной таблицы.",
    does: [
      "Импорт из Excel, Google Таблиц и Яндекс Таблиц",
      "Проверка ошибок до отправки на Авито",
      "Выгрузка через официальный API Авито",
      "Запуск по расписанию",
    ],
    steps: [
      "Подключаете аккаунт Авито и загружаете таблицу",
      "Исправляете ошибки, которые покажет проверка",
      "Включаете расписание, дальше всё идёт само",
    ],
  },
  {
    id: "queries",
    index: "07",
    title: "Запросы по популярности Авито",
    short: "Подбор запросов",
    plan: "basic",
    status: "soon",
    lead: "Подбор популярных поисковых запросов Авито для ваших товаров и категорий.",
    purpose:
      "Чтобы формулировать заголовки и описания так, как реально ищут покупатели.",
    does: [
      "Подсказывает популярные запросы по теме",
      "Помогает выбрать ключевые слова для объявлений",
      "Сейчас в разработке — запуск скоро",
    ],
    steps: ["Указываете тему или товар", "Получаете список запросов", "Используете их в объявлениях"],
  },
];

function planLabel(plan: Plan) {
  if (plan === "pro") return "Тариф Pro";
  if (plan === "basic") return "Тариф Basic и выше";
  return "Все тарифы";
}

export default function ServicesTabs() {
  const [activeId, setActiveId] = useState(SERVICES[0].id);
  const active = SERVICES.find((item) => item.id === activeId) ?? SERVICES[0];

  return (
    <div style={{ display: "grid", gap: 16 }} className="lg:grid-cols-[320px_1fr]">
      {/* Переключатель: на телефоне — прокручиваемая лента, на компьютере — список слева */}
      <div
        role="tablist"
        aria-label="Сервисы HelpSell"
        className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
        style={{ scrollbarWidth: "none" }}
      >
        {SERVICES.map((item) => {
          const isActive = item.id === active.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(item.id)}
              className={`text-left transition ${
                isActive
                  ? "bg-black text-white shadow-[0_18px_40px_rgba(16,24,40,0.2)]"
                  : "bg-white text-black hover:border-[#03bd48]/50"
              }`}
              style={{
                flex: "0 0 auto",
                minWidth: 220,
                borderRadius: 22,
                border: isActive ? "1px solid #000" : "1px solid rgba(0,0,0,0.08)",
                padding: "14px 16px",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    flex: "0 0 auto",
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    background: isActive ? "#03bd48" : "#ecfff3",
                    color: isActive ? "#000" : "#02963a",
                  }}
                >
                  {item.index}
                </span>
                <span style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>
                    {item.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 12,
                      opacity: 0.55,
                    }}
                  >
                    {item.short}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Описание выбранного сервиса */}
      <article
        key={active.id}
        role="tabpanel"
        className="overflow-hidden bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)]"
        style={{ borderRadius: 32, border: "1px solid rgba(0,0,0,0.07)" }}
      >
        <div
          className="bg-[#101010] text-white"
          style={{ padding: "28px 24px", position: "relative", overflow: "hidden" }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: -60,
              top: -60,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(3,189,72,0.45), transparent 70%)",
            }}
          />
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span
              style={{
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {planLabel(active.plan)}
            </span>
            {active.status === "beta" && (
              <span
                style={{
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  background: "rgba(96,165,250,0.15)",
                  border: "1px solid rgba(147,197,253,0.3)",
                  color: "#bfdbfe",
                }}
              >
                BETA
              </span>
            )}
            {active.status === "soon" && (
              <span
                style={{
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(252,211,77,0.3)",
                  color: "#fde68a",
                }}
              >
                В РАЗРАБОТКЕ
              </span>
            )}
          </div>
          <h2
            className="font-extrabold tracking-[-0.045em]"
            style={{ position: "relative", marginTop: 18, fontSize: "clamp(26px, 5vw, 40px)", lineHeight: 1.1 }}
          >
            {active.title}
          </h2>
          <p style={{ position: "relative", marginTop: 14, maxWidth: 620, fontSize: 15, lineHeight: 1.75, color: "rgba(255,255,255,0.7)" }}>
            {active.lead}
          </p>
        </div>

        <div style={{ padding: "24px", display: "grid", gap: 20 }}>
          <div
            style={{
              borderRadius: 22,
              background: "#ecfff3",
              border: "1px solid rgba(3,189,72,0.2)",
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#02963a" }}>
              Для чего это нужно
            </div>
            <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.7, color: "rgba(0,0,0,0.75)" }}>{active.purpose}</p>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(0,0,0,0.45)" }}>
              Что делает
            </div>
            <ul style={{ marginTop: 12, display: "grid", gap: 10, listStyle: "none", padding: 0 }}>
              {active.does.map((line) => (
                <li
                  key={line}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    borderRadius: 18,
                    border: "1px solid rgba(0,0,0,0.07)",
                    padding: "12px 14px",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "rgba(0,0,0,0.78)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ flex: "0 0 auto", marginTop: 7, width: 8, height: 8, borderRadius: "50%", background: "#03bd48" }}
                  />
                  <span style={{ display: "block" }}>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(0,0,0,0.45)" }}>
              Как это работает
            </div>
            <ol style={{ marginTop: 12, display: "grid", gap: 10, listStyle: "none", padding: 0 }} className="md:grid-cols-3">
              {active.steps.map((step, i) => (
                <li
                  key={step}
                  style={{ borderRadius: 20, background: "#101010", color: "#fff", padding: "16px 16px 18px" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#03bd48" }}>0{i + 1}</div>
                  <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, lineHeight: 1.55 }}>{step}</div>
                </li>
              ))}
            </ol>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href="/dashboard" className="btn-primary">
              Открыть в кабинете
            </Link>
            <Link href="/pricing" className="btn-secondary">
              Тарифы
            </Link>
            {active.id === "positions" && (
              <Link href="/extension" className="btn-secondary">
                Расширение
              </Link>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
