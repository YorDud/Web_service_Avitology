"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/* =========================================================================
   Админка → «Бид-менеджеры пользователей».
   Все бидеры всех пользователей в том же оформлении, что и в кабинете, но с подписью владельца
   (имя, почта, Public ID). Кнопки: пауза / запуск, «Запустить сейчас», удаление; внутри — расширенные
   данные и история работы бидера.
   ========================================================================= */

type BidderStatus = "active" | "paused" | "attention";

type OwnerDto = { id: number; name: string; email: string; publicId: number | null; subscriptionLevel: string };

type BidderDto = {
  id: number;
  title: string;
  status: BidderStatus;
  mode: string;
  avitoItemId: string | null;
  avitoItemUrl: string | null;
  searchUrl: string | null;
  targetFrom: number;
  targetTo: number;
  currentPosition: number | null;
  positionSource: string | null;
  positionCheckedAt: string | null;
  lastPositionError: string | null;
  currentBid: number;
  minBid: number;
  maxBid: number;
  bidStep: number;
  dailySpendLimit: number;
  spentToday: number;
  checkInterval: number;
  schedule: string;
  changesToday: number;
  nextCheckAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  lastPromotionStatus: string | null;
  lastAppliedAt: string | null;
  createdAt: string;
  owner: OwnerDto;
};

type EventDto = { id: number; type: string; message: string; createdAt: string };
type Counts = { total: number; active: number; paused: number; attention: number };
type Filter = "all" | BidderStatus;

/** Слова переносятся целиком; по буквам рвётся только то, что вообще не помещается (длинная почта, ссылка). */
const WHOLE_WORDS = { overflowWrap: "break-word", wordBreak: "normal", hyphens: "manual" } as const;

async function request<T>(url: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? (init?.json ? "POST" : "GET"),
    headers: init?.json ? { "Content-Type": "application/json" } : undefined,
    body: init?.json ? JSON.stringify(init.json) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? `Ошибка ${response.status}`);
  return data as T;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatBid(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function formatPosition(bidder: BidderDto) {
  if (bidder.positionSource === "avito_serp_first_page_not_found") return "> 50";
  return typeof bidder.currentPosition === "number" ? String(bidder.currentPosition) : "—";
}

function formatNextCheck(bidder: BidderDto) {
  if (bidder.status === "paused") return "на паузе";
  if (!bidder.nextCheckAt) return "ожидает проверки";
  const diff = new Date(bidder.nextCheckAt).getTime() - Date.now();
  if (diff <= 0) return "сейчас";
  return `через ${Math.ceil(diff / 60_000)} мин`;
}

function statusView(status: BidderStatus) {
  if (status === "active") return { label: "Работает", className: "border-[#03bd48]/30 bg-[#03bd48]/10 text-[#027a30]", dot: "bg-[#03bd48]" };
  if (status === "paused") return { label: "На паузе", className: "border-black/10 bg-black/[0.045] text-black/55", dot: "bg-black/35" };
  return { label: "Требует внимания", className: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" };
}

const TIER_LABEL: Record<string, string> = { pro: "Pro", basic: "Basic", admin: "Админ", free: "Free" };

function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className={`min-h-0 overflow-hidden transition-all duration-300 ease-out ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}>{children}</div>
    </div>
  );
}

function Metric({ title, accent, children }: { title: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl p-3 ${accent ? "bg-[#03bd48]/[.07]" : "bg-black/[.025]"}`}>
      <div className="text-[9px] font-extrabold uppercase tracking-wide text-black/40">{title}</div>
      <div className="mt-1 text-sm font-extrabold text-black" style={WHOLE_WORDS}>{children}</div>
    </div>
  );
}

export default function BiddersAdminPanel() {
  const [bidders, setBidders] = useState<BidderDto[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, active: 0, paused: 0, attention: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState<string>(""); // `${id}:${action}`
  const [openAdvanced, setOpenAdvanced] = useState<number | null>(null);
  const [openHistory, setOpenHistory] = useState<number | null>(null);
  const [events, setEvents] = useState<Record<number, EventDto[]>>({});
  const [fullHistory, setFullHistory] = useState<Record<number, boolean>>({});
  const noticeTimer = useRef<number | undefined>(undefined);

  const flash = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setNotice({ text, tone });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter !== "all") params.set("status", filter);
        if (debouncedQuery) params.set("q", debouncedQuery);
        const data = await request<{ bidders: BidderDto[]; counts: Counts }>(`/api/admin/bidders?${params.toString()}`);
        setBidders(data.bidders);
        setCounts(data.counts);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить бидеры.");
      } finally {
        setLoading(false);
      }
    },
    [filter, debouncedQuery],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Тихое автообновление раз в 30 секунд, пока вкладка открыта
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const loadEvents = useCallback(
    async (id: number) => {
      try {
        const data = await request<{ events: EventDto[] }>(`/api/admin/bidders/${id}/events`);
        setEvents((current) => ({ ...current, [id]: data.events }));
      } catch (err) {
        flash(err instanceof Error ? err.message : "Не удалось загрузить историю.", "error");
      }
    },
    [flash],
  );

  async function act(bidder: BidderDto, action: "pause" | "start" | "run-now" | "delete") {
    if (action === "delete" && !window.confirm(`Удалить бидер «${bidder.title}» пользователя ${bidder.owner.name}? Это нельзя отменить.`)) return;
    if (action === "run-now" && !window.confirm("Запустить проверку этого бидера прямо сейчас? Она может занять до нескольких минут.")) return;
    setBusy(`${bidder.id}:${action}`);
    try {
      const result = await request<{ message?: string }>(`/api/admin/bidders/${bidder.id}`, { json: { action } });
      flash(result.message ?? "Готово.");
      await load(true);
      if (openHistory === bidder.id && action !== "delete") await loadEvents(bidder.id);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Не удалось выполнить действие.", "error");
    } finally {
      setBusy("");
    }
  }

  function toggleHistory(id: number) {
    const next = openHistory === id ? null : id;
    setOpenHistory(next);
    if (next !== null) void loadEvents(id);
  }

  const filters: { id: Filter; label: string; count: number }[] = useMemo(
    () => [
      { id: "all", label: "Все", count: counts.total },
      { id: "active", label: "Работают", count: counts.active },
      { id: "paused", label: "На паузе", count: counts.paused },
      { id: "attention", label: "Требуют внимания", count: counts.attention },
    ],
    [counts],
  );

  return (
    <div className="flex min-w-0 flex-col gap-5" style={WHOLE_WORDS}>
      {/* Шапка */}
      <section className="relative overflow-hidden rounded-[30px] bg-black p-5 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#03bd48]/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex rounded-full border border-[#03bd48]/30 bg-[#03bd48]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#78f8a6]">Управление</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
            Бид-менеджеры <span className="text-[#03bd48]">пользователей</span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
            Все стратегии всех пользователей: видно, чьи они, как работают и что происходило. Можно поставить на паузу, запустить, проверить сразу и посмотреть историю.
          </p>
          <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            {[
              ["Всего", counts.total, "text-white"],
              ["Работают", counts.active, "text-[#03bd48]"],
              ["На паузе", counts.paused, "text-white/70"],
              ["Требуют внимания", counts.attention, counts.attention > 0 ? "text-amber-300" : "text-white/70"],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/40">{label}</div>
                <div className={`mt-1 text-2xl font-extrabold tabular-nums ${tone}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Панель поиска и фильтров */}
      <section className="min-w-0 rounded-3xl border border-black/[.08] bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск: название, имя, почта, Public ID, ID объявления"
            className="w-full min-w-0 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#03bd48]"
            style={{ flex: "1 1 280px" }}
            aria-label="Поиск бидеров"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs font-extrabold text-black/70 transition hover:border-[#03bd48]/50 disabled:opacity-50"
          >
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр по статусу">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full border px-3.5 py-2 text-xs font-extrabold transition ${
                filter === item.id ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60 hover:border-[#03bd48]/50"
              }`}
            >
              {item.label} <span className={filter === item.id ? "text-[#03bd48]" : "text-black/35"}>{item.count}</span>
            </button>
          ))}
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.tone === "ok" ? "border-[#03bd48]/25 bg-[#03bd48]/10 text-[#027a30]" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {/* Список */}
      {loading && bidders.length === 0 ? (
        <div className="h-48 animate-pulse rounded-3xl bg-black/[.04]" />
      ) : bidders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/15 bg-black/[.02] px-5 py-14 text-center">
          <h4 className="text-xl font-extrabold">Бидеров не найдено</h4>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-black/50">Измените поиск или фильтр. Здесь появляются стратегии, которые пользователи создают в кабинете.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bidders.map((bidder) => {
            const view = statusView(bidder.status);
            const isAdvanced = openAdvanced === bidder.id;
            const isHistory = openHistory === bidder.id;
            const list = events[bidder.id] ?? [];
            const full = Boolean(fullHistory[bidder.id]);
            const label = bidder.title.trim().slice(0, 2).toUpperCase() || "АВ";
            const working = (action: string) => busy === `${bidder.id}:${action}`;
            const anyBusy = busy !== "";
            return (
              <article
                key={bidder.id}
                className="min-w-0 overflow-hidden rounded-3xl border border-black/[.08] bg-white transition duration-300 hover:border-[#03bd48]/35 hover:shadow-[0_14px_32px_rgba(16,24,40,.07)]"
              >
                {/* Владелец */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/[.06] bg-black/[.025] px-4 py-3 sm:px-5" style={{ display: "flex" }}>
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-extrabold text-[#03bd48]"
                    style={{ flex: "0 0 auto" }}
                  >
                    {(bidder.owner.name.trim().charAt(0) || "?").toUpperCase()}
                  </span>
                  <div className="min-w-0" style={{ flex: "1 1 200px" }}>
                    <div className="text-sm font-extrabold leading-5 text-black" style={WHOLE_WORDS}>
                      {bidder.owner.name}
                    </div>
                    <div className="text-xs font-semibold leading-5 text-black/50" style={WHOLE_WORDS}>
                      {bidder.owner.email}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.07em] text-white">Public ID: {bidder.owner.publicId ?? "—"}</span>
                    <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.07em] text-black/55">
                      {TIER_LABEL[bidder.owner.subscriptionLevel] ?? bidder.owner.subscriptionLevel}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#101010,#303337)] text-sm font-extrabold tracking-[.08em] text-[#03bd48]"
                      style={{ flex: "0 0 auto" }}
                    >
                      {label}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start gap-2">
                        <h4 className="min-w-0 text-lg font-extrabold leading-6 text-black" style={WHOLE_WORDS}>
                          {bidder.title}
                        </h4>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.07em] ${view.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${view.dot}`} />
                          {view.label}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${bidder.mode === "live" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                          {bidder.mode === "live" ? "LIVE" : "TEST"}
                        </span>
                      </div>

                      {bidder.avitoItemUrl && (
                        <a href={bidder.avitoItemUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-extrabold text-[#028c36] hover:text-[#03bd48]">
                          Открыть объявление на Авито ↗
                        </a>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Metric title="Целевая позиция">
                          {bidder.targetFrom}–{bidder.targetTo}
                        </Metric>
                        <Metric title="Позиция в поиске" accent>
                          <span className="text-lg text-[#028c36]">{formatPosition(bidder)}</span>{" "}
                          <span className="text-xs text-[#028c36]">{bidder.positionSource === "avito_serp_first_page_not_found" ? "мест" : "место"}</span>
                        </Metric>
                        <Metric title="Текущая CPX-ставка">{formatBid(bidder.currentBid)}</Metric>
                        <Metric title="Следующая проверка">
                          <span className="text-black/70">{formatNextCheck(bidder)}</span>
                        </Metric>
                      </div>

                      {bidder.status === "attention" && bidder.lastError && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-amber-800" style={WHOLE_WORDS}>
                          {bidder.lastError}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col">
                      <button
                        type="button"
                        disabled={anyBusy}
                        onClick={() => void act(bidder, bidder.status === "active" ? "pause" : "start")}
                        className={`rounded-xl px-3 py-2.5 text-xs font-extrabold transition disabled:opacity-50 ${
                          bidder.status === "active" ? "border border-amber-200 bg-amber-50 text-amber-700" : "bg-[#03bd48] text-white"
                        }`}
                      >
                        {working("pause") || working("start") ? "…" : bidder.status === "active" ? "Пауза" : "Запустить"}
                      </button>
                      <button
                        type="button"
                        disabled={anyBusy}
                        onClick={() => void act(bidder, "run-now")}
                        className="rounded-xl bg-black px-3 py-2.5 text-xs font-extrabold text-white transition disabled:opacity-50"
                      >
                        {working("run-now") ? "Проверяем…" : "Проверить сейчас"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Расширенные данные */}
                <div className="border-t border-black/[.06] bg-black/[.018]">
                  <button
                    type="button"
                    onClick={() => setOpenAdvanced(isAdvanced ? null : bidder.id)}
                    aria-expanded={isAdvanced}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold text-black">Расширенные данные и настройки</span>
                      <span className="mt-1 block text-xs font-semibold text-black/45">Лимиты, расписание, технические данные и удаление</span>
                    </span>
                    <span className={`shrink-0 text-xl transition-transform duration-300 ${isAdvanced ? "rotate-180" : ""}`}>⌄</span>
                  </button>
                  <Collapsible open={isAdvanced}>
                    <div className="border-t border-black/[.06] p-4 sm:p-5">
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric title="Диапазон ставки">
                          {formatBid(bidder.minBid)} – {formatBid(bidder.maxBid)} (шаг {formatBid(bidder.bidStep)})
                        </Metric>
                        <Metric title="Расход сегодня">
                          {formatBid(bidder.spentToday)}
                          {bidder.dailySpendLimit > 0 ? ` из ${formatBid(bidder.dailySpendLimit)}` : ""}
                        </Metric>
                        <Metric title="Изменений ставки сегодня" accent>
                          {bidder.changesToday}
                        </Metric>
                        <Metric title="Интервал проверки">каждые {bidder.checkInterval} мин</Metric>
                        <Metric title="Расписание">{bidder.schedule}</Metric>
                        <Metric title="Последняя проверка">{formatDateTime(bidder.lastCheckedAt)}</Metric>
                        <Metric title="Позиция проверена">{formatDateTime(bidder.positionCheckedAt)}</Metric>
                        <Metric title="Последнее применение">{formatDateTime(bidder.lastAppliedAt)}</Metric>
                        <Metric title="ID объявления">{bidder.avitoItemId ?? "—"}</Metric>
                        <Metric title="Статус CPX">{bidder.lastPromotionStatus ?? "нет данных"}</Metric>
                        <Metric title="Создан">{formatDateTime(bidder.createdAt)}</Metric>
                      </div>
                      {(bidder.lastPositionError || (bidder.status !== "attention" && bidder.lastError)) && (
                        <div className="mt-3 rounded-xl bg-black/[.04] px-3.5 py-2.5 text-xs font-semibold leading-5 text-black/65" style={WHOLE_WORDS}>
                          {bidder.lastPositionError ? `Выдача: ${bidder.lastPositionError}` : null}
                          {bidder.lastPositionError && bidder.lastError ? <br /> : null}
                          {bidder.lastError && bidder.status !== "attention" ? `Последняя ошибка: ${bidder.lastError}` : null}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-black/[.06] pt-4">
                        {bidder.searchUrl && (
                          <a href={bidder.searchUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-extrabold text-black/70">
                            Открыть поиск на Авито ↗
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={anyBusy}
                          onClick={() => void act(bidder, "delete")}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-extrabold text-red-600 transition disabled:opacity-50"
                        >
                          {working("delete") ? "Удаляем…" : "Удалить"}
                        </button>
                      </div>
                    </div>
                  </Collapsible>
                </div>

                {/* История */}
                <div className="border-t border-black/[.06]">
                  <button type="button" onClick={() => toggleHistory(bidder.id)} aria-expanded={isHistory} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5">
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold">История работы</span>
                      <span className="mt-1 block text-xs font-semibold text-black/45">Проверки, решения и сообщения системы</span>
                    </span>
                    <span className={`shrink-0 text-xl transition-transform duration-300 ${isHistory ? "rotate-180" : ""}`}>⌄</span>
                  </button>
                  <Collapsible open={isHistory}>
                    <div className="border-t border-black/[.06] bg-black/[.018] p-4 sm:p-5">
                      <div className="flex justify-end">
                        <button type="button" onClick={() => void loadEvents(bidder.id)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-extrabold">
                          Обновить
                        </button>
                      </div>
                      <div className={`mt-3 space-y-2 overflow-y-auto pr-1 ${full ? "max-h-none" : "max-h-80"}`}>
                        {list.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-sm text-black/50">История пока пуста.</div>
                        ) : (
                          list.map((event) => (
                            <div key={event.id} className="rounded-xl border border-black/[.07] bg-white p-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                                <div className="min-w-0 flex-1 text-sm font-bold leading-5 text-black" style={WHOLE_WORDS}>
                                  {event.message}
                                </div>
                                <div className="shrink-0 text-[11px] font-semibold text-black/40">{formatDateTime(event.createdAt)}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {list.length > 0 && (
                        <button type="button" onClick={() => setFullHistory((current) => ({ ...current, [bidder.id]: !full }))} className="mt-3 text-xs font-extrabold text-[#028c36]">
                          {full ? "Свернуть историю" : "Раскрыть всю историю"}
                        </button>
                      )}
                    </div>
                  </Collapsible>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
