"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { describeSchedule, nextSlots, sourceLabel } from "@/lib/autoload/schedule";
import type {
  AccountStatus,
  FeedSummary,
  ProfileDto,
  ReportSummary,
  ScheduleRule,
} from "@/lib/autoload/types";
import FeedEditor from "./feed-editor";
import IssuesModal from "./issues-modal";
import {
  Accordion,
  AutoloadStyles,
  Icon,
  Pill,
  Spinner,
  Toggle,
  api,
  copyText,
  errorText,
  formatDateTime,
  ghostButton,
  inputClass,
  timeAgo,
  useToast,
} from "./ui";

/* Ключи Авито общие с Бид-менеджером: используем тот же API /api/avito-connection,
   а не отдельное подключение для Автозагрузки. */
type RawAvitoConnection = {
  clientIdMasked: string;
  tokenExpiresAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
} | null;

function toAccountStatus(connection: RawAvitoConnection): AccountStatus {
  if (!connection) return { connected: false };
  return {
    connected: true,
    clientIdMasked: connection.clientIdMasked,
    tokenExpiresAt: connection.tokenExpiresAt,
    lastCheckedAt: connection.lastCheckedAt,
    lastError: connection.lastError,
  };
}

/* =========================================================================
   УСЛУГА «АВТОЗАГРУЗКА ОБЪЯВЛЕНИЙ АВИТО» (08), доступна с подпиской Pro.

   Подключается в dashboard-client.tsx:
     import AutoloadService from "./autoload/autoload-service";
     {activeSection === "autoload" && hasBidderAccess && <AutoloadService />}
   ========================================================================= */

type ReportsState = { last: ReportSummary | null; current: ReportSummary | null; uploads: ReportSummary[] };

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const SCHEDULE_PRESETS: { title: string; rule: ScheduleRule }[] = [
  { title: "Каждый день в 03:00", rule: { rate: 1000, weekdays: [0, 1, 2, 3, 4, 5, 6], time_slots: [3] } },
  { title: "Дважды в день", rule: { rate: 1000, weekdays: [0, 1, 2, 3, 4, 5, 6], time_slots: [6, 18] } },
  { title: "Будни в 09:00", rule: { rate: 1000, weekdays: [0, 1, 2, 3, 4], time_slots: [9] } },
];

const GUIDE_STEPS = [
  {
    title: "Подключите Avito API",
    text: "В личном кабинете Авито откройте раздел «Интеграции», затем «Авито API» и получите client_id и client_secret. Вставьте их в карточку «Подключение Avito API». Ключи хранятся в зашифрованном виде.",
  },
  {
    title: "Создайте таблицу",
    text: "Таблица — это набор объявлений одной категории. Скачайте образец с готовыми заголовками, заполните его и загрузите обратно — из Excel, Google Таблиц, Яндекс Таблиц или просто вставив данные. Можно и добавлять объявления вручную.",
  },
  {
    title: "Заполните общие поля",
    text: "Категория, адрес и телефон обычно одинаковые. Укажите их один раз во вкладке «Общие поля», и они подставятся во все объявления. Категорию можно выбрать из каталога Авито.",
  },
  {
    title: "Проверьте и сохраните",
    text: "Вкладка «Проверка» покажет ошибки до отправки: пустые поля, длинные названия, битые ссылки на фото, повторяющиеся ID.",
  },
  {
    title: "Настройте профиль",
    text: "Один раз укажите почту для отчётов и расписание выгрузок. Профиль общий для всех ваших таблиц.",
  },
  {
    title: "Подключите таблицу",
    text: "Во вкладке «Подключение» нажмите «Подключить». Мы добавим ссылку на XML-файл в ваш профиль Авито, дальше Авито сам забирает файл по расписанию. Проверить работу можно кнопкой «Запустить сейчас».",
  },
];

const GUIDE_NOTES = [
  "Фото должны быть доступны по прямым публичным ссылкам. HelpSell не хранит изображения, используйте своё облако или хостинг.",
  "Не меняйте ID объявления после публикации: по нему Авито узнаёт объявление и обновляет его, а не создаёт новое.",
  "Обязательные поля зависят от категории. Если Авито отклонил объявление, причина появится в отчёте, а после кнопки «Обновить статусы из отчёта» и в таблице.",
  "Файл отдаётся, пока у вас активна подписка Pro. После окончания подписки автозагрузка приостанавливается.",
  "Лимиты: до 20 таблиц, до 5000 объявлений в каждой.",
  "Значения полей «Тип размещения» и «Платная услуга» зависят от категории (у части категорий это Package/Premium/VIP, у других — свои промо-коды вроде x2_7 или BBL). Загрузите поля вашей категории кнопкой «Каталог» — тогда в таблице появится точный список значений для выбора.",
  "Если в Google Таблицах или Excel номер телефона с «+» превращается в формулу или ошибку — отформатируйте столбец как «Текст» (правой кнопкой по столбцу → «Формат» → «Обычный текст»/«Открытый текст») до того, как ввести номер, либо поставьте перед ним апостроф: '+7 999 123-45-67.",
];

const USEFUL_LINKS = [
  {
    title: "Проверка XML-файла Автозагрузки",
    text: "Официальный сервис Авито для проверки готового XML-файла на ошибки перед подключением.",
    href: "https://autoload.avito.ru/format/xmlcheck/",
  },
  {
    title: "Документация по Автозагрузке",
    text: "Полное описание формата, тегов и правил Автозагрузки от Авито.",
    href: "https://www.avito.ru/autoload/documentation",
  },
  {
    title: "Каталог API Авито",
    text: "Все методы API Авито для бизнеса, если нужно посмотреть детали за пределами Автозагрузки.",
    href: "https://developers.avito.ru/api-catalog",
  },
];

type SectionKey = "connection" | "profile" | "history";

/* ---------- Главный компонент ---------- */
export default function AutoloadService() {
  const toast = useToast();
  const feedsRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [feeds, setFeeds] = useState<FeedSummary[] | null>(null);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileRaw, setProfileRaw] = useState<unknown>(null);
  const [reports, setReports] = useState<ReportsState | null>(null);
  const [reportsError, setReportsError] = useState("");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openFeedId, setOpenFeedId] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [focusAdKey, setFocusAdKey] = useState<string | null>(null);
  const [isBetaTooltipOpen, setIsBetaTooltipOpen] = useState(false);
  const [betaTooltipPosition, setBetaTooltipPosition] = useState({ top: 0, right: 16 });
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({ connection: false, profile: false, history: false });
  const autoOpened = useRef({ connection: false, profile: false });

  const openBetaTooltip = (event: { currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setBetaTooltipPosition({ top: rect.bottom + 12, right: Math.max(16, window.innerWidth - rect.right) });
    setIsBetaTooltipOpen(true);
  };

  const connected = account?.connected === true;
  const linkedCount = (feeds ?? []).filter((feed) => feed.linked).length;
  const canRun = Boolean(profile?.exists) && (linkedCount > 0 || Boolean(profile?.feeds.some((feed) => !feed.ours)));

  const toggleSection = (key: SectionKey) => setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  const openSection = (key: SectionKey) => {
    setOpenSections((current) => ({ ...current, [key]: true }));
    window.setTimeout(() => document.getElementById(`al-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  /* ---------- Загрузка данных ---------- */
  useEffect(() => {
    let alive = true;
    Promise.all([
      api<{ connection: RawAvitoConnection }>("/api/avito-connection"),
      api<{ feeds: FeedSummary[] }>("/api/autoload/feeds"),
    ])
      .then(([connectionData, feedsData]) => {
        if (!alive) return;
        setAccount(toAccountStatus(connectionData.connection));
        setFeeds(feedsData.feeds);
      })
      .catch((error) => alive && setLoadError(errorText(error)));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!connected) return;
    let alive = true;

    api<{ profile: ProfileDto; raw?: unknown }>("/api/autoload/profile")
      .then((data) => {
        if (!alive) return;
        setProfile(data.profile);
        setProfileRaw(data.raw ?? null);
      })
      .catch((error) => alive && setProfileError(errorText(error)));

    api<ReportsState>("/api/autoload/reports")
      .then((data) => alive && setReports(data))
      .catch((error) => alive && setReportsError(errorText(error)));

    return () => {
      alive = false;
    };
  }, [connected]);

  // Блоки, которые требуют внимания, раскрываем один раз сами: нет подключения / нет профиля.
  useEffect(() => {
    if (account && !account.connected && !autoOpened.current.connection) {
      autoOpened.current.connection = true;
      setOpenSections((current) => ({ ...current, connection: true }));
    }
  }, [account]);
  useEffect(() => {
    if (profile && !profile.exists && !autoOpened.current.profile) {
      autoOpened.current.profile = true;
      setOpenSections((current) => ({ ...current, profile: true }));
    }
  }, [profile]);

  const refreshFeeds = useCallback(async () => {
    try {
      const data = await api<{ feeds: FeedSummary[] }>("/api/autoload/feeds");
      setFeeds(data.feeds);
    } catch (error) {
      toast.push(errorText(error), "error");
    }
  }, [toast]);

  const refreshReports = async () => {
    setReportsLoading(true);
    setReportsError("");
    try {
      setReports(await api<ReportsState>("/api/autoload/reports"));
    } catch (error) {
      setReportsError(errorText(error));
    } finally {
      setReportsLoading(false);
    }
  };

  async function runNow() {
    if (running) return;
    setRunning(true);
    try {
      await api("/api/autoload/upload", { method: "POST" });
      toast.push("Выгрузка запущена. Отчёт появится в течение нескольких минут.");
      window.setTimeout(() => void refreshReports(), 15000);
    } catch (error) {
      toast.push(errorText(error), "error");
    } finally {
      setRunning(false);
    }
  }

  const toggleGuide = () => {
    setGuideOpen((open) => {
      if (!open) window.setTimeout(() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
      return !open;
    });
  };

  /* ---------- Готовность ---------- */
  const steps: { label: string; done: boolean; target: SectionKey | "feeds" }[] = [
    { label: "Avito API", done: connected, target: "connection" },
    { label: "Таблица", done: (feeds ?? []).some((feed) => feed.adsCount > 0), target: "feeds" },
    { label: "Профиль", done: profile?.exists === true, target: "profile" },
    { label: "Подключена", done: linkedCount > 0, target: "feeds" },
    { label: "Включена", done: profile?.autoloadEnabled === true, target: "profile" },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const goToStep = (target: SectionKey | "feeds") => {
    if (target === "feeds") feedsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else openSection(target);
  };

  const latestUpload = reports?.current ?? reports?.last ?? null;
  const lastScheduled = reports?.uploads.find((item) => item.source === "Url") ?? null;

  /* ---------- Редактор таблицы ---------- */
  if (openFeedId !== null) {
    return (
      <div className="min-w-0">
        <AutoloadStyles />
        <FeedEditor
          feedId={openFeedId}
          account={account}
          profile={profile}
          focusAdKey={focusAdKey}
          onBack={() => {
            setOpenFeedId(null);
            setFocusAdKey(null);
          }}
          onChanged={() => void refreshFeeds()}
          onProfile={setProfile}
          toast={toast.push}
        />
        {toast.node}
      </div>
    );
  }

  /* ---------- Главная страница услуги ---------- */
  return (
    <div className="flex min-w-0 flex-col">
      <AutoloadStyles />

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[28px] bg-black p-5 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-6">
        <button
          type="button"
          aria-label="Информация о BETA-версии Автозагрузки объявлений Авито"
          onMouseEnter={openBetaTooltip}
          onMouseLeave={() => setIsBetaTooltipOpen(false)}
          onFocus={openBetaTooltip}
          onBlur={() => setIsBetaTooltipOpen(false)}
          className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-blue-300/45 bg-blue-500 text-base font-extrabold text-white shadow-[0_8px_20px_rgba(59,130,246,0.3)] transition hover:scale-105 hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/70 sm:right-6 sm:top-6"
        >
          !
        </button>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="min-w-0 pr-12 sm:pr-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-blue-300/30 bg-blue-400/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-blue-200">BETA</span>
              <span className="inline-flex rounded-full border border-[#03bd48]/30 bg-[#03bd48]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#78f8a6]">Подписка Pro</span>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-white/70">Через API Авито</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-[-0.05em] sm:text-3xl">
              Автозагрузка
              <span className="text-[#03bd48]"> объявлений Авито</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
              Ведите объявления в одной таблице, импортируйте из Excel, Google и Яндекс Таблиц — HelpSell соберёт файл, подключит его к Авито и покажет статусы.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => feedsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="btn-primary inline-flex items-center justify-center gap-2 !px-5 !py-3 text-sm"
              >
                <Icon name="table" /> Мои таблицы
              </button>
              <button type="button" onClick={toggleGuide} aria-expanded={guideOpen} className="btn-secondary inline-flex items-center justify-center gap-2 !px-5 !py-3 text-sm">
                <Icon name="book" /> {guideOpen ? "Скрыть инструкцию" : "Инструкция"}
              </button>
            </div>
          </div>

          {/* Готовность */}
          <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 lg:mt-9">
            <div className="flex items-center gap-1.5">
              {[
                { icon: "table", title: "Таблица" },
                { icon: "file", title: "XML" },
                { icon: "sparkle", title: "Авито" },
              ].map((node, index, list) => (
                <Fragment key={node.title}>
                  <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] font-extrabold">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${index === 2 ? "al-pulse bg-[#03bd48] text-white" : "bg-white/10 text-[#78f8a6]"}`}>
                      <Icon name={node.icon} className="h-3 w-3" />
                    </span>
                    {node.title}
                  </span>
                  {index < list.length - 1 && <div className="al-wire" />}
                </Fragment>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">
              <span>Готовность</span>
              <span className="text-[#78f8a6]">{doneCount} из {steps.length}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#03bd48] transition-[width] duration-700 ease-out" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {steps.map((step) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => (step.done ? undefined : goToStep(step.target))}
                  title={step.done ? "Готово" : "Нажмите, чтобы перейти к этому шагу"}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    step.done ? "cursor-default bg-[#03bd48]/15 text-[#78f8a6]" : "bg-white/[0.07] text-white/55 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <Icon name={step.done ? "check" : "plus"} className="h-3 w-3" />
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isBetaTooltipOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[99999] w-[min(390px,calc(100vw-2rem))] rounded-2xl border border-blue-200/35 bg-[#172238] p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.58)]"
            style={{ top: betaTooltipPosition.top, right: betaTooltipPosition.right }}
            role="tooltip"
          >
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-base font-extrabold text-white">
                !
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-blue-100">Услуга находится на этапе BETA-тестирования</div>
                <p className="mt-1 text-sm leading-6 text-white/70">
                  Некоторые функции Автозагрузки объявлений Авито могут работать некорректно, быть неполными или
                  временно недоступными.
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-blue-200">
                  Мы продолжаем дорабатывать и совершенствовать услугу. Используя Автозагрузку, вы помогаете нам
                  выявлять проблемы и улучшать сервис.
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ИНСТРУКЦИЯ */}
      <div
        ref={guideRef}
        className={`grid transition-[grid-template-rows,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${guideOpen ? "mt-6 grid-rows-[1fr]" : "mt-0 grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <section
            aria-hidden={!guideOpen}
            className={`overflow-hidden rounded-[28px] border border-[#03bd48]/20 bg-[linear-gradient(135deg,rgba(3,189,72,.09),rgba(255,255,255,1)_58%)] shadow-[0_18px_45px_rgba(16,24,40,.06)] transition-all duration-500 ${guideOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}
          >
            <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#027a30]/65">Справка</div>
                <h3 className="mt-1 text-xl font-extrabold tracking-[-.03em] text-black">Как работает автозагрузка</h3>
                <p className="mt-1 text-sm leading-6 text-black/55">Шесть шагов от ключей API до выгрузки на Авито.</p>
              </div>
              <button
                type="button"
                onClick={toggleGuide}
                tabIndex={guideOpen ? 0 : -1}
                aria-label="Скрыть инструкцию"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:-translate-y-0.5 hover:border-[#03bd48]/50 hover:text-[#028c36]"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="border-t border-[#03bd48]/15 p-5 sm:p-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {GUIDE_STEPS.map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-black/[0.08] bg-white p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-xs font-extrabold text-white">{index + 1}</div>
                    <div className="mt-3 text-sm font-extrabold text-black">{step.title}</div>
                    <p className="mt-1.5 text-sm leading-6 text-black/60">{step.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5">
                <div className="text-sm font-extrabold text-black">Важно знать</div>
                <ul className="mt-3 space-y-2.5">
                  {GUIDE_NOTES.map((note) => (
                    <li key={note} className="flex gap-3 text-sm leading-6 text-black/60">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#03bd48]" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5">
                <div className="text-sm font-extrabold text-black">Полезные ссылки Авито</div>
                <ul className="mt-3 space-y-3">
                  {USEFUL_LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#028c36] hover:underline"
                      >
                        {link.title}
                        <Icon name="link" className="h-3.5 w-3.5 shrink-0" />
                      </a>
                      <p className="mt-0.5 text-sm leading-6 text-black/55">{link.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      {loadError && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{loadError}</div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
        {/* ОСНОВНОЕ: таблицы и последняя выгрузка */}
        <div ref={feedsRef} className="min-w-0 scroll-mt-6 space-y-5">
          <FeedsCard
            feeds={feeds}
            onOpen={setOpenFeedId}
            onCreated={(feed) => {
              setFeeds((current) => [feed, ...(current ?? [])]);
              setOpenFeedId(feed.id);
            }}
            onDeleted={(id) => setFeeds((current) => (current ?? []).filter((feed) => feed.id !== id))}
            toast={toast.push}
          />

          {connected && (
            <LastUploadCard
              reports={reports}
              error={reportsError}
              loading={reportsLoading}
              profile={profile}
              canRun={canRun}
              running={running}
              onRefresh={() => void refreshReports()}
              onShowIssues={() => setIssuesOpen(true)}
              onRunNow={() => void runNow()}
              onOpenProfile={() => openSection("profile")}
              onOpenHistory={() => openSection("history")}
            />
          )}
        </div>

        {/* СЛУЖЕБНОЕ: всё раскрывается по клику */}
        <div className="min-w-0 space-y-3">
          <Accordion
            id="al-connection"
            icon="key"
            title="Подключение Avito API"
            summary={connected ? `Подключено · Client ID ${account?.clientIdMasked ?? ""}` : account ? "Не подключено — нужны Client ID и Client Secret" : "Загрузка…"}
            badge={account ? <Pill tone={connected ? "green" : "amber"}>{connected ? "Готово" : "Нужно"}</Pill> : undefined}
            open={openSections.connection}
            onToggle={() => toggleSection("connection")}
          >
            <ConnectionPanel
              account={account}
              onConnected={(next) => {
                setAccount(next);
                setProfileError("");
                setReportsError("");
              }}
              onDisconnected={() => {
                // «Отключить автозагрузку» не трогает сами ключи Авито — аккаунт остаётся
                // подключённым (им пользуется и Бид-менеджер), меняются только профиль и таблицы.
                void refreshFeeds();
                api<{ profile: ProfileDto }>("/api/autoload/profile")
                  .then((d) => setProfile(d.profile))
                  .catch(() => null);
              }}
              toast={toast.push}
            />
          </Accordion>

          {connected && (
            <Accordion
              id="al-profile"
              icon="clock"
              title="Расписание и профиль автозагрузки"
              summary={
                !profile
                  ? profileError
                    ? "Не удалось загрузить"
                    : "Загрузка…"
                  : !profile.exists
                    ? "Профиль ещё не создан"
                    : `${profile.autoloadEnabled ? "Включена" : "Выключена"} · ${describeSchedule(profile.schedule)}`
              }
              badge={profile?.exists ? <Pill tone={profile.autoloadEnabled ? "green" : "gray"}>{profile.autoloadEnabled ? "Включена" : "Выключена"}</Pill> : profile ? <Pill tone="amber">Нужно</Pill> : undefined}
              open={openSections.profile}
              onToggle={() => toggleSection("profile")}
            >
              <ProfilePanel
                profile={profile}
                error={profileError}
                linkedCount={linkedCount}
                uploads={reports?.uploads ?? []}
                lastScheduled={lastScheduled}
                canRun={canRun}
                running={running}
                onRunNow={() => void runNow()}
                onSaved={(next) => {
                  setProfile(next);
                  setProfileError("");
                }}
                toast={toast.push}
              />

              <details className="group rounded-2xl border border-black/[0.08] bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-xs font-extrabold text-black/50 [&::-webkit-details-marker]:hidden">
                  <span>Техническое: как это видит Авито (сырой ответ API)</span>
                  <Icon name="chevron" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-black/[0.06] p-3">
                  <p className="mb-2 text-xs leading-5 text-black/45">
                    Ответ GET /autoload/v2/profile от Авито без обработки — пригодится, если что-то не сходится с тем, что показано выше.
                  </p>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black p-3 text-[11px] leading-5 text-[#78f8a6]">
                    {profileRaw ? JSON.stringify(profileRaw, null, 2) : "нет данных (профиль ещё не создан)"}
                  </pre>
                </div>
              </details>
            </Accordion>
          )}

          {connected && (
            <Accordion
              id="al-history"
              icon="file"
              title="История выгрузок"
              summary={
                reports?.uploads.length
                  ? `Последняя №${reports.uploads[0].id} · ${STATUS_LABEL[reports.uploads[0].status] ?? reports.uploads[0].status}`
                  : reports
                    ? "Выгрузок пока нет"
                    : reportsError
                      ? "Не удалось загрузить"
                      : "Загрузка…"
              }
              badge={latestUpload ? <Pill tone={reportTone(latestUpload.status)}>{shortStatus(latestUpload.status)}</Pill> : undefined}
              open={openSections.history}
              onToggle={() => toggleSection("history")}
            >
              <HistoryPanel reports={reports} error={reportsError} loading={reportsLoading} onRefresh={() => void refreshReports()} />
            </Accordion>
          )}
        </div>
      </div>

      {issuesOpen && (
        <IssuesModal
          onClose={() => setIssuesOpen(false)}
          onOpenAd={(feedId, adKey) => {
            setFocusAdKey(adKey);
            setOpenFeedId(feedId);
          }}
        />
      )}

      {toast.node}
    </div>
  );
}

/* ---------- Таблицы ---------- */
function FeedsCard({
  feeds,
  onOpen,
  onCreated,
  onDeleted,
  toast,
}: {
  feeds: FeedSummary[] | null;
  onOpen: (id: number) => void;
  onCreated: (feed: FeedSummary) => void;
  onDeleted: (id: number) => void;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function create() {
    if (creating) return;
    setCreating(true);
    try {
      const data = await api<{ feed: FeedSummary }>("/api/autoload/feeds", { json: { name } });
      setName("");
      onCreated(data.feed);
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setCreating(false);
    }
  }

  async function remove(feed: FeedSummary) {
    const text = feed.linked
      ? `Удалить таблицу «${feed.name}»? Она подключена к автозагрузке: ссылка на файл будет убрана из профиля Авито.`
      : `Удалить таблицу «${feed.name}» вместе со всеми объявлениями?`;
    if (!window.confirm(text)) return;

    setDeletingId(feed.id);
    try {
      await api(`/api/autoload/feeds/${feed.id}`, { method: "DELETE" });
      onDeleted(feed.id);
      toast("Таблица удалена.");
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="white-card min-w-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-extrabold tracking-[-0.04em] text-black sm:text-2xl">
          Мои таблицы{feeds ? <span className="ml-2 text-base font-bold text-black/30">{feeds.length}</span> : null}
        </h3>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
        className="mt-4 flex flex-col gap-2.5 sm:flex-row"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="Название новой таблицы, например «Диваны, Москва»"
          className={inputClass}
          aria-label="Название таблицы"
        />
        <button type="submit" disabled={creating} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 !px-5 !py-3 text-sm disabled:opacity-60">
          {creating ? <Spinner /> : <Icon name="plus" />} Создать
        </button>
      </form>

      <div className="mt-4 space-y-2.5">
        {feeds === null && [0, 1].map((item) => <div key={item} className="al-skeleton h-20 rounded-2xl" />)}

        {feeds?.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-black/15 bg-black/[0.02] p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#03bd48]/10 text-[#028c36]">
              <Icon name="table" className="h-5 w-5" />
            </div>
            <div className="mt-3 text-base font-extrabold text-black">Создайте первую таблицу</div>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-black/50">Введите название выше и нажмите «Создать». Дальше можно импортировать объявления из Excel.</p>
          </div>
        )}

        {feeds?.map((feed, index) => (
          <div
            key={feed.id}
            style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
            className="al-pop min-w-0 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3.5 transition duration-300 hover:border-[#03bd48]/30 hover:bg-white hover:shadow-[0_14px_30px_rgba(3,189,72,0.08)] sm:p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <button type="button" onClick={() => onOpen(feed.id)} className="min-w-0 flex-1 basis-48 text-left">
                <div className="truncate text-base font-extrabold tracking-[-0.02em] text-black">{feed.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Pill tone={feed.linked ? "green" : "gray"}>{feed.linked ? "Подключена" : "Не подключена"}</Pill>
                  <span className="text-xs font-semibold text-black/45">
                    {feed.adsCount} объявл. · {feed.lastFetchedAt ? `Авито забирал ${timeAgo(feed.lastFetchedAt)}` : "Авито ещё не забирал"}
                  </span>
                </div>
              </button>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => onOpen(feed.id)} className="btn-primary !px-4 !py-2 text-sm">
                  Открыть
                </button>
                <button
                  type="button"
                  onClick={() => void remove(feed)}
                  disabled={deletingId === feed.id}
                  aria-label={`Удалить ${feed.name}`}
                  title="Удалить таблицу"
                  className="rounded-xl border border-black/10 p-2 text-black/40 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingId === feed.id ? <Spinner /> : <Icon name="trash" />}
                </button>
              </div>
            </div>

            <details className="group mt-2.5">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-extrabold text-black/45 transition hover:text-[#028c36] [&::-webkit-details-marker]:hidden">
                <Icon name="link" className="h-3.5 w-3.5" /> Ссылка на XML-файл
                <Icon name="chevron" className="h-3 w-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-black px-3.5 py-2">
                <code className="min-w-0 flex-1 truncate text-xs font-semibold text-[#78f8a6]">{feed.publicUrl}</code>
                <button
                  type="button"
                  onClick={async () => toast((await copyText(feed.publicUrl)) ? "Ссылка скопирована." : "Не удалось скопировать ссылку.", "ok")}
                  aria-label="Копировать ссылку"
                  className="shrink-0 rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon name="copy" />
                </button>
              </div>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Подключение Avito API ---------- */
function ConnectionPanel({
  account,
  onConnected,
  onDisconnected,
  toast,
}: {
  account: AccountStatus | null;
  onConnected: (account: AccountStatus) => void;
  onDisconnected: () => void;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const connected = account?.connected === true;
  const showForm = !connected || editing;

  async function connect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ connection: RawAvitoConnection }>("/api/avito-connection", {
        json: { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
      });
      setClientId("");
      setClientSecret("");
      setEditing(false);
      onConnected(toAccountStatus(data.connection));
      toast("Avito API подключён.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (
      !window.confirm(
        "Отключить Автозагрузку от Авито? Ссылки на файлы HelpSell будут убраны из профиля автозагрузки. Ключи client_id/client_secret останутся — ими пользуется Бид-менеджер.",
      )
    )
      return;
    setBusy(true);
    try {
      await api("/api/autoload/unlink", { method: "POST" });
      onDisconnected();
      toast("Автозагрузка отключена от Авито.");
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0">
      {account === null && <div className="al-skeleton h-20 rounded-2xl" />}

      {connected && !editing && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#03bd48]/25 bg-[#03bd48]/[0.06] p-3.5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#027a30]">
              <Icon name="check" className="h-4 w-4 shrink-0" /> Ключи Авито подключены
            </div>
            <div className="mt-1.5 text-sm font-bold text-black">
              Client ID: <span className="break-all">{account?.clientIdMasked}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-black/55">Те же ключи использует Бид-менеджер Авито — подключать их дважды не нужно. Проверено {formatDateTime(account?.lastCheckedAt)}.</p>
          </div>
          {account?.lastError && <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold text-red-600">{account.lastError}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
              Заменить ключи
            </button>
            <button
              type="button"
              onClick={() => void unlink()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Отключить автозагрузку
            </button>
          </div>
          <p className="text-xs leading-5 text-black/40">Полностью отключить ключи Авито можно в разделе «Бид-менеджер» → «Кабинет Авито».</p>
        </div>
      )}

      {showForm && account !== null && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <p className="text-sm leading-6 text-black/60">
            Ключи берутся в личном кабинете Авито: «Интеграции» → «Авито API». Если Авито уже подключён в Бид-менеджере, здесь появится то же подключение —
            вводить ключи ещё раз не нужно.{" "}
            <a href="https://www.avito.ru/developers/api-catalog" target="_blank" rel="noopener noreferrer" className="font-bold text-[#028c36] hover:underline">
              Документация API
            </a>
          </p>
          <input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Client ID"
            autoComplete="off"
            spellCheck={false}
            aria-label="Client ID"
            className={inputClass}
          />
          <input
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder="Client Secret"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            aria-label="Client Secret"
            className={inputClass}
          />
          {error && <div className="al-pop rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold text-red-600">{error}</div>}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="submit"
              disabled={busy || clientId.trim().length < 6 || clientSecret.trim().length < 6}
              className="btn-primary inline-flex items-center gap-2 !px-5 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Icon name="key" />} Проверить и подключить
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(false)} className={ghostButton}>
                Отмена
              </button>
            )}
          </div>
          <p className="text-xs leading-5 text-black/40">Ключи шифруются на сервере и используются только для запросов к API Авито от вашего имени.</p>
        </form>
      )}
    </div>
  );
}

/* ---------- Расписание и профиль ---------- */
function ProfilePanel({
  profile,
  error,
  linkedCount,
  uploads,
  lastScheduled,
  canRun,
  running,
  onRunNow,
  onSaved,
  toast,
}: {
  profile: ProfileDto | null;
  error: string;
  linkedCount: number;
  uploads: ReportSummary[];
  lastScheduled: ReportSummary | null;
  canRun: boolean;
  running: boolean;
  onRunNow: () => void;
  onSaved: (profile: ProfileDto) => void;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  return (
    <div className="min-w-0 space-y-5">
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-600">{error}</div>}
      {!profile && !error && (
        <div className="space-y-3">
          <div className="al-skeleton h-12 rounded-2xl" />
          <div className="al-skeleton h-32 rounded-2xl" />
        </div>
      )}

      {profile && (
        <>
          <ScheduleDiagnostics profile={profile} linkedCount={linkedCount} uploads={uploads} lastScheduled={lastScheduled} />
          <ProfileForm
            key={JSON.stringify([profile.exists, profile.reportEmail, profile.autoloadEnabled, profile.schedule])}
            profile={profile}
            linkedCount={linkedCount}
            canRun={canRun}
            running={running}
            onRunNow={onRunNow}
            onSaved={onSaved}
            toast={toast}
          />
        </>
      )}
    </div>
  );
}

/** Понятная сводка: сработает ли расписание, когда ближайший запуск и был ли последний. */
function ScheduleDiagnostics({
  profile,
  linkedCount,
  uploads,
  lastScheduled,
}: {
  profile: ProfileDto;
  linkedCount: number;
  uploads: ReportSummary[];
  lastScheduled: ReportSummary | null;
}) {
  const problems: { text: string; action?: { href: string; label: string } }[] = [];
  if (!profile.exists) {
    problems.push({ text: "Профиль автозагрузки ещё не создан — укажите почту и расписание ниже и нажмите «Создать профиль»." });
  } else {
    if (profile.uploadMode && profile.uploadMode !== "auto") {
      problems.push({
        text:
          "У Авито включён режим «вручную» — это их отдельная внутренняя настройка, не связанная с переключателем и расписанием ниже. Пока он стоит на «вручную», Авито не заходит на файл сам, даже если здесь всё включено и расписание задано. Откройте настройки Авито и один раз включите там автозагрузку по расписанию (по ссылке) — дальше расписание из HelpSell будет применяться само.",
        action: { href: "https://www.avito.ru/autoload/settings", label: "Открыть настройки Авито" },
      });
    }
    if (!profile.autoloadEnabled) {
      problems.push({ text: "Автозагрузка по расписанию выключена в профиле Авито. Включите переключатель ниже и нажмите «Сохранить профиль» — иначе Авито сам файл не заберёт, работает только «Запустить сейчас»." });
    }
    if (profile.feeds.length === 0) {
      problems.push({ text: "В профиле Авито нет ни одного файла. Откройте таблицу → вкладка «Подключение» → «Подключить к автозагрузке Авито»." });
    } else if (linkedCount === 0 && !profile.feeds.some((feed) => !feed.ours)) {
      problems.push({ text: "Ни одна таблица HelpSell не подключена к автозагрузке." });
    }
    if (profile.schedule.length === 0) problems.push({ text: "Не задано ни одного окна расписания." });
  }

  const slots = profile.exists && profile.autoloadEnabled ? nextSlots(profile.schedule, 3) : [];

  return (
    <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4">
      <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-black/40">Как сейчас работает расписание</div>

      {problems.length > 0 ? (
        <ul className="mt-2.5 space-y-2">
          {problems.map((problem) => (
            <li key={problem.text} className="flex gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-900">
              <Icon name="warning" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                {problem.text}
                {problem.action && (
                  <a
                    href={problem.action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap font-extrabold text-amber-900 underline underline-offset-2 hover:text-black"
                  >
                    {problem.action.label} <Icon name="link" className="h-3 w-3" />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2.5 space-y-2.5">
          {profile.uploadMode === "auto" && (
            <div className="flex items-center gap-2 text-xs font-bold text-[#027a30]">
              <Icon name="check" className="h-3.5 w-3.5 shrink-0" /> Режим у Авито: автоматически по расписанию.
            </div>
          )}
          <div>
            <div className="text-xs font-bold text-black/50">Ближайшие запуски (время московское)</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {slots.length === 0 && <span className="text-xs font-semibold text-black/40">—</span>}
              {slots.map((slot) => (
                <span key={slot.start} className={`inline-flex whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${slot.current ? "bg-[#03bd48] text-white" : "bg-white text-black/70 ring-1 ring-black/10"}`}>
                  {slot.current ? "сейчас: " : ""}
                  {slot.label}
                </span>
              ))}
            </div>
          </div>
          <div className="text-xs leading-5 text-black/55">
            {lastScheduled ? (
              <>
                Последний запуск по расписанию: <b className="text-black">№{lastScheduled.id}</b>, {formatDateTime(lastScheduled.startedAt)}.
              </>
            ) : uploads.length > 0 ? (
              "По расписанию запусков пока не было — в истории только ручные выгрузки."
            ) : (
              "Выгрузок пока не было."
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-black/45">
        Авито запускает выгрузку <b>в течение выбранного часа</b> (не ровно в его начале) и только в отмеченные дни. В истории выгрузок запуск по расписанию помечен
        «по ссылке (расписание)».
      </p>
    </div>
  );
}

function ProfileForm({
  profile,
  linkedCount,
  canRun,
  running,
  onRunNow,
  onSaved,
  toast,
}: {
  profile: ProfileDto;
  linkedCount: number;
  canRun: boolean;
  running: boolean;
  onRunNow: () => void;
  onSaved: (profile: ProfileDto) => void;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [email, setEmail] = useState(profile.reportEmail);
  const [enabled, setEnabled] = useState(profile.autoloadEnabled);
  const [schedule, setSchedule] = useState<ScheduleRule[]>(profile.schedule.length > 0 ? profile.schedule : [SCHEDULE_PRESETS[0].rule]);
  const [agreement, setAgreement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const canEnable = linkedCount > 0 || profile.feeds.some((feed) => !feed.ours);

  async function save() {
    if (saving) return;
    setFormError("");
    setSaving(true);
    try {
      const data = await api<{ profile: ProfileDto }>("/api/autoload/profile", {
        json: {
          reportEmail: email.trim(),
          autoloadEnabled: enabled && canEnable,
          schedule,
          agreement: !profile.exists ? agreement : undefined,
        },
      });
      onSaved(data.profile);
      toast("Профиль автозагрузки сохранён.");
    } catch (error) {
      setFormError(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  const updateRule = (index: number, patch: Partial<ScheduleRule>) =>
    setSchedule((rules) => rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));

  const toggleIn = (list: number[], value: number) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value].sort((a, b) => a - b);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border border-black/[0.08] bg-white p-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-black">Автозагрузка по расписанию</div>
          <div className="mt-0.5 text-xs leading-5 text-black/45">
            {canEnable ? "Авито сам заберёт файл в выбранное время." : "Сначала подключите хотя бы одну таблицу: откройте её → «Подключение»."}
          </div>
        </div>
        <Toggle checked={enabled && canEnable} onChange={setEnabled} disabled={!canEnable} label="Автозагрузка по расписанию" />
      </div>

      <div>
        <label htmlFor="al-email" className="mb-1.5 block text-sm font-extrabold text-black">
          Почта для отчётов Авито
        </label>
        <input id="al-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-extrabold text-black">Расписание (время московское)</div>
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_PRESETS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => setSchedule([preset.rule])}
                className="whitespace-nowrap rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-extrabold text-black/60 transition hover:border-[#03bd48]/50 hover:text-[#028c36]"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {schedule.map((rule, index) => (
            <div key={index} className="al-pop min-w-0 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((label, day) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={rule.weekdays.includes(day)}
                      onClick={() => updateRule(index, { weekdays: toggleIn(rule.weekdays, day) })}
                      className={`h-9 w-10 rounded-xl text-xs font-extrabold transition ${
                        rule.weekdays.includes(day) ? "bg-black text-white" : "bg-white text-black/50 ring-1 ring-black/10 hover:ring-[#03bd48]/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {schedule.length > 1 && (
                  <button type="button" onClick={() => setSchedule((rules) => rules.filter((_, i) => i !== index))} aria-label="Удалить правило" className="rounded-lg p-2 text-black/35 transition hover:bg-red-50 hover:text-red-600">
                    <Icon name="trash" />
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {Array.from({ length: 24 }, (_, hour) => (
                  <button
                    key={hour}
                    type="button"
                    aria-pressed={rule.time_slots.includes(hour)}
                    onClick={() => updateRule(index, { time_slots: toggleIn(rule.time_slots, hour) })}
                    className={`flex h-10 min-w-[52px] items-center justify-center whitespace-nowrap rounded-lg px-2 text-xs font-extrabold leading-none tabular-nums transition ${
                      rule.time_slots.includes(hour)
                        ? "bg-[#03bd48] text-white"
                        : "bg-white text-black/45 ring-1 ring-black/10 hover:ring-[#03bd48]/50"
                    }`}
                  >
                    {String(hour).padStart(2, "0")}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <label htmlFor={`rate-${index}`} className="text-xs font-extrabold text-black/55">
                  Объявлений за окно
                </label>
                <input
                  id={`rate-${index}`}
                  type="number"
                  min={1}
                  max={1000000}
                  value={rule.rate}
                  onChange={(event) => updateRule(index, { rate: Number(event.target.value) })}
                  className={`${inputClass} !w-28 !flex-none !py-2`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setSchedule((rules) => [...rules, { rate: 1000, weekdays: [0, 1, 2, 3, 4, 5, 6], time_slots: [12] }])} className={ghostButton}>
            <Icon name="plus" /> Добавить правило
          </button>
          <span className="min-w-0 text-xs font-semibold leading-5 text-black/45">Итого: {describeSchedule(schedule)}</span>
        </div>
      </div>

      {profile.feeds.length > 0 && (
        <details className="group rounded-2xl border border-black/[0.08] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-extrabold text-black [&::-webkit-details-marker]:hidden">
            <span>Файлы в профиле Авито · {profile.feeds.length}</span>
            <Icon name="chevron" className="h-4 w-4 shrink-0 text-black/40 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-1.5 border-t border-black/[0.06] p-3">
            {profile.feeds.map((feed) => (
              <div key={feed.url} className="flex min-w-0 items-center gap-2.5 rounded-xl bg-black/[0.03] px-3 py-2">
                <Pill tone={feed.ours ? "green" : "gray"} className="shrink-0">{feed.ours ? "HelpSell" : "Внешний"}</Pill>
                <span className="min-w-0 truncate text-sm font-bold text-black/70" title={feed.url}>{feed.name}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {!profile.exists && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/[0.08] bg-white p-3.5">
          <input type="checkbox" checked={agreement} onChange={(event) => setAgreement(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#03bd48]" />
          <span className="min-w-0 text-sm leading-6 text-black/65">Принимаю условия использования Автозагрузки Авито. Профиль создаётся в вашем аккаунте Авито.</span>
        </label>
      )}

      {formError && <div className="al-pop rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-600">{formError}</div>}

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (!profile.exists && !agreement)}
          className="btn-primary inline-flex items-center gap-2 !px-5 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Spinner /> : <Icon name="check" />} {profile.exists ? "Сохранить профиль" : "Создать профиль"}
        </button>
        <button type="button" onClick={onRunNow} disabled={running || !canRun} className={ghostButton}>
          {running ? <Spinner /> : <Icon name="play" />} Запустить сейчас
        </button>
      </div>
    </div>
  );
}

/* ---------- Выгрузки ---------- */
// status: processing | success | success_warning | error (перечисление из API Авито v4/uploads)
function reportTone(status: string): "green" | "red" | "amber" | "gray" {
  if (status === "success") return "green";
  if (status === "error") return "red";
  if (status === "success_warning") return "amber";
  if (status === "processing") return "amber";
  return "gray";
}

const STATUS_LABEL: Record<string, string> = {
  processing: "Идёт загрузка",
  success: "Загружено без ошибок",
  success_warning: "Загружено, есть замечания",
  error: "Ошибка загрузки",
};

const shortStatus = (status: string) =>
  ({ processing: "Идёт", success: "Ок", success_warning: "Замечания", error: "Ошибка" })[status] ?? status;

/** Компактная карточка «что было в последний раз» + быстрые действия. */
function LastUploadCard({
  reports,
  error,
  loading,
  profile,
  canRun,
  running,
  onRefresh,
  onShowIssues,
  onRunNow,
  onOpenProfile,
  onOpenHistory,
}: {
  reports: ReportsState | null;
  error: string;
  loading: boolean;
  profile: ProfileDto | null;
  canRun: boolean;
  running: boolean;
  onRefresh: () => void;
  onShowIssues: () => void;
  onRunNow: () => void;
  onOpenProfile: () => void;
  onOpenHistory: () => void;
}) {
  const last = reports?.last ?? null;
  const current = reports?.current ?? null;
  const hasIssues = last?.status === "success_warning" || last?.status === "error";
  const next = profile?.exists && profile.autoloadEnabled ? nextSlots(profile.schedule, 1)[0] : null;

  return (
    <section className="white-card min-w-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-extrabold tracking-[-0.04em] text-black sm:text-2xl">Последняя выгрузка</h3>
        <button type="button" onClick={onRefresh} disabled={loading} className={`${ghostButton} !px-3 !py-2`} title="Обновить данные из Авито">
          {loading ? <Spinner /> : <Icon name="refresh" />} Обновить
        </button>
      </div>

      {error && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold leading-6 text-red-600">{error}</div>}
      {!reports && !error && <div className="al-skeleton mt-3 h-24 rounded-2xl" />}

      {reports && !last && !current && (
        <div className="mt-3 rounded-2xl bg-black/[0.03] p-5 text-center text-sm font-semibold leading-6 text-black/50">
          Выгрузок пока нет. Они появятся после первого запуска — по расписанию или по кнопке «Запустить сейчас».
        </div>
      )}

      {current && (
        <div className="al-pop mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Spinner className="h-3.5 w-3.5 text-amber-700" />
          <span className="min-w-0 text-sm font-extrabold text-amber-900">Идёт загрузка №{current.id}</span>
          <span className="text-xs font-semibold text-amber-900/70">с {formatDateTime(current.startedAt)}</span>
        </div>
      )}

      {last && (
        <div className="al-pop mt-3 min-w-0 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Pill tone={reportTone(last.status)}>{STATUS_LABEL[last.status] ?? last.status}</Pill>
            <span className="text-sm font-extrabold text-black">№{last.id}</span>
            <span className="text-xs font-semibold text-black/45">{formatDateTime(last.startedAt)}</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-black/45">Источник: {sourceLabel(last.source)}</div>

          {last.counts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {last.counts.map((item) => (
                <span key={item.label} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-black/70 ring-1 ring-black/10">
                  <span className="min-w-0 truncate">{item.label}</span>
                  <b className="shrink-0 text-black">{item.value}</b>
                </span>
              ))}
            </div>
          )}

          {last.events.length > 0 && (
            <div className="mt-2.5 space-y-1">
              {last.events.map((event, index) => (
                <div key={index} className="text-xs leading-5 text-amber-800">⚠ {event.description}</div>
              ))}
            </div>
          )}

          {hasIssues && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-50 px-3.5 py-3">
              <p className="min-w-0 flex-1 basis-48 text-xs font-semibold leading-5 text-amber-900">
                {last.status === "error"
                  ? "Загрузка завершилась с ошибкой."
                  : "Авито принял файл, но по части объявлений есть сообщения — где-то ошибка, где-то замечание."}{" "}
                Покажем, что именно поправить.
              </p>
              <button type="button" onClick={onShowIssues} className="btn-primary inline-flex shrink-0 items-center gap-2 !px-4 !py-2 text-xs">
                <Icon name="search" /> Что исправить
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56 text-xs font-semibold leading-5 text-black/50">
          {next ? (
            <>
              Следующий запуск по расписанию: <b className="text-black">{next.label}</b> (МСК)
            </>
          ) : profile?.exists ? (
            <>
              Расписание выключено.{" "}
              <button type="button" onClick={onOpenProfile} className="font-extrabold text-[#028c36] hover:underline">
                Настроить
              </button>
            </>
          ) : (
            <>
              Профиль не создан.{" "}
              <button type="button" onClick={onOpenProfile} className="font-extrabold text-[#028c36] hover:underline">
                Создать
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRunNow} disabled={running || !canRun} className={ghostButton} title={canRun ? "Не ждать расписания" : "Сначала подключите таблицу и создайте профиль"}>
            {running ? <Spinner /> : <Icon name="play" />} Запустить сейчас
          </button>
          <button type="button" onClick={onOpenHistory} className={ghostButton}>
            Вся история
          </button>
        </div>
      </div>
    </section>
  );
}

function HistoryPanel({
  reports,
  error,
  loading,
  onRefresh,
}: {
  reports: ReportsState | null;
  error: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs leading-5 text-black/50">Самая свежая выгрузка — сверху.</p>
        <button type="button" onClick={onRefresh} disabled={loading} className={`${ghostButton} shrink-0 !px-3 !py-1.5 !text-xs`}>
          {loading ? <Spinner /> : <Icon name="refresh" />} Обновить
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold leading-6 text-red-600">{error}</div>}
      {!reports && !error && <div className="al-skeleton h-24 rounded-2xl" />}
      {reports && reports.uploads.length === 0 && <div className="rounded-2xl bg-black/[0.03] p-4 text-center text-sm font-semibold text-black/45">Выгрузок пока нет.</div>}

      {reports && reports.uploads.length > 0 && (
        <div className="max-h-[420px] divide-y divide-black/[0.06] overflow-y-auto rounded-2xl border border-black/[0.08]">
          {reports.uploads.map((report) => (
            <div key={report.id} className="min-w-0 bg-white px-3.5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-extrabold text-black">№{report.id}</span>
                <Pill tone={reportTone(report.status)}>{STATUS_LABEL[report.status] ?? report.status}</Pill>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-black/45">
                <span>{formatDateTime(report.startedAt)}</span>
                <span className="min-w-0 truncate">· {sourceLabel(report.source)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
