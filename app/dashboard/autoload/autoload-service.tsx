"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AccountStatus,
  FeedSummary,
  ProfileDto,
  ReportSummary,
  ScheduleRule,
} from "@/lib/autoload/types";

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
import FeedEditor from "./feed-editor";
import {
  AutoloadStyles,
  Icon,
  Pill,
  SectionTitle,
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

/* ---------- Главный компонент ---------- */
export default function AutoloadService() {
  const toast = useToast();
  const feedsRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [feeds, setFeeds] = useState<FeedSummary[] | null>(null);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [profileError, setProfileError] = useState("");
  const [reports, setReports] = useState<ReportsState | null>(null);
  const [reportsError, setReportsError] = useState("");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openFeedId, setOpenFeedId] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isBetaTooltipOpen, setIsBetaTooltipOpen] = useState(false);
  const [betaTooltipPosition, setBetaTooltipPosition] = useState({ top: 0, right: 16 });

  const openBetaTooltip = (event: { currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setBetaTooltipPosition({ top: rect.bottom + 12, right: Math.max(16, window.innerWidth - rect.right) });
    setIsBetaTooltipOpen(true);
  };

  const connected = account?.connected === true;

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

    api<{ profile: ProfileDto }>("/api/autoload/profile")
      .then((data) => alive && setProfile(data.profile))
      .catch((error) => alive && setProfileError(errorText(error)));

    api<ReportsState>("/api/autoload/reports")
      .then((data) => alive && setReports(data))
      .catch((error) => alive && setReportsError(errorText(error)));

    return () => {
      alive = false;
    };
  }, [connected]);

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

  const toggleGuide = () => {
    setGuideOpen((open) => {
      if (!open) window.setTimeout(() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
      return !open;
    });
  };

  /* ---------- Состояние готовности ---------- */
  const steps = [
    { label: "Avito API", done: connected },
    { label: "Таблица с объявлениями", done: (feeds ?? []).some((feed) => feed.adsCount > 0) },
    { label: "Профиль автозагрузки", done: profile?.exists === true },
    { label: "Таблица подключена", done: (feeds ?? []).some((feed) => feed.linked) },
    { label: "Автозагрузка включена", done: profile?.autoloadEnabled === true },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  /* ---------- Редактор таблицы ---------- */
  if (openFeedId !== null) {
    return (
      <div className="min-w-0 break-words">
        <AutoloadStyles />
        <FeedEditor
          feedId={openFeedId}
          account={account}
          profile={profile}
          onBack={() => setOpenFeedId(null)}
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
    <div className="flex min-w-0 flex-col break-words">
      <AutoloadStyles />

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[30px] bg-black p-5 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-7 md:p-8">
        <button
    type="button"
    aria-label="Информация о BETA-версии Автозагрузки объявлений Авито"
    onMouseEnter={openBetaTooltip}
    onMouseLeave={() => setIsBetaTooltipOpen(false)}
    onFocus={openBetaTooltip}
    onBlur={() => setIsBetaTooltipOpen(false)}
    className="absolute right-5 top-5 z-20 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-300/45 bg-blue-500 text-sm font-extrabold text-white shadow-[0_6px_16px_rgba(59,130,246,0.3)] transition hover:scale-105 hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/70 sm:right-7 sm:top-7 md:right-8 md:top-8"
  >
    !
  </button>
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
  <span className="inline-flex rounded-full border border-blue-300/30 bg-blue-400/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-blue-200">
    BETA
  </span>
  <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-white/70">
    Через API Авито
  </span>
</div>
            <h2 className="text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
              Автозагрузка
              <span className="text-[#03bd48]"> объявлений Авито</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/62">
              Ведите сотни объявлений в одной таблице: импортируйте их из Excel, Google Таблиц или Яндекс Таблиц,
              заполните общие поля и проверьте ошибки до отправки. HelpSell собирает XML-файл, подключает его к
              вашему профилю автозагрузки через API и показывает статусы из отчётов Авито.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => feedsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <Icon name="table" /> Мои таблицы
              </button>
              <button type="button" onClick={toggleGuide} aria-expanded={guideOpen} className="btn-secondary inline-flex items-center justify-center gap-2">
                <Icon name="book" /> {guideOpen ? "Скрыть инструкцию" : "Инструкция"}
              </button>
            </div>
          </div>

          {/* Схема потока данных */}
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2">
              {[
                { icon: "table", title: "Таблица", sub: "объявления" },
                { icon: "file", title: "XML", sub: "по ссылке" },
                { icon: "sparkle", title: "Авито", sub: "по расписанию" },
              ].map((node, index, list) => (
                <Fragment key={node.title}>
                  <div className="flex min-w-0 flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 px-1.5 py-3.5 text-center">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index === 2 ? "al-pulse bg-[#03bd48] text-white" : "bg-white/10 text-[#78f8a6]"}`}>
                      <Icon name={node.icon} className="h-4 w-4" />
                    </span>
                    <span className="mt-2 max-w-full break-words text-[10px] font-extrabold leading-tight sm:text-[12px]">
  {node.title}
</span>
<span className="mt-0.5 max-w-full break-words text-[8px] font-semibold leading-tight text-white/45">
  {node.sub}
</span>

                  </div>
                  {index < list.length - 1 && <div className="al-wire" />}
                </Fragment>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-[0.12em] text-white/45">
                <span>Готовность</span>
                <span className="text-[#78f8a6]">{doneCount} из {steps.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#03bd48] transition-[width] duration-700 ease-out" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
              </div>
              <div className="mt-4 grid gap-2">
                {steps.map((step) => (
                  <div key={step.label} className="flex items-center gap-2.5 text-sm font-bold">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${step.done ? "bg-[#03bd48] text-white" : "bg-white/10 text-transparent"}`}>
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                    <span className={`min-w-0 ${step.done ? "text-white" : "text-white/45"}`}>{step.label}</span>
                  </div>
                ))}
              </div>
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
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-600">{loadError}</div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* ТАБЛИЦЫ */}
        <div ref={feedsRef} className="min-w-0 scroll-mt-6 space-y-6">
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
            <ReportsCard
              reports={reports}
              error={reportsError}
              loading={reportsLoading}
              onRefresh={() => void refreshReports()}
            />
          )}
        </div>

        {/* ПОДКЛЮЧЕНИЕ И ПРОФИЛЬ */}
        <div className="min-w-0 space-y-6">
          <ConnectionCard
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

          {connected && (
            <ProfileCard
              profile={profile}
              error={profileError}
              linkedCount={(feeds ?? []).filter((feed) => feed.linked).length}
              onSaved={(next) => {
                setProfile(next);
                setProfileError("");
              }}
              onRefreshReports={() => void refreshReports()}
              toast={toast.push}
            />
          )}
        </div>
      </div>

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
    <section className="white-card p-5 md:p-8">
      <SectionTitle badge="Таблицы" title="Мои таблицы" />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="Название новой таблицы, например «Диваны, Москва»"
          className={inputClass}
          aria-label="Название таблицы"
        />
        <button type="submit" disabled={creating} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 disabled:opacity-60">
          {creating ? <Spinner /> : <Icon name="plus" />} Создать
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {feeds === null &&
          [0, 1].map((item) => <div key={item} className="al-skeleton h-28 rounded-3xl" />)}

        {feeds?.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-black/15 bg-black/[0.02] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#03bd48]/10 text-[#028c36]">
              <Icon name="table" className="h-6 w-6" />
            </div>
            <div className="mt-4 text-lg font-extrabold text-black">Создайте первую таблицу</div>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-black/50">Введите название выше и нажмите «Создать». Дальше можно импортировать объявления из Excel.</p>
          </div>
        )}

        {feeds?.map((feed, index) => (
          <div
            key={feed.id}
            style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
            className="al-pop group rounded-3xl border border-black/[0.08] bg-black/[0.02] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#03bd48]/30 hover:bg-white hover:shadow-[0_18px_38px_rgba(3,189,72,0.1)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button type="button" onClick={() => onOpen(feed.id)} className="min-w-0 text-left">
                <div className="truncate text-xl font-extrabold tracking-[-0.03em] text-black">{feed.name}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Pill tone={feed.linked ? "green" : "gray"}>{feed.linked ? "Подключена к Авито" : "Не подключена"}</Pill>
                  <span className="text-xs font-bold text-black/45">
                    {feed.adsCount} объявл. · {feed.lastFetchedAt ? `Авито забирал файл ${timeAgo(feed.lastFetchedAt)}` : "Авито ещё не забирал файл"}
                  </span>
                </div>
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => onOpen(feed.id)} className="btn-primary !px-5 !py-2.5 text-sm">
                  Открыть
                </button>
                <button
                  type="button"
                  onClick={() => void remove(feed)}
                  disabled={deletingId === feed.id}
                  aria-label={`Удалить ${feed.name}`}
                  className="rounded-xl border border-black/10 p-2.5 text-black/40 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingId === feed.id ? <Spinner /> : <Icon name="trash" />}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-black px-4 py-2.5">
              <code className="min-w-0 flex-1 truncate text-xs font-semibold text-[#78f8a6]">{feed.publicUrl}</code>
              <button
                type="button"
                onClick={async () => toast((await copyText(feed.publicUrl)) ? "Ссылка скопирована." : "Не удалось скопировать ссылку.", "ok")}
                aria-label="Копировать ссылку"
                className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <Icon name="copy" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Подключение Avito API ---------- */
function ConnectionCard({
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
    <section className="rounded-[30px] bg-black p-5 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/45">Шаг 1</div>
          <h3 className="mt-2 break-words text-xl font-extrabold tracking-[-0.04em] sm:text-2xl">Подключение Avito API</h3>
        </div>
        {account && (
          <Pill tone={connected ? "green" : "gray"} className="shrink-0">
            {connected ? "Подключено" : "Не подключено"}
          </Pill>
        )}
      </div>

      {account === null && <div className="al-skeleton mt-5 h-24 rounded-2xl opacity-20" />}

      {connected && !editing && (
        <div className="al-pop mt-5 space-y-3">
          <div className="rounded-2xl border border-[#03bd48]/30 bg-[#03bd48]/10 p-4">
            <div className="break-words text-[11px] font-extrabold uppercase leading-4 tracking-[0.1em] text-[#78f8a6]">Ключи Авито подключены</div>
            <div className="mt-1.5 break-all text-base font-extrabold sm:text-lg">Client ID: {account?.clientIdMasked}</div>
            <div className="mt-1 break-words text-sm text-white/60">Те же ключи используются в Бид-менеджере Авито — подключать их дважды не нужно.</div>
          </div>
          <div className="text-xs font-semibold text-white/45">Проверено {formatDateTime(account?.lastCheckedAt)}</div>
          {account?.lastError && (
            <div className="al-pop rounded-2xl border border-red-400/30 bg-red-500/10 p-3.5 text-sm font-bold text-red-300">{account.lastError}</div>
          )}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button type="button" onClick={() => setEditing(true)} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-extrabold transition hover:bg-white/20">
              Заменить ключи
            </button>
            <button type="button" onClick={() => void unlink()} disabled={busy} className="rounded-xl border border-red-400/30 px-4 py-2.5 text-sm font-extrabold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">
              Отключить автозагрузку
            </button>
          </div>
          <p className="text-xs leading-5 text-white/35">
            Чтобы полностью отключить ключи Авито, сделайте это в разделе «Бид-менеджер» → «Кабинет Авито».
          </p>
        </div>
      )}

      {showForm && account !== null && (
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <p className="text-sm leading-7 text-white/60">
            Ключи берутся в личном кабинете Авито: «Интеграции» → «Авито API». Подробности в{" "}
            <a href="https://www.avito.ru/developers/api-catalog" target="_blank" rel="noopener noreferrer" className="font-bold text-[#78f8a6] hover:underline">
              документации API
            </a>
            . Если Авито уже подключён в Бид-менеджере, здесь появится то же самое подключение — вводить ключи ещё раз не нужно.
          </p>
          <input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Client ID"
            autoComplete="off"
            spellCheck={false}
            aria-label="Client ID"
            className="w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-sm font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-[#03bd48]"
          />
          <input
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
            placeholder="Client Secret"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            aria-label="Client Secret"
            className="w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-sm font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-[#03bd48]"
          />
          {error && <div className="al-pop rounded-2xl border border-red-400/30 bg-red-500/10 p-3.5 text-sm font-bold text-red-300">{error}</div>}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="submit"
              disabled={busy || clientId.trim().length < 6 || clientSecret.trim().length < 6}
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Icon name="key" />} Проверить и подключить
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-extrabold transition hover:bg-white/10">
                Отмена
              </button>
            )}
          </div>
          <p className="text-xs leading-5 text-white/40">Ключи шифруются на сервере и используются только для запросов к API Авито от вашего имени.</p>
        </form>
      )}
    </section>
  );
}

function ProfileCard({
  profile,
  error,
  linkedCount,
  onSaved,
  onRefreshReports,
  toast,
}: {
  profile: ProfileDto | null;
  error: string;
  linkedCount: number;
  onSaved: (profile: ProfileDto) => void;
  onRefreshReports: () => void;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  return (
    <section className="white-card p-5 md:p-8">
      <SectionTitle badge="Шаг 3" title="Профиль автозагрузки" />

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}
      {!profile && !error && (
        <div className="space-y-3">
          <div className="al-skeleton h-12 rounded-2xl" />
          <div className="al-skeleton h-32 rounded-2xl" />
        </div>
      )}

      {profile && (
        <ProfileForm
          key={JSON.stringify([profile.exists, profile.reportEmail, profile.autoloadEnabled, profile.schedule])}
          profile={profile}
          linkedCount={linkedCount}
          onSaved={onSaved}
          onRefreshReports={onRefreshReports}
          toast={toast}
        />
      )}
    </section>
  );
}

function ProfileForm({
  profile,
  linkedCount,
  onSaved,
  onRefreshReports,
  toast,
}: {
  profile: ProfileDto;
  linkedCount: number;
  onSaved: (profile: ProfileDto) => void;
  onRefreshReports: () => void;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [email, setEmail] = useState(profile.reportEmail);
  const [enabled, setEnabled] = useState(profile.autoloadEnabled);
  const [schedule, setSchedule] = useState<ScheduleRule[]>(profile.schedule.length > 0 ? profile.schedule : [SCHEDULE_PRESETS[0].rule]);
  const [agreement, setAgreement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
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

  async function runNow() {
    if (running) return;
    setRunning(true);
    try {
      await api("/api/autoload/upload", { method: "POST" });
      toast("Выгрузка запущена. Отчёт появится в течение нескольких минут.");
      window.setTimeout(onRefreshReports, 15000);
    } catch (error) {
      toast(errorText(error), "error");
    } finally {
      setRunning(false);
    }
  }

  const updateRule = (index: number, patch: Partial<ScheduleRule>) =>
    setSchedule((rules) => rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));

  const toggleIn = (list: number[], value: number) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl border border-black/[0.08] bg-white p-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-black">Автозагрузка по расписанию</div>
          <div className="mt-0.5 text-xs leading-5 text-black/45">
            {canEnable ? "Авито сам заберёт файл в выбранное время." : "Сначала подключите хотя бы одну таблицу во вкладке «Подключение»."}
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
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-extrabold text-black/60 transition hover:border-[#03bd48]/50 hover:text-[#028c36]"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {schedule.map((rule, index) => (
            <div key={index} className="al-pop rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4">
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

              <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12">
                {Array.from({ length: 24 }, (_, hour) => (
                  <button
                    key={hour}
                    type="button"
                    aria-pressed={rule.time_slots.includes(hour)}
                    onClick={() => updateRule(index, { time_slots: toggleIn(rule.time_slots, hour) })}
                    className={`rounded-lg py-1.5 text-[11px] font-extrabold tabular-nums transition ${
                      rule.time_slots.includes(hour) ? "bg-[#03bd48] text-white" : "bg-white text-black/45 ring-1 ring-black/10 hover:ring-[#03bd48]/50"
                    }`}
                  >
                    {String(hour).padStart(2, "0")}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <label htmlFor={`rate-${index}`} className="text-xs font-extrabold text-black/55">
                  Объявлений за запуск
                </label>
                <input
                  id={`rate-${index}`}
                  type="number"
                  min={1}
                  max={1000000}
                  value={rule.rate}
                  onChange={(event) => updateRule(index, { rate: Number(event.target.value) })}
                  className={`${inputClass} !w-32 !py-2`}
                />
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setSchedule((rules) => [...rules, { rate: 1000, weekdays: [0, 1, 2, 3, 4, 5, 6], time_slots: [12] }])} className={`${ghostButton} mt-3`}>
          <Icon name="plus" /> Добавить правило
        </button>
      </div>

      {profile.feeds.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-extrabold text-black">Файлы в профиле Авито</div>
          <div className="space-y-1.5">
            {profile.feeds.map((feed) => (
              <div key={feed.url} className="flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-3.5 py-2.5">
                <Pill tone={feed.ours ? "green" : "gray"}>{feed.ours ? "HelpSell" : "Внешний"}</Pill>
                <span className="min-w-0 truncate text-sm font-bold text-black/70" title={feed.url}>{feed.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!profile.exists && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/[0.08] bg-white p-4">
          <input type="checkbox" checked={agreement} onChange={(event) => setAgreement(event.target.checked)} className="mt-1 h-4 w-4 accent-[#03bd48]" />
          <span className="text-sm leading-6 text-black/65">Принимаю условия использования Автозагрузки Авито. Профиль создаётся в вашем аккаунте Авито.</span>
        </label>
      )}

      {formError && <div className="al-pop rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{formError}</div>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (!profile.exists && !agreement)}
          className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Spinner /> : <Icon name="check" />} {profile.exists ? "Сохранить профиль" : "Создать профиль"}
        </button>
        <button type="button" onClick={() => void runNow()} disabled={running || !profile.exists || !canEnable} className={ghostButton}>
          {running ? <Spinner /> : <Icon name="play" />} Запустить сейчас
        </button>
      </div>
    </div>
  );
}

/* ---------- Отчёты ---------- */
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

function ReportsCard({
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
    <section className="white-card p-5 md:p-8">
      <SectionTitle
        badge="Отчёты"
        title="Последние выгрузки"
        right={
          <button type="button" onClick={onRefresh} disabled={loading} className={ghostButton}>
            {loading ? <Spinner /> : <Icon name="refresh" />} Обновить
          </button>
        }
      />

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}
      {!reports && !error && <div className="al-skeleton h-28 rounded-2xl" />}

      {reports && !reports.last && !reports.current && reports.uploads.length === 0 && (
        <div className="rounded-2xl bg-black/[0.03] p-6 text-center text-sm font-bold leading-6 text-black/45">
          Загрузок пока нет. Они появятся после первой выгрузки: по расписанию или по кнопке «Запустить сейчас».
        </div>
      )}

      {reports?.current && (
        <div className="al-pop mb-3 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-amber-700/70">Загрузка идёт сейчас · №{reports.current.id}</div>
            <Pill tone="amber">{STATUS_LABEL[reports.current.status] ?? reports.current.status}</Pill>
          </div>
          <div className="mt-2 text-sm text-amber-900/70">Началась {formatDateTime(reports.current.startedAt)}. Данные могут ещё меняться.</div>
        </div>
      )}

      {reports?.last && (
        <div className="al-pop rounded-3xl bg-black p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/45">Последняя завершённая загрузка №{reports.last.id}</div>
            <Pill tone={reportTone(reports.last.status)}>{STATUS_LABEL[reports.last.status] ?? reports.last.status}</Pill>
          </div>
          <div className="mt-2 text-sm text-white/60">{formatDateTime(reports.last.startedAt)}{reports.last.source ? ` · источник: ${reports.last.source}` : ""}</div>
          {reports.last.counts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {reports.last.counts.map((item) => (
                <span key={item.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold">
                  {item.label}: <b className="text-[#78f8a6]">{item.value}</b>
                </span>
              ))}
            </div>
          )}
          {reports.last.events.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {reports.last.events.map((event, index) => (
                <div key={index} className="text-xs leading-5 text-amber-300/90">⚠ {event.description}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {reports && reports.uploads.length > 0 && (
        <div className="mt-4 divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.08]">
          {reports.uploads.map((report) => (
            <div key={report.id} className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3">
              <div className="text-sm font-extrabold text-black">№{report.id}</div>
              <div className="text-xs font-semibold text-black/45">{formatDateTime(report.startedAt)}</div>
              <Pill tone={reportTone(report.status)}>{STATUS_LABEL[report.status] ?? report.status}</Pill>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
