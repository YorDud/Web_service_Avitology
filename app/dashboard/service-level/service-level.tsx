"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ORDER_STATUS_LABEL,
  computeOrderTotals,
  formatRub,
  parseLinks,
  pluralRu,
  userItemState,
  type OrderStatus,
} from "@/lib/service-level/constants";
import {
  AutoloadStyles,
  Icon,
  Pill,
  Spinner,
  api,
  errorText,
  formatDateTime,
  ghostButton,
  inputClass,
  useToast,
} from "../autoload/ui";

/* =========================================================================
   Услуга «Уровень сервиса»: заказ живых действий на объявлениях Авито
   (актуальность и наличие товара, достоверность цены, ответы в чатах и др.).
   Вкладки: «Заказать» → «Мои заказы» → «Инструкция».
   ========================================================================= */

type ServiceDto = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  guide: string;
  emoji: string;
  pricePerUnit: number;
  minQuantity: number;
  maxQuantity: number;
};

type OrderDto = {
  id: number;
  number: number;
  service: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  quantityPerLink: number;
  linksCount: number;
  totalQuantity: number;
  amount: number;
  doneTotal: number | null;
  items: { position: number; url: string; quantity: number; stage: string; doneCount: number | null }[];
};

type Overview = {
  allowed: boolean;
  settings: { isEnabled: boolean; minTier: string; maxLinksPerOrder: number; etaText: string; guideIntro: string };
  services: ServiceDto[];
  orders: OrderDto[];
};

type Tab = "order" | "orders" | "guide";

const STATUS_TONE: Record<string, "amber" | "green" | "gray" | "red"> = {
  in_progress: "amber",
  completed: "green",
  cancelled: "gray",
  awaiting_payment: "gray",
};

const COMMISSION_FREE_TIER_TEXT: Record<string, string> = { basic: "Basic", pro: "Pro" };

function shortUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    const text = `${parsed.hostname.replace(/^www\./, "")}/${path}`;
    return text.length > 64 ? `${text.slice(0, 61)}…` : text;
  } catch {
    return url.length > 64 ? `${url.slice(0, 61)}…` : url;
  }
}

/**
 * Слова переносятся целиком: строка переносится по пробелам, а разрывать слово по буквам можно
 * только если оно вообще не помещается в строку (очень длинная ссылка). Свойства наследуются
 * всеми вложенными блоками.
 */
const WRAP_WHOLE_WORDS = { overflowWrap: "break-word", wordBreak: "normal", hyphens: "manual" } as const;

export default function ServiceLevelService() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("order");

  // форма заказа
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [linksText, setLinksText] = useState("");
  const [quantity, setQuantity] = useState<number>(15);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [openOrder, setOpenOrder] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await api<Overview>("/api/service-level");
      setData(next);
      setLoadError("");
      return next;
    } catch (error) {
      setLoadError(errorText(error));
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const requested = new URLSearchParams(window.location.search).get("tab");
      if (requested === "orders" || requested === "guide") setTab(requested);
    } catch {
      /* ignore */
    }
  }, [load]);

  // выбранная услуга по умолчанию — первая; количество подтягивается к её минимуму
  const selected = useMemo(() => data?.services.find((service) => service.id === serviceId) ?? data?.services[0] ?? null, [data, serviceId]);
  useEffect(() => {
    if (data && serviceId === null && data.services[0]) {
      setServiceId(data.services[0].id);
      setQuantity(data.services[0].minQuantity);
    }
  }, [data, serviceId]);

  const inProgress = data?.orders.filter((order) => order.status === "in_progress").length ?? 0;

  // Пока есть заказы в работе — тихо обновляем статусы (реже при ошибках, не при свёрнутой вкладке).
  useEffect(() => {
    if (!inProgress) return;
    let alive = true;
    let timer: number | undefined;
    let delay = 60_000;
    const schedule = () => {
      if (alive) timer = window.setTimeout(tick, delay);
    };
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === "hidden") return schedule();
      const result = await load();
      delay = result ? 60_000 : Math.min(delay * 2, 8 * 60_000);
      schedule();
    };
    schedule();
    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [inProgress, load]);

  const parsed = useMemo(() => parseLinks(linksText), [linksText]);
  const totals = useMemo(() => {
    if (!selected || !data) return null;
    return computeOrderTotals({
      pricePerUnit: selected.pricePerUnit,
      reward: 0,
      commissionPercent: 0,
      linksCount: parsed.valid.length,
      quantityPerLink: quantity,
    });
  }, [selected, data, parsed.valid.length, quantity]);

  const maxLinks = data?.settings.maxLinksPerOrder ?? 20;
  const quantityValid = selected ? Number.isInteger(quantity) && quantity >= selected.minQuantity && quantity <= selected.maxQuantity : false;
  const canSubmit =
    Boolean(data?.allowed && data.settings.isEnabled && selected) &&
    parsed.valid.length > 0 &&
    parsed.valid.length <= maxLinks &&
    parsed.invalid.length === 0 &&
    quantityValid &&
    !submitting;

  async function submit() {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setFormError("");
    try {
      const result = await api<{ redirectUrl: string | null }>("/api/service-level/checkout", {
        json: { serviceId: selected.id, links: linksText, quantity },
      });
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        window.setTimeout(() => setSubmitting(false), 8000);
        return;
      }
      toast.push("Заказ оформлен и передан в работу.");
      setLinksText("");
      await load();
      setTab("orders");
      setSubmitting(false);
    } catch (error) {
      setFormError(errorText(error));
      setSubmitting(false);
    }
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "order", label: "Заказать" },
    { id: "orders", label: "Мои заказы", badge: inProgress || undefined },
    { id: "guide", label: "Инструкция" },
  ];

  /* ---------- Рендер ---------- */
  return (
    <div className="flex min-w-0 flex-col" style={WRAP_WHOLE_WORDS}>
      <AutoloadStyles />

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[28px] bg-black p-5 text-white shadow-[0_20px_55px_rgba(16,24,40,0.18)] sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#03bd48]/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex rounded-full border border-[#03bd48]/30 bg-[#03bd48]/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#78f8a6]">
              Живые действия на ваших объявлениях
            </div>
            <h2 className="text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
              Уровень<span className="text-[#03bd48]"> сервиса</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
              Реальные люди заходят в ваши объявления на Авито, интересуются актуальностью и ценой и общаются с вами в чатах — так объявления выглядят живыми и востребованными.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button type="button" onClick={() => setTab("order")} className="btn-primary inline-flex items-center gap-2 !px-5 !py-3 text-sm">
                <Icon name="plus" /> Сделать заказ
              </button>
              <button type="button" onClick={() => setTab("guide")} className="btn-secondary inline-flex items-center gap-2 !px-5 !py-3 text-sm">
                <Icon name="book" /> Как это работает
              </button>
            </div>
          </div>

          <ol className="relative grid gap-2">
            {[
              ["1", "Выберите услугу", "актуальность, цена или чаты"],
              ["2", "Вставьте ссылки", "на ваши объявления Авито"],
              ["3", "Оплатите", "стоимость посчитаем сами"],
              ["4", "Следите за ходом", "статус обновляется автоматически"],
            ].map(([number, title, text]) => (
              <li
                key={number}
                className="flex items-start rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-3"
                style={{ display: "flex", gap: 12 }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#03bd48] text-sm font-extrabold text-white">{number}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="block text-sm font-extrabold leading-5">{title}</span>
                  <span className="block text-xs font-semibold leading-5 text-white/45">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Вкладки */}
      <div role="tablist" className="mt-5 flex gap-1 rounded-2xl bg-black/[0.05] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-all duration-300 ${
              tab === item.id ? "bg-black text-white shadow-[0_8px_18px_rgba(16,24,40,0.18)]" : "text-black/55 hover:bg-white hover:text-black"
            }`}
          >
            <span className="truncate">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-[#03bd48] px-2 py-0.5 text-[10px] font-extrabold text-white">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      {loadError && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{loadError}</div>}
      {!data && !loadError && <div className="al-skeleton mt-5 h-64 rounded-3xl" />}

      {data && !data.allowed && (
        <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3" style={{ gap: 12 }}>
            <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-amber-900">Услуга доступна с тарифа {COMMISSION_FREE_TIER_TEXT[data.settings.minTier] ?? data.settings.minTier}</div>
              <p className="mt-1 text-sm leading-6 text-amber-900/80">Оформите подписку, чтобы заказывать действия на объявлениях.</p>
              <a href="/pricing" className="btn-primary mt-3 inline-flex !px-5 !py-2.5 text-sm">
                Выбрать тариф
              </a>
            </div>
          </div>
        </div>
      )}

      {data && data.allowed && !data.settings.isEnabled && (
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5" style={{ gap: 12 }}>
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 text-sm font-bold leading-6 text-amber-900">
            Приём новых заказов временно закрыт — мы настраиваем услугу. Ваши прежние заказы продолжают выполняться, а инструкцию можно прочитать уже сейчас.
          </div>
        </div>
      )}

      {data && tab === "order" && (
        <OrderTab
          data={data}
          selected={selected}
          onSelect={(service) => {
            setServiceId(service.id);
            setQuantity((current) => Math.min(Math.max(current, service.minQuantity), service.maxQuantity));
          }}
          linksText={linksText}
          onLinks={setLinksText}
          parsed={parsed}
          maxLinks={maxLinks}
          quantity={quantity}
          onQuantity={setQuantity}
          quantityValid={quantityValid}
          totals={totals}
          canSubmit={canSubmit}
          submitting={submitting}
          formError={formError}
          onSubmit={() => void submit()}
        />
      )}

      {data && tab === "orders" && (
        <OrdersTab orders={data.orders} openOrder={openOrder} onToggle={(id) => setOpenOrder((current) => (current === id ? null : id))} onCreate={() => setTab("order")} onRefresh={load} />
      )}

      {data && tab === "guide" && <GuideTab data={data} />}

      {toast.node}
    </div>
  );
}

/* ---------- Вкладка «Заказать» ---------- */
function OrderTab({
  data,
  selected,
  onSelect,
  linksText,
  onLinks,
  parsed,
  maxLinks,
  quantity,
  onQuantity,
  quantityValid,
  totals,
  canSubmit,
  submitting,
  formError,
  onSubmit,
}: {
  data: Overview;
  selected: ServiceDto | null;
  onSelect: (service: ServiceDto) => void;
  linksText: string;
  onLinks: (value: string) => void;
  parsed: ReturnType<typeof parseLinks>;
  maxLinks: number;
  quantity: number;
  onQuantity: (value: number) => void;
  quantityValid: boolean;
  totals: ReturnType<typeof computeOrderTotals> | null;
  canSubmit: boolean;
  submitting: boolean;
  formError: string;
  onSubmit: () => void;
}) {
  if (data.services.length === 0) {
    return <div className="mt-5 rounded-3xl bg-black/[0.03] p-8 text-center text-sm font-bold text-black/45">Услуги пока не добавлены.</div>;
  }
  const disabled = !data.allowed || !data.settings.isEnabled;
  const presets = selected ? [selected.minQuantity, selected.minQuantity * 2, selected.minQuantity * 4, selected.minQuantity * 10].filter((value) => value <= selected.maxQuantity) : [];
  const tooMany = parsed.valid.length > maxLinks;

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="min-w-0 space-y-5">
        {/* Шаг 1 */}
        <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-5">
          <StepTitle number="1" title="Что нужно" hint="Выберите услугу" />
          <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
            {data.services.map((service) => {
              const active = selected?.id === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onSelect(service)}
                  aria-pressed={active}
                  className={`flex min-w-0 flex-col rounded-2xl border p-4 text-left transition ${
                    active ? "border-[#03bd48] bg-[#03bd48]/[0.07] shadow-[0_10px_24px_rgba(3,189,72,0.12)]" : "border-black/10 bg-white hover:border-[#03bd48]/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl leading-none" style={{ flex: "0 0 auto" }}>{service.emoji}</span>
                    <span style={{ flex: "0 0 auto", width: 20, height: 20 }} className={`flex shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[#03bd48] bg-[#03bd48] text-white" : "border-black/20"}`}>
                      {active && <Icon name="check" className="h-3 w-3" />}
                    </span>
                  </div>
                  <div className="mt-2.5 text-sm font-extrabold leading-5 text-black" style={{ minWidth: 0, ...WRAP_WHOLE_WORDS }}>{service.title}</div>
                  {service.summary && <p className="mt-1 text-xs leading-5 text-black/50">{service.summary}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-extrabold">
                    <span className="text-[#028c36]">{formatRub(service.pricePerUnit)} за 1 действие</span>
                    <span className="text-black/35">· от {service.minQuantity} шт. на ссылку</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Шаг 2 */}
        <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-5">
          <StepTitle number="2" title="Ссылки на объявления" hint={`Не больше ${maxLinks} в одном заказе`} />
          <textarea
            value={linksText}
            onChange={(event) => onLinks(event.target.value)}
            rows={6}
            disabled={disabled}
            spellCheck={false}
            placeholder={"https://www.avito.ru/moskva/telefony/iphone_15_pro_1234567890\nhttps://www.avito.ru/moskva/..."}
            className={`${inputClass} mt-4 resize-y font-mono !text-[12px] leading-6`}
            aria-label="Ссылки на объявления Авито"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={parsed.valid.length > 0 && !tooMany ? "green" : "gray"}>
              <Icon name="link" className="h-3 w-3" /> Ссылок: {parsed.valid.length}
            </Pill>
            {parsed.duplicates > 0 && <Pill tone="gray">Повторы убраны: {parsed.duplicates}</Pill>}
            {parsed.invalid.length > 0 && (
              <Pill tone="red">
                <Icon name="warning" className="h-3 w-3" /> С ошибкой: {parsed.invalid.length}
              </Pill>
            )}
            {tooMany && <Pill tone="red">Максимум {maxLinks}</Pill>}
          </div>
          {parsed.invalid.length > 0 && (
            <ul className="al-pop mt-3 space-y-1.5 rounded-2xl bg-red-50 p-3.5">
              {parsed.invalid.slice(0, 5).map((item, index) => (
                <li key={`${item.raw}-${index}`} className="min-w-0 text-xs font-bold leading-5 text-red-700">
                  <span className="break-all">«{item.raw}»</span> — {item.reason.toLowerCase()}
                </li>
              ))}
              {parsed.invalid.length > 5 && <li className="text-xs font-bold text-red-700/70">…и ещё {parsed.invalid.length - 5}</li>}
            </ul>
          )}
          <p className="mt-3 text-xs leading-5 text-black/45">
            Вставьте ссылки по одной на строку. Подходят только публичные объявления на avito.ru. Скопируйте адрес объявления из браузера или кнопкой «Поделиться» в приложении.
          </p>
        </section>

        {/* Шаг 3 */}
        <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-5">
          <StepTitle number="3" title="Количество" hint="Действий на каждое объявление" />
          {selected && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  <button
                    type="button"
                    disabled={disabled || quantity <= selected.minQuantity}
                    onClick={() => onQuantity(Math.max(selected.minQuantity, quantity - 5))}
                    aria-label="Меньше"
                    style={{ width: 44, height: 44, flex: "0 0 44px" }}
                    className="flex items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:border-[#03bd48]/50 disabled:opacity-40"
                  >
                    <Icon name="minus" />
                  </button>
                  <div style={{ width: 96, flex: "0 0 96px" }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={selected.minQuantity}
                      max={selected.maxQuantity}
                      value={Number.isFinite(quantity) ? quantity : ""}
                      onChange={(event) => onQuantity(Math.round(Number(event.target.value)))}
                      disabled={disabled}
                      aria-label="Количество действий на объявление"
                      style={quantityValid ? undefined : { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }}
                      className={`${inputClass} text-center text-lg font-extrabold tabular-nums`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={disabled || quantity >= selected.maxQuantity}
                    onClick={() => onQuantity(Math.min(selected.maxQuantity, quantity + 5))}
                    aria-label="Больше"
                    style={{ width: 44, height: 44, flex: "0 0 44px" }}
                    className="flex items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:border-[#03bd48]/50 disabled:opacity-40"
                  >
                    <Icon name="plus" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => onQuantity(value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${
                        quantity === value ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60 hover:border-[#03bd48]/50"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <p className={`mt-3 text-xs leading-5 ${quantityValid ? "text-black/45" : "font-bold text-red-600"}`}>
                От {selected.minQuantity} до {selected.maxQuantity} на одно объявление.
              </p>
            </>
          )}
        </section>
      </div>

      {/* Итог */}
      <aside className="min-w-0 xl:sticky xl:top-5">
        <div className="overflow-hidden rounded-3xl bg-black p-5 text-white shadow-[0_20px_50px_rgba(16,24,40,0.2)]">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">Ваш заказ</div>
          <div className="mt-2 flex items-start gap-2.5" style={{ gap: 10 }}>
            <span className="text-2xl leading-none">{selected?.emoji}</span>
            <div className="min-w-0 text-sm font-extrabold leading-5">{selected?.title ?? "—"}</div>
          </div>

          <dl className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/55">Объявлений</dt>
              <dd className="font-extrabold tabular-nums">{parsed.valid.length}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/55">На каждое</dt>
              <dd className="font-extrabold tabular-nums">{Number.isFinite(quantity) ? quantity : 0}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/55">Всего действий</dt>
              <dd className="font-extrabold tabular-nums">{totals?.totalQuantity ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/55">Цена за действие</dt>
              <dd className="font-extrabold tabular-nums">{selected ? formatRub(selected.pricePerUnit) : "—"}</dd>
            </div>
          </dl>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
            <span className="text-sm font-bold text-white/55">К оплате</span>
            <span className="text-3xl font-extrabold tracking-[-0.04em] text-[#03bd48] tabular-nums">{formatRub(totals && parsed.valid.length > 0 ? totals.price : 0)}</span>
          </div>

          {formError && <div className="al-pop mt-4 rounded-2xl border border-red-300/40 bg-red-500/15 p-3 text-xs font-bold leading-5 text-red-200">{formError}</div>}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 !py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Spinner /> : <Icon name="card" />} Оплатить
          </button>
          <p className="mt-3 text-[11px] leading-5 text-white/40">
            Оплата через ЮKassa. Заказ создаётся и запускается только после подтверждения оплаты. Срок выполнения — {data.settings.etaText}.
          </p>
        </div>
      </aside>
    </div>
  );
}

function StepTitle({ number, title, hint }: { number: string; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3" style={{ gap: 12 }}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-extrabold text-white">{number}</span>
      <div className="min-w-0">
        <h3 className="truncate text-base font-extrabold tracking-[-0.02em] text-black">{title}</h3>
        <p className="truncate text-xs font-semibold text-black/45">{hint}</p>
      </div>
    </div>
  );
}

/* ---------- Вкладка «Мои заказы» ---------- */
function OrdersTab({
  orders,
  openOrder,
  onToggle,
  onCreate,
  onRefresh,
}: {
  orders: OrderDto[];
  openOrder: number | null;
  onToggle: (id: number) => void;
  onCreate: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  if (orders.length === 0) {
    return (
      <div className="mt-5 rounded-3xl border-2 border-dashed border-black/15 bg-black/[0.02] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#03bd48]/10 text-[#028c36]">
          <Icon name="table" className="h-6 w-6" />
        </div>
        <div className="mt-3 text-lg font-extrabold text-black">Заказов пока нет</div>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-black/50">Оформите первый заказ — он появится здесь, и вы сможете следить за его выполнением.</p>
        <button type="button" onClick={onCreate} className="btn-primary mt-4 inline-flex items-center gap-2 !px-5 !py-2.5 text-sm">
          <Icon name="plus" /> Сделать заказ
        </button>
      </div>
    );
  }

  return (
    <section className="mt-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-black/50">
          Заказов: {orders.length} · в работе: {orders.filter((order) => order.status === "in_progress").length}
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
          }}
          className={`${ghostButton} !px-3 !py-2`}
        >
          {refreshing ? <Spinner /> : <Icon name="refresh" />} Обновить
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {orders.map((order) => {
          const open = openOrder === order.id;
          const status = order.status as OrderStatus;
          const percent = order.doneTotal !== null && order.totalQuantity > 0 ? Math.min(100, Math.round((order.doneTotal / order.totalQuantity) * 100)) : null;
          return (
            <article key={order.id} className="min-w-0 overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)]">
              <button type="button" onClick={() => onToggle(order.id)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-black/[0.015] sm:p-5" style={{ gap: 12 }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-sm font-extrabold text-[#03bd48]">№{order.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-black">{order.service}</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-black/45">
                    {formatDateTime(order.paidAt ?? order.createdAt)} · {order.linksCount} {pluralRu(order.linksCount, "ссылка", "ссылки", "ссылок")} × {order.quantityPerLink} · {formatRub(order.amount)}
                  </span>
                </span>
                <Pill tone={STATUS_TONE[order.status] ?? "gray"} className="shrink-0">
                  {ORDER_STATUS_LABEL[status] ?? order.status}
                </Pill>
                <Icon name="chevron" className={`h-4 w-4 shrink-0 text-black/40 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {order.status === "in_progress" && (
                <div className="px-4 pb-4 sm:px-5">
                  <div className="flex items-center justify-between gap-3 text-xs font-bold text-black/50">
                    <span>{percent !== null ? `Выполнено ${order.doneTotal} из ${order.totalQuantity}` : "Заявка в работе — исполнители выполняют задания"}</span>
                    {percent !== null && <span className="tabular-nums text-black">{percent}%</span>}
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.07]">
                    <div
                      className={`h-full rounded-full bg-[#03bd48] transition-[width] duration-700 ${percent === null ? "al-pulse w-1/3" : ""}`}
                      style={percent !== null ? { width: `${Math.max(percent, 3)}%` } : undefined}
                    />
                  </div>
                </div>
              )}

              {open && (
                <div className="al-pop border-t border-black/[0.06] bg-black/[0.015] p-4 sm:p-5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MiniStat label="Всего действий" value={String(order.totalQuantity)} />
                    <MiniStat label="Оплачено" value={formatRub(order.amount)} />
                    <MiniStat label={order.completedAt ? "Выполнен" : "Запущен"} value={formatDateTime(order.completedAt ?? order.paidAt ?? order.createdAt)} />
                  </div>
                  <ul className="mt-3 divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
                    {order.items.map((item) => {
                      const state = order.status === "completed" ? { label: "Выполнено", tone: "green" as const } : order.status === "cancelled" ? { label: "Отменено", tone: "gray" as const } : userItemState(item.stage);
                      return (
                        <li key={item.position} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-[11px] font-extrabold text-black/55">{item.position}</span>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 basis-48 truncate text-sm font-bold text-[#028c36] hover:underline" title={item.url}>
                            {shortUrl(item.url)}
                          </a>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-black/45">
                            {item.doneCount !== null ? `${item.doneCount} / ${item.quantity}` : `${item.quantity} шт.`}
                          </span>
                          <Pill tone={state.tone} className="shrink-0">
                            {state.label}
                          </Pill>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-black/[0.06]">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">{label}</div>
      <div className="mt-1 truncate text-sm font-extrabold text-black">{value}</div>
    </div>
  );
}

/* ---------- Вкладка «Инструкция» ---------- */
function GuideTab({ data }: { data: Overview }) {
  const withGuide = data.services.filter((service) => service.guide.trim());
  const sample = data.services[0];

  const steps = [
    { title: "Выберите услугу", text: "Определите, что хотите усилить: актуальность и наличие товара, достоверность цены или ответы в чатах." },
    { title: "Вставьте ссылки", text: `Добавьте ссылки на ваши публичные объявления Авито — по одной на строку (до ${data.settings.maxLinksPerOrder} за заказ). Повторы мы уберём сами.` },
    { title: "Укажите количество", text: "Сколько действий нужно на каждое объявление. Стоимость считается автоматически и видна справа до оплаты." },
    { title: "Оплатите заказ", text: "Оплата — через ЮKassa. Заказ появляется и уходит в работу только после подтверждённой оплаты." },
    { title: "Следите за ходом", text: "Во вкладке «Мои заказы» виден статус и прогресс. Когда исполнители выполнят всё, а мы проверим результат, заказ станет «Выполнен»." },
  ];

  const faq = [
    ["Что значит статус «В работе»?", "Заказ оплачен, задания переданы исполнителям и выполняются. Статус обновляется автоматически — страницу можно не перезагружать."],
    ["Как быстро выполняется заказ?", `Обычно ${data.settings.etaText}. Срок зависит от количества действий и загруженности исполнителей.`],
    ["Можно ли заказать ту же ссылку ещё раз?", "Да. Но каждый исполнитель может написать в объявление только один раз, поэтому большие повторные заказы на одно и то же объявление выполняются дольше."],
    ["Нужно ли мне что-то делать во время выполнения?", "Отвечайте на сообщения в Авито как обычному покупателю — так результат будет максимально естественным."],
    ["Что делать, если заказ долго «в работе»?", "Напишите в поддержку и укажите номер заказа — мы проверим, на каком этапе он находится."],
  ];

  return (
    <div className="mt-5 space-y-5">
      {data.settings.guideIntro.trim() && (
        <section className="rounded-3xl border border-[#03bd48]/25 bg-[linear-gradient(135deg,rgba(3,189,72,0.09),rgba(255,255,255,1)_60%)] p-5 sm:p-6">
          <p className="whitespace-pre-line text-sm leading-7 text-black/70">{data.settings.guideIntro}</p>
        </section>
      )}

      <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
        <div className="badge-green mb-3">Пошагово</div>
        <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">Как сделать заказ</h3>
        <div className="mt-5 space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl bg-black/[0.025] p-4"
              style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", columnGap: 14, alignItems: "start" }}
            >
              <span className="flex items-center justify-center rounded-xl bg-black text-sm font-extrabold text-[#03bd48]" style={{ width: 36, height: 36 }}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-black">{step.title}</div>
                <p className="mt-0.5 text-sm leading-6 text-black/55">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {withGuide.length > 0 && (
        <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
          <div className="badge-green mb-3">Услуги</div>
          <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">Что входит в каждую услугу</h3>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {withGuide.map((service) => (
              <article key={service.id} className="min-w-0 rounded-2xl border border-black/[0.08] p-4 sm:p-5">
                <div className="flex items-start gap-3" style={{ gap: 12 }}>
                  <span className="text-2xl leading-none">{service.emoji}</span>
                  <div className="min-w-0">
                    <h4 className="text-base font-extrabold leading-5 text-black">{service.title}</h4>
                    <div className="mt-1 text-xs font-extrabold text-[#028c36]">
                      {formatRub(service.pricePerUnit)} за действие · от {service.minQuantity} шт. на ссылку
                    </div>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-black/60">{service.guide}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
          <div className="badge-green mb-3">Важно</div>
          <h3 className="text-xl font-extrabold tracking-[-0.03em] text-black">Правила и ограничения</h3>
          <ul className="mt-4 space-y-2.5 text-sm leading-6 text-black/60">
            {[
              "Подходят только публичные объявления на avito.ru. Архивные, закрытые и удалённые объявления выполнить нельзя.",
              `В одном заказе — до ${data.settings.maxLinksPerOrder} ссылок. Количество действий на каждое объявление указывается одно для всего заказа.`,
              sample ? `Минимальный заказ — от ${Math.min(...data.services.map((service) => service.minQuantity))} действий на объявление.` : "",
              "Один исполнитель пишет в одно объявление один раз — если он уже писал туда, повторно задание ему недоступно.",
              "Деньги за заказ списываются сразу при оплате. Если по заказу возникнет проблема — напишите в поддержку с номером заказа.",
            ]
              .filter(Boolean)
              .map((text) => (
                <li key={text} className="flex gap-2.5" style={{ gap: 10 }}>
                  <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-[#03bd48]" />
                  <span className="min-w-0">{text}</span>
                </li>
              ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
          <div className="badge-green mb-3">Статусы</div>
          <h3 className="text-xl font-extrabold tracking-[-0.03em] text-black">Что означает статус заказа</h3>
          <dl className="mt-4 space-y-3">
            {[
              ["amber", "В работе", "Заказ оплачен и выполняется. Видно прогресс по ссылкам."],
              ["green", "Выполнен", "Все действия выполнены и проверены."],
              ["gray", "Отменён", "Заказ отменён. По вопросам возврата напишите в поддержку."],
            ].map(([tone, label, text]) => (
              <div key={label} className="flex min-w-0 items-start gap-3" style={{ gap: 12 }}>
                <Pill tone={tone as "amber" | "green" | "gray"} className="mt-0.5 shrink-0">
                  {label}
                </Pill>
                <dd className="min-w-0 text-sm leading-6 text-black/60">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
        <div className="badge-green mb-3">Вопросы и ответы</div>
        <h3 className="text-2xl font-extrabold tracking-[-0.04em] text-black">Частые вопросы</h3>
        <div className="mt-4 divide-y divide-black/[0.07] overflow-hidden rounded-2xl border border-black/[0.08]">
          {faq.map(([question, answer]) => (
            <details key={question} className="group bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-extrabold text-black [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">{question}</span>
                <Icon name="chevron" className="h-4 w-4 shrink-0 text-black/40 transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-4 pb-4 text-sm leading-6 text-black/60">{answer}</p>
            </details>
          ))}
        </div>
        <a href="/support" className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#028c36] hover:underline">
          Написать в поддержку <Icon name="link" className="h-3.5 w-3.5" />
        </a>
      </section>
    </div>
  );
}
