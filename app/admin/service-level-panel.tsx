"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ITEM_STAGE_LABEL,
  MIN_TIERS,
  ORDER_STATUS_LABEL,
  TIER_LABEL,
  formatRub,
  pluralRu,
  type MinTier,
  type OrderStatus,
} from "@/lib/service-level/constants";
import { DEFAULT_CREATE_TEMPLATE, DEFAULT_PAY_TEMPLATE, EXECUTION_TIME_OPTIONS } from "@/lib/service-level/defaults";
import { Icon, Modal, Pill, Spinner, Toggle, api, errorText, formatDateTime, ghostButton, inputClass, useToast } from "../dashboard/autoload/ui";

/* =========================================================================
   Админка «Уровня сервиса»: услуги (цены, тексты, шаблон задания SocPublic),
   заказы пользователей с расчётом прибыли и действиями, настройки интеграции.
   ========================================================================= */

type ServiceRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  guide: string;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
  pricePerUnit: number;
  minQuantity: number;
  maxQuantity: number;
  taskTitle: string;
  numberSingleLink: boolean;
  taskDescription: string;
  confirmInfo: string;
  reward: number;
  executionMinutes: number;
  payloadTemplate: string;
  ordersCount: number;
};

type Settings = {
  isEnabled: boolean;
  minTier: MinTier;
  commissionPercent: number;
  maxLinksPerOrder: number;
  successCodes: string;
  payTemplate: string;
  keyRemaining: string;
  keyReady: string;
  keyStarted: string;
  keyRework: string;
  keyTotal: string;
  keyPaid: string;
  etaText: string;
  guideIntro: string;
};

type AdminItem = {
  id: number;
  position: number;
  url: string;
  quantity: number;
  socQuantity: number;
  taskName: string;
  stage: string;
  errorStage: string | null;
  socTaskId: string | null;
  fundedAmount: number | null;
  doneCount: number | null;
  error: string | null;
  rawLast: string | null;
  retryAfter: string | null;
};

type AdminOrder = {
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
  userId: number;
  userName: string;
  publicId: number | null;
  email: string;
  paid: number;
  socCost: number;
  profit: number;
  attention: boolean;
  attentionNote: string | null;
  adminNote: string | null;
  /** Время запуска отложенного заказа (если ещё не наступило) */
  scheduledStartAt: string | null;
  startDelayMinutes: number;
  itemsAdmin: AdminItem[];
};

type Totals = { orders: number; revenue: number; cost: number; profit: number; attention: number };
type Tab = "orders" | "services" | "settings";
type TestResult = { ok: boolean; error?: string; summary?: string; status?: unknown; response?: string; sent?: string; taskId?: string | null; cleanup?: string | null };

const STATUS_TONE: Record<string, "amber" | "green" | "gray" | "red"> = { in_progress: "amber", completed: "green", cancelled: "gray" };

const label = "mb-1.5 block text-xs font-extrabold text-black/60";
const hint = "mt-1 text-xs leading-5 text-black/40";

export default function ServiceLevelAdminPanel() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("orders");
  const [services, setServices] = useState<ServiceRow[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [socConfigured, setSocConfigured] = useState(false);
  const [cronConfigured, setCronConfigured] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [servicesData, settingsData, ordersData] = await Promise.all([
        api<{ services: ServiceRow[] }>("/api/admin/service-level/services"),
        api<{ settings: Settings; socConfigured: boolean; cronConfigured: boolean }>("/api/admin/service-level/settings"),
        api<{ orders: AdminOrder[]; totals: Totals }>("/api/admin/service-level/orders"),
      ]);
      setServices(servicesData.services);
      setSettings(settingsData.settings);
      setSocConfigured(settingsData.socConfigured);
      setCronConfigured(settingsData.cronConfigured);
      setOrders(ordersData.orders);
      setTotals(ordersData.totals);
      setError("");
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const reloadOrders = useCallback(async () => {
    try {
      const data = await api<{ orders: AdminOrder[]; totals: Totals }>("/api/admin/service-level/orders");
      setOrders(data.orders);
      setTotals(data.totals);
    } catch (err) {
      toast.push(errorText(err), "error");
    }
  }, [toast]);

  async function patchSettings(patch: Partial<Settings>, okText = "Сохранено.") {
    try {
      const data = await api<{ settings: Settings }>("/api/admin/service-level/settings", { method: "PATCH", json: patch });
      setSettings(data.settings);
      toast.push(okText);
      return true;
    } catch (err) {
      toast.push(errorText(err), "error");
      return false;
    }
  }

  const tabs: { id: Tab; title: string; badge?: number }[] = [
    { id: "orders", title: "Заказы", badge: totals?.attention || undefined },
    { id: "services", title: "Услуги" },
    { id: "settings", title: "Настройки и SocPublic" },
  ];

  return (
    <section className="min-w-0 space-y-5" style={{ overflowWrap: "break-word", wordBreak: "normal", hyphens: "manual" }}>
      {/* Шапка */}
      <div className="white-card min-w-0 p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="badge-green mb-3">Уровень сервиса</div>
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-black">Настройки уровня сервиса</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-black/50">Услуги, цены, шаблоны заданий для SocPublic и все заказы пользователей с расчётом прибыли.</p>
          </div>
          {settings && (
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3.5">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-black">Приём заказов</div>
                <div className="text-xs font-semibold text-black/45">{settings.isEnabled ? "Включён — пользователи могут заказывать" : "Выключен — пользователи видят «временно закрыт»"}</div>
              </div>
              <Toggle checked={settings.isEnabled} onChange={(value) => void patchSettings({ isEnabled: value }, value ? "Приём заказов включён." : "Приём заказов выключен.")} label="Приём заказов" />
            </div>
          )}
        </div>

        {!socConfigured && settings && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
            Ключи SocPublic не найдены. Добавьте в файл <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">.env</code> строки{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">SOCPUBLIC_API_ID=…</code> и{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">SOCPUBLIC_API_KEY=…</code> (раздел SocPublic → «Рекламировать» → «API ключи») и перезапустите сервер.
          </div>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}

      <div role="tablist" className="flex gap-1 rounded-2xl bg-black/[0.05] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-all duration-300 ${
              tab === item.id ? "bg-black text-white" : "text-black/55 hover:bg-white hover:text-black"
            }`}
          >
            <span className="truncate">{item.title}</span>
            {item.badge ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-extrabold text-white">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "orders" && <OrdersSection orders={orders} totals={totals} onReload={reloadOrders} toast={toast.push} />}
      {tab === "services" && <ServicesSection services={services} onEdit={setEditing} onChanged={loadAll} toast={toast.push} />}
      {tab === "settings" && settings && <SettingsSection settings={settings} socConfigured={socConfigured} cronConfigured={cronConfigured} onSave={patchSettings} />}
      {!settings && !error && <div className="al-skeleton h-48 rounded-3xl" />}

      {editing && (
        <ServiceModal
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadAll();
          }}
          toast={toast.push}
        />
      )}
      {toast.node}
    </section>
  );
}

/* ---------- Услуги ---------- */
function ServicesSection({
  services,
  onEdit,
  onChanged,
  toast,
}: {
  services: ServiceRow[] | null;
  onEdit: (service: ServiceRow | "new") => void;
  onChanged: () => Promise<void>;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  async function toggleActive(service: ServiceRow, isActive: boolean) {
    try {
      await api(`/api/admin/service-level/services/${service.id}`, { method: "PATCH", json: { isActive } });
      await onChanged();
    } catch (err) {
      toast(errorText(err), "error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-black/50">Каждая услуга — отдельное задание на SocPublic. Можно добавлять новые и править существующие.</p>
        <button type="button" onClick={() => onEdit("new")} className="btn-primary inline-flex items-center gap-2 !px-5 !py-2.5 text-sm">
          <Icon name="plus" /> Добавить услугу
        </button>
      </div>

      {!services && <div className="al-skeleton h-40 rounded-3xl" />}
      {services?.map((service) => (
        <article key={service.id} className={`min-w-0 rounded-3xl border bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-5 ${service.isActive ? "border-black/[0.08]" : "border-dashed border-black/20 opacity-75"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="text-2xl leading-none">{service.emoji}</span>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold leading-5 text-black">{service.title}</h3>
                <p className="mt-0.5 text-xs font-semibold text-black/40">
                  Заказов: {service.ordersCount} · задание на SocPublic: «{service.taskTitle}»
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-black/45">{service.isActive ? "Показывается" : "Скрыта"}</span>
              <Toggle checked={service.isActive} onChange={(value) => void toggleActive(service, value)} label="Показывать пользователям" />
              <button type="button" onClick={() => onEdit(service)} className={`${ghostButton} !px-3 !py-2`}>
                <Icon name="edit" /> Изменить
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Chip label="Цена на сайте" value={`${formatRub(service.pricePerUnit)} / шт.`} />
            <Chip label="Минимум на ссылку" value={`${service.minQuantity} шт.`} />
            <Chip label="Выплата исполнителю" value={formatRub(service.reward)} />
            <Chip label="Описание в инструкции" value={service.guide.trim() ? "задано" : "не задано"} />
          </div>
        </article>
      ))}
    </div>
  );
}

function Chip({ label: text, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-black/[0.03] px-3.5 py-2.5">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">{text}</div>
      <div className="mt-0.5 truncate text-sm font-extrabold text-black">{value}</div>
    </div>
  );
}

/* ---------- Окно услуги ---------- */
function ServiceModal({
  service,
  onClose,
  onSaved,
  toast,
}: {
  service: ServiceRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [form, setForm] = useState({
    title: service?.title ?? "",
    emoji: service?.emoji ?? "⭐",
    sortOrder: String(service?.sortOrder ?? 100),
    isActive: service?.isActive ?? true,
    summary: service?.summary ?? "",
    guide: service?.guide ?? "",
    pricePerUnit: String(service?.pricePerUnit ?? 25),
    minQuantity: String(service?.minQuantity ?? 15),
    maxQuantity: String(service?.maxQuantity ?? 500),
    taskTitle: service?.taskTitle ?? "Легкие действия Авито НОВАЯ {letter}{n}",
    numberSingleLink: service?.numberSingleLink ?? true,
    taskDescription: service?.taskDescription ?? "",
    confirmInfo: service?.confirmInfo ?? "Скриншот переписки",
    reward: String(service?.reward ?? 5),
    executionMinutes: service?.executionMinutes ?? 7200,
    payloadTemplate: service?.payloadTemplate ?? DEFAULT_CREATE_TEMPLATE,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testUrl, setTestUrl] = useState("https://www.avito.ru/test/test_000000000");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setFormError("");
    try {
      const body = {
        ...form,
        sortOrder: Number(form.sortOrder),
        pricePerUnit: Number(form.pricePerUnit),
        minQuantity: Number(form.minQuantity),
        maxQuantity: Number(form.maxQuantity),
        reward: Number(String(form.reward).replace(",", ".")),
        executionMinutes: form.executionMinutes,
      };
      if (service) await api(`/api/admin/service-level/services/${service.id}`, { method: "PATCH", json: body });
      else await api("/api/admin/service-level/services", { json: body });
      toast(service ? "Услуга сохранена." : "Услуга добавлена.");
      await onSaved();
    } catch (err) {
      setFormError(errorText(err));
      setSaving(false);
    }
  }

  async function remove() {
    if (!service || !window.confirm(`Удалить услугу «${service.title}»?`)) return;
    try {
      await api(`/api/admin/service-level/services/${service.id}`, { method: "DELETE" });
      toast("Услуга удалена.");
      await onSaved();
    } catch (err) {
      setFormError(errorText(err));
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      // Проверяем прямо то, что сейчас в полях формы — сохранять услугу для этого не нужно.
      setTest(
        await api<TestResult>("/api/admin/service-level/test", {
          json: {
            action: "template",
            draft: { payloadTemplate: form.payloadTemplate, taskDescription: form.taskDescription, confirmInfo: form.confirmInfo, reward: form.reward, executionMinutes: form.executionMinutes, testUrl },
          },
        }),
      );
    } catch (err) {
      setTest({ ok: false, error: errorText(err) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Modal
      wide
      title={service ? "Изменить услугу" : "Новая услуга"}
      subtitle="Тексты и цены видят пользователи; блок «Задание на SocPublic» — как создаётся задание на бирже."
      onClose={onClose}
      footer={
        <>
          {service && (
            <button type="button" onClick={() => void remove()} className="mr-auto inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-600 transition hover:bg-red-50">
              <Icon name="trash" /> Удалить
            </button>
          )}
          <button type="button" onClick={onClose} className={ghostButton}>
            Отмена
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary inline-flex items-center gap-2 !px-6 !py-3 text-sm disabled:opacity-60">
            {saving ? <Spinner /> : <Icon name="check" />} Сохранить
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <h5 className="text-sm font-extrabold text-black">Что видит пользователь</h5>
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_90px_110px]">
            <div className="min-w-0">
              <label className={label}>Название услуги</label>
              <input value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={120} className={inputClass} placeholder="Достоверность цены" />
            </div>
            <div>
              <label className={label}>Эмодзи</label>
              <input value={form.emoji} onChange={(event) => set("emoji", event.target.value)} maxLength={8} className={`${inputClass} text-center`} />
            </div>
            <div>
              <label className={label}>Порядок</label>
              <input value={form.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} inputMode="numeric" className={inputClass} />
            </div>
          </div>
          <div className="mt-4">
            <label className={label}>Короткое описание (на карточке)</label>
            <textarea value={form.summary} onChange={(event) => set("summary", event.target.value)} rows={2} maxLength={400} className={`${inputClass} resize-y`} />
          </div>
          <div className="mt-4">
            <label className={label}>Подробное описание для инструкции</label>
            <textarea value={form.guide} onChange={(event) => set("guide", event.target.value)} rows={5} maxLength={6000} className={`${inputClass} resize-y leading-6`} />
            <p className={hint}>Если оставить пустым — в инструкции пользователя эта услуга не описывается. Абзацы разделяйте пустой строкой.</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3.5">
            <div className="text-sm font-extrabold text-black">Показывать пользователям</div>
            <Toggle checked={form.isActive} onChange={(value) => set("isActive", value)} label="Показывать пользователям" />
          </div>
        </div>

        <div>
          <h5 className="text-sm font-extrabold text-black">Цена на нашем сайте</h5>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Цена за 1 действие, ₽</label>
              <input value={form.pricePerUnit} onChange={(event) => set("pricePerUnit", event.target.value)} inputMode="numeric" className={inputClass} />
              <p className={hint}>Целое число рублей.</p>
            </div>
            <div>
              <label className={label}>Минимум на одну ссылку</label>
              <input value={form.minQuantity} onChange={(event) => set("minQuantity", event.target.value)} inputMode="numeric" className={inputClass} />
            </div>
            <div>
              <label className={label}>Максимум на одну ссылку</label>
              <input value={form.maxQuantity} onChange={(event) => set("maxQuantity", event.target.value)} inputMode="numeric" className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <h5 className="text-sm font-extrabold text-black">Задание на SocPublic</h5>
          <div className="mt-3 space-y-4">
            <div>
              <label className={label}>Шаблон названия задания</label>
              <input value={form.taskTitle} onChange={(event) => set("taskTitle", event.target.value)} maxLength={140} className={inputClass} />
              <p className={hint}>
                <b>{"{letter}"}</b> — первая буква имени пользователя, <b>{"{n}"}</b> — номер ссылки в заказе (1, 2, 3…). До 70 символов. Пример: «Легкие действия Авито ЦЕНА о1».
              </p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-black/60">
                <input type="checkbox" checked={form.numberSingleLink} onChange={(event) => set("numberSingleLink", event.target.checked)} className="h-4 w-4 accent-[#03bd48]" />
                Добавлять номер, даже если ссылка в заказе одна
              </label>
            </div>
            <div>
              <label className={label}>Описание задания для исполнителей (HTML)</label>
              <textarea value={form.taskDescription} onChange={(event) => set("taskDescription", event.target.value)} rows={4} maxLength={8000} className={`${inputClass} resize-y font-mono !text-[12px] leading-6`} />
            </div>
            <div>
              <label className={label}>Информация для подтверждения (HTML)</label>
              <textarea value={form.confirmInfo} onChange={(event) => set("confirmInfo", event.target.value)} rows={2} maxLength={4000} className={`${inputClass} resize-y`} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Оплата исполнителю, ₽</label>
                <input value={form.reward} onChange={(event) => set("reward", event.target.value)} inputMode="decimal" className={inputClass} />
                <p className={hint}>Минимум SocPublic — 1,8 ₽.</p>
              </div>
              <div>
                <label className={label}>Время на выполнение</label>
                <select value={form.executionMinutes} onChange={(event) => set("executionMinutes", Number(event.target.value))} className={inputClass}>
                  {EXECUTION_TIME_OPTIONS.map((option) => (
                    <option key={option.minutes} value={option.minutes}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className={hint}>Те же варианты, что на SocPublic (в запрос уходит как work_time в секундах). Это время резервирует оплату для исполнителя, пока он не сдаст отчёт. Уже созданные задания не меняются — новое значение действует для новых заказов.</p>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className={label}>Шаблон запроса task_create (JSON)</label>
                <button
                  type="button"
                  onClick={() => window.confirm("Заменить текущий шаблон на последний стандартный от HelpSell? Свои правки в нём будут потеряны.") && set("payloadTemplate", DEFAULT_CREATE_TEMPLATE)}
                  className="mb-1.5 text-xs font-extrabold text-black/40 underline-offset-2 hover:text-[#028c36] hover:underline"
                >
                  Сбросить до стандартного
                </button>
              </div>
              <textarea value={form.payloadTemplate} onChange={(event) => set("payloadTemplate", event.target.value)} rows={10} spellCheck={false} className={`${inputClass} resize-y font-mono !text-[12px] leading-6`} />
              <p className={hint}>
                Поля соответствуют официальной документации SocPublic (метод task_create): <b>name</b>, <b>url</b> (список ссылок), <b>type</b> (для Авито — «avito»), <b>work_time</b> (время на выполнение в секундах — подставляется из выбранного выше), <b>description</b>, <b>approve_type</b>, <b>approve_text</b>, <b>price_user</b>. Любые другие параметры из документации (ограничения по часам и дням, таргетинг, капча, per_24, timeout и т.д.) можно дописать сюда же. Подстановки:{" "}
                {["{{name}}", "{{links}}", "{{linksText}}", "{{description}}", "{{confirm}}", "{{reward}}", "{{count}}", "{{executionSeconds}}", "{{executionMinutes}}"].map((token) => (
                  <code key={token} className="mr-1 rounded bg-black/[0.06] px-1 font-mono text-[11px]">
                    {token}
                  </code>
                ))}
              </p>
            </div>

            <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-black">Проверить шаблон</div>
                  <p className="text-xs leading-5 text-black/45">
                    Создаст на SocPublic тестовое задание (без пополнения баланса — деньги не тратятся) и сразу удалит его. Проверяется то, что прямо сейчас в полях выше — сохранять не нужно. У SocPublic есть собственное ограничение на то, как часто вообще можно создавать новые задания (видели «Вы слишком часто создаёте рекламные кампании») — оно общее для теста и для настоящих заказов, поэтому злоупотреблять кнопкой не стоит, особенно если есть активные заказы.
                  </p>
                </div>
                <button type="button" onClick={() => void runTest()} disabled={testing} className={ghostButton}>
                  {testing ? <Spinner /> : <Icon name="play" />} Проверить
                </button>
              </div>
              <div className="mt-3">
                <label className={label}>Ссылка для теста</label>
                <input value={testUrl} onChange={(event) => setTestUrl(event.target.value)} className={`${inputClass} !text-xs`} placeholder="https://www.avito.ru/test/test_000000000" />
                <p className={hint}>По умолчанию — вымышленная ссылка. Если SocPublic ругается именно на формат ссылки, подставьте сюда настоящую ссылку на ваше объявление и проверьте снова.</p>
              </div>
              {test && <TestOutput result={test} />}
            </div>
          </div>
        </div>

        {formError && <div className="al-pop rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-bold leading-6 text-red-600">{formError}</div>}
      </div>
    </Modal>
  );
}

function TestOutput({ result }: { result: TestResult }) {
  return (
    <div className="al-pop mt-3 space-y-2">
      <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-bold leading-5 ${result.ok ? "bg-[#03bd48]/10 text-[#027a30]" : "bg-red-50 text-red-700"}`}>
        <Icon name={result.ok ? "check" : "warning"} className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0">
          {result.ok ? (result.summary ?? "Всё работает.") : (result.error ?? "Ошибка.")}
          {result.taskId ? ` ID созданного задания: ${result.taskId}.` : ""} {result.cleanup ?? ""}
        </span>
      </div>
      {result.sent && (
        <details className="rounded-xl bg-white ring-1 ring-black/[0.08]">
          <summary className="cursor-pointer px-3 py-2 text-xs font-extrabold text-black/55">Что мы отправили</summary>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all border-t border-black/[0.06] p-3 font-mono text-[11px] leading-5 text-black/70">{result.sent}</pre>
        </details>
      )}
      {result.response && (
        <details className="rounded-xl bg-white ring-1 ring-black/[0.08]" open={!result.ok}>
          <summary className="cursor-pointer px-3 py-2 text-xs font-extrabold text-black/55">Ответ SocPublic</summary>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-black/[0.06] bg-black p-3 font-mono text-[11px] leading-5 text-[#78f8a6]">{result.response}</pre>
        </details>
      )}
    </div>
  );
}

/* ---------- Заказы ---------- */
function OrdersSection({
  orders,
  totals,
  onReload,
  toast,
}: {
  orders: AdminOrder[] | null;
  totals: Totals | null;
  onReload: () => Promise<void>;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus | "attention">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (orders ?? []).filter((order) => {
      if (statusFilter === "attention" && !(order.attention && order.status === "in_progress")) return false;
      if (statusFilter !== "all" && statusFilter !== "attention" && order.status !== statusFilter) return false;
      if (!q) return true;
      return [order.userName, order.email, String(order.publicId ?? ""), order.service, `№${order.number}`].join(" ").toLowerCase().includes(q);
    });
  }, [orders, statusFilter, query]);

  const filters: { id: typeof statusFilter; title: string }[] = [
    { id: "all", title: "Все" },
    { id: "in_progress", title: "В работе" },
    { id: "attention", title: "Требуют внимания" },
    { id: "completed", title: "Выполнены" },
    { id: "cancelled", title: "Отменены" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat title="Заказов" value={String(totals?.orders ?? 0)} />
        <Stat title="Выручка" value={formatRub(totals?.revenue ?? 0)} />
        <Stat title="Расход SocPublic" value={formatRub(totals?.cost ?? 0)} />
        <Stat title="Чистая прибыль" value={formatRub(totals?.profit ?? 0)} accent={(totals?.profit ?? 0) >= 0 ? "green" : "red"} />
        <Stat title="Требуют внимания" value={String(totals?.attention ?? 0)} accent={(totals?.attention ?? 0) > 0 ? "red" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${statusFilter === item.id ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60 hover:border-[#03bd48]/50"}`}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск: имя, Public ID, услуга…" className={`${inputClass} !py-2.5`} aria-label="Поиск по заказам" />
        </div>
        <button type="button" onClick={() => void onReload()} className={`${ghostButton} !px-3 !py-2.5`}>
          <Icon name="refresh" /> Обновить
        </button>
      </div>

      {!orders && <div className="al-skeleton h-40 rounded-3xl" />}
      {orders && filtered.length === 0 && <div className="rounded-3xl bg-black/[0.03] p-8 text-center text-sm font-bold text-black/45">Заказов нет.</div>}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} open={open === order.id} onToggle={() => setOpen((current) => (current === order.id ? null : order.id))} onReload={onReload} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, accent }: { title: string; value: string; accent?: "green" | "red" }) {
  return (
    <div className={`min-w-0 rounded-3xl border p-4 ${accent === "red" ? "border-red-200 bg-red-50" : accent === "green" ? "border-[#03bd48]/25 bg-[#03bd48]/[0.07]" : "border-black/[0.08] bg-white"}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-black/40">{title}</div>
      <div className={`mt-1.5 truncate text-xl font-extrabold tracking-[-0.03em] tabular-nums ${accent === "red" ? "text-red-600" : accent === "green" ? "text-[#028c36]" : "text-black"}`}>{value}</div>
    </div>
  );
}

function OrderCard({
  order,
  open,
  onToggle,
  onReload,
  toast,
}: {
  order: AdminOrder;
  open: boolean;
  onToggle: () => void;
  onReload: () => Promise<void>;
  toast: (text: string, kind?: "ok" | "error") => void;
}) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState(order.adminNote ?? "");
  const [taskIds, setTaskIds] = useState<Record<number, string>>({});

  async function act(action: string, extra: Record<string, unknown> = {}, okText?: string) {
    setBusy(action);
    try {
      const result = await api<{ message?: string }>(`/api/admin/service-level/orders/${order.id}`, { json: { action, ...extra } });
      toast(result.message ?? okText ?? "Готово.");
      await onReload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy("");
    }
  }

  const status = order.status as OrderStatus;
  const attention = order.attention && order.status === "in_progress";
  // Ждать имеет смысл только для заказа, который ещё в работе — для уже отменённого или
  // выполненного заказа это просто устаревшая отметка в базе, её не показываем.
  const waitingItem = order.status === "in_progress" ? order.itemsAdmin.find((item) => item.retryAfter && new Date(item.retryAfter).getTime() > Date.now()) : undefined;
  // Сколько отчётов исполнителей по этому заказу ждут вашей проверки на SocPublic (bid_done из task_info).
  const reportsToCheck = order.status === "in_progress" ? order.itemsAdmin.reduce((sum, item) => sum + (readTaskSnapshot(item.rawLast)?.waiting ?? 0), 0) : 0;

  return (
    <div className={`overflow-hidden rounded-3xl border shadow-[0_10px_30px_rgba(16,24,40,0.05)] ${attention ? "border-red-200 bg-red-50/60" : "border-black/[0.08] bg-white"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-black/[0.015] sm:p-4.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-xs font-extrabold text-[#03bd48]">№{order.number}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-black" title={order.email}>
                {order.userName} <span className="font-semibold text-black/35">· Public ID: {order.publicId ?? "—"}</span>
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-black/60">{order.service}</div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Pill tone={STATUS_TONE[order.status] ?? "gray"}>{ORDER_STATUS_LABEL[status] ?? order.status}</Pill>
            {attention && <Pill tone="red">Внимание</Pill>}
            {order.scheduledStartAt && <Pill tone="gray">Отложен до {formatDateTime(order.scheduledStartAt)}</Pill>}
            {!attention && waitingItem && <Pill tone="amber">Ждём SocPublic</Pill>}
            {reportsToCheck > 0 && <Pill tone="amber">Проверить отчёты: {reportsToCheck}</Pill>}
            <Icon name="chevron" className={`h-4 w-4 shrink-0 text-black/40 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <MiniStat label="Количество" value={`${order.linksCount} × ${order.quantityPerLink} = ${order.totalQuantity}`} />
          <MiniStat label="На SocPublic (с запасом)" value={String(order.itemsAdmin.reduce((sum, item) => sum + item.socQuantity, 0))} />
          <MiniStat label="Оплатил" value={formatRub(order.paid)} />
          <MiniStat label="Расход SocPublic" value={formatRub(order.socCost)} />
          <MiniStat label="Чистая прибыль" value={formatRub(order.profit)} tone={order.profit >= 0 ? "green" : "red"} />
        </div>
      </button>

      {open && (
        <div className="border-t border-black/[0.06] bg-black/[0.02] p-4 sm:p-4.5">
          <div className="al-pop space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-black/50">
                <span>Оплачен: {formatDateTime(order.paidAt)}</span>
                <span>·</span>
                <span>{order.email}</span>
                {order.completedAt && (
                  <>
                    <span>·</span>
                    <span>Выполнен: {formatDateTime(order.completedAt)}</span>
                  </>
                )}
              </div>

              {order.scheduledStartAt && (
                <div className="flex items-start gap-2 rounded-xl border border-[#03bd48]/30 bg-[#03bd48]/[0.07] px-3.5 py-2.5 text-xs font-bold leading-5 text-black/70" style={{ display: "flex", gap: 8 }}>
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-[#028c36]" />
                  <span className="min-w-0" style={{ overflowWrap: "break-word" }}>
                    Пользователь выбрал отсрочку {Math.round(order.startDelayMinutes / 60)} ч. На SocPublic ничего не отправлено — задания уйдут <b>{formatDateTime(order.scheduledStartAt)}</b> (проверка по cron раз в 5–15 минут).
                  </span>
                </div>
              )}

              {attention && order.attentionNote && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-red-700">{order.attentionNote}</div>}
              {!attention && waitingItem && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-amber-800">
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    SocPublic ограничивает, как часто можно создавать новые задания. Ссылка №{waitingItem.position} отправится сама — ждать и нажимать ничего не нужно.{" "}
                    Автоматическая попытка — <b>{formatDateTime(waitingItem.retryAfter)}</b>.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {order.scheduledStartAt && (
                  <button type="button" disabled={busy !== ""} onClick={() => window.confirm("Запустить заказ прямо сейчас, не дожидаясь выбранного времени?") && void act("startNow")} className={`${ghostButton} !px-3 !py-2 !text-xs`}>
                    {busy === "startNow" ? <Spinner /> : <Icon name="play" />} Запустить сейчас
                  </button>
                )}
                <button type="button" disabled={busy !== "" || order.status !== "in_progress"} onClick={() => void act("retry")} className={`${ghostButton} !px-3 !py-2 !text-xs`}>
                  {busy === "retry" ? <Spinner /> : <Icon name="play" />} Повторить отправку
                </button>
                <button type="button" disabled={busy !== "" || order.status !== "in_progress"} onClick={() => void act("sync", {}, "Статус обновлён.")} className={`${ghostButton} !px-3 !py-2 !text-xs`}>
                  {busy === "sync" ? <Spinner /> : <Icon name="refresh" />} Обновить из SocPublic
                </button>
                {order.status !== "completed" && (
                  <button type="button" disabled={busy !== ""} onClick={() => window.confirm("Отметить заказ выполненным?") && void act("complete", {}, "Заказ отмечен выполненным.")} className={`${ghostButton} !px-3 !py-2 !text-xs`}>
                    <Icon name="check" /> Отметить выполненным
                  </button>
                )}
                {order.status === "in_progress" && (
                  <button
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => window.confirm("Отменить заказ? Деньги пользователю нужно вернуть вручную в ЮKassa.") && void act("cancel", {}, "Заказ отменён.")}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Icon name="close" /> Отменить
                  </button>
                )}
                {order.status !== "in_progress" && (
                  <button type="button" disabled={busy !== ""} onClick={() => void act("reopen", {}, "Заказ возвращён в работу.")} className={`${ghostButton} !px-3 !py-2 !text-xs`}>
                    Вернуть в работу
                  </button>
                )}
              </div>

              <ul className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
                {order.itemsAdmin.map((item) => (
                  <li key={item.id} className="space-y-2 px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-[11px] font-extrabold text-black/55">{item.position}</span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 basis-56 truncate text-sm font-bold text-[#028c36] hover:underline" title={item.url}>
                        {item.url}
                      </a>
                      <span className="text-xs font-bold tabular-nums text-black/45">{item.quantity} шт. <span className="text-black/30">(на SocPublic {item.socQuantity})</span></span>
                      {(() => {
                        const waiting = order.status === "in_progress" && Boolean(item.retryAfter && new Date(item.retryAfter).getTime() > Date.now());
                        return (
                          <Pill tone={waiting ? "amber" : item.stage === "error" ? "red" : item.stage === "done" ? "green" : item.stage === "active" ? "amber" : "gray"}>
                            {waiting ? "Ждёт своей очереди на SocPublic" : (ITEM_STAGE_LABEL[item.stage] ?? item.stage)}
                          </Pill>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-black/50">
                      <span className="font-semibold">«{item.taskName}»</span>
                      <span>·</span>
                      <span>ID на SocPublic: {item.socTaskId ?? "—"}</span>
                      {item.fundedAmount !== null && <span>· пополнено {formatRub(item.fundedAmount)} (SocPublic принимает целые рубли; остаток вернём после выполнения)</span>}
                    </div>
                    {(() => {
                      const snapshot = readTaskSnapshot(item.rawLast);
                      if (!snapshot) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                          <span className="rounded-md bg-black/[0.05] px-2 py-1 text-black/60">Баланс задания: {snapshot.balance !== null ? formatRub(snapshot.balance) : "—"}</span>
                          <span className="rounded-md bg-[#03bd48]/10 px-2 py-1 text-[#027a30]">Оплачено: {snapshot.paid}</span>
                          <span className="rounded-md bg-black/[0.05] px-2 py-1 text-black/60">Начато: {snapshot.started}</span>
                          <span className={`rounded-md px-2 py-1 ${snapshot.waiting > 0 ? "bg-amber-100 text-amber-800" : "bg-black/[0.05] text-black/60"}`}>Ждут проверки: {snapshot.waiting}</span>
                          <span className="rounded-md bg-black/[0.05] px-2 py-1 text-black/60">На доработке: {snapshot.rework}</span>
                          {snapshot.rejected > 0 && <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">Отклонено: {snapshot.rejected}</span>}
                          {snapshot.active && <span className={`rounded-md px-2 py-1 ${snapshot.active === "yes" ? "bg-[#03bd48]/10 text-[#027a30]" : "bg-red-50 text-red-700"}`}>{snapshot.active === "yes" ? "Включено" : snapshot.active === "ban" ? "Заблокировано" : "Выключено"}</span>}
                        </div>
                      );
                    })()}
                    {item.error && <div className="rounded-lg bg-red-50 px-2.5 py-2 text-xs font-bold leading-5 text-red-700">{item.error}</div>}
                    <div className="flex flex-wrap items-center gap-2">
                      <div style={{ width: 176, flex: "0 0 auto" }}><input
                        value={taskIds[item.id] ?? ""}
                        onChange={(event) => setTaskIds((current) => ({ ...current, [item.id]: event.target.value }))}
                        placeholder="ID задания SocPublic"
                        inputMode="numeric"
                        className={`${inputClass} !py-1.5 !text-xs`}
                        aria-label="ID задания SocPublic"
                      /></div>
                      <button type="button" disabled={busy !== "" || !(taskIds[item.id] ?? "").trim()} onClick={() => void act("setTaskId", { itemId: item.id, socTaskId: taskIds[item.id] }, "ID сохранён.")} className={`${ghostButton} !px-2.5 !py-1.5 !text-xs`}>
                        Указать ID вручную
                      </button>
                      <div style={{ width: 192, flex: "0 0 auto" }}><select
                        value=""
                        disabled={busy !== ""}
                        onChange={(event) => event.target.value && void act("markStage", { itemId: item.id, stage: event.target.value }, "Этап обновлён.")}
                        className={`${inputClass} !py-1.5 !text-xs`}
                        aria-label="Отметить этап вручную"
                      >
                        <option value="">Отметить этап…</option>
                        <option value="created">Задание создано</option>
                        <option value="funded">Баланс пополнен</option>
                        <option value="active">Задание включено</option>
                        <option value="done">Выполнено</option>
                      </select></div>
                    </div>
                    {item.rawLast && (
                      <details className="rounded-lg bg-black/[0.03]">
                        <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] font-extrabold text-black/45">Последний ответ SocPublic</summary>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all bg-black p-2.5 font-mono text-[11px] leading-5 text-[#78f8a6]">{item.rawLast}</pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Заметка админа к заказу" className={`${inputClass} !py-2 !text-xs`} aria-label="Заметка админа" />
                <button type="button" disabled={busy !== "" || note === (order.adminNote ?? "")} onClick={() => void act("note", { note }, "Заметка сохранена.")} className={`${ghostButton} !px-3 !py-2 !text-xs`}>
                  Сохранить заметку
                </button>
              </div>
              <div className="text-[11px] font-semibold text-black/35">
                {order.linksCount} {pluralRu(order.linksCount, "задание", "задания", "заданий")} на SocPublic · заказ #{order.id}
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

type TaskSnapshot = { balance: number | null; paid: number; started: number; waiting: number; rework: number; rejected: number; active: string | null };

/** Сводка по заданию из последнего ответа task_info (поля из документации SocPublic); null, если это не ответ task_info. */
function readTaskSnapshot(rawLast: string | null): TaskSnapshot | null {
  if (!rawLast) return null;
  try {
    const data = (JSON.parse(rawLast) as { data?: Record<string, unknown> }).data;
    if (!data || typeof data !== "object" || !("bid_pay" in data)) return null;
    const num = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };
    const balance = Number(data.balance);
    return {
      balance: Number.isFinite(balance) ? balance : null,
      paid: num(data.bid_pay),
      started: num(data.bid_start),
      waiting: num(data.bid_done),
      rework: num(data.bid_debug),
      rejected: num(data.bid_reject),
      active: typeof data.active === "string" ? data.active : null,
    };
  } catch {
    return null;
  }
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <div className="min-w-[128px] flex-1 rounded-xl bg-black/[0.03] px-3 py-2">
      <div className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-black/40">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-extrabold tabular-nums ${tone === "green" ? "text-[#028c36]" : tone === "red" ? "text-red-600" : "text-black"}`}>{value}</div>
    </div>
  );
}

/* ---------- Настройки и SocPublic ---------- */
function SettingsSection({
  settings,
  socConfigured,
  cronConfigured,
  onSave,
}: {
  settings: Settings;
  socConfigured: boolean;
  cronConfigured: boolean;
  onSave: (patch: Partial<Settings>, okText?: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    minTier: settings.minTier,
    commissionPercent: String(settings.commissionPercent),
    maxLinksPerOrder: String(settings.maxLinksPerOrder),
    successCodes: settings.successCodes,
    payTemplate: settings.payTemplate,
    keyRemaining: settings.keyRemaining,
    keyReady: settings.keyReady,
    keyStarted: settings.keyStarted,
    keyRework: settings.keyRework,
    keyTotal: settings.keyTotal,
    keyPaid: settings.keyPaid,
    etaText: settings.etaText,
    guideIntro: settings.guideIntro,
  });
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<"" | "account" | "info">("");
  const [toolResult, setToolResult] = useState<TestResult | null>(null);
  const [infoTaskId, setInfoTaskId] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    await onSave({ ...form, commissionPercent: Number(String(form.commissionPercent).replace(",", ".")), maxLinksPerOrder: Number(form.maxLinksPerOrder) } as unknown as Partial<Settings>);
    setSaving(false);
  }

  async function runTool(action: "account" | "info") {
    setTool(action);
    setToolResult(null);
    try {
      setToolResult(await api<TestResult>("/api/admin/service-level/test", { json: { action, taskId: infoTaskId } }));
    } catch (err) {
      setToolResult({ ok: false, error: errorText(err) });
    } finally {
      setTool("");
    }
  }

  const keyFields: [keyof typeof form, string][] = [
    ["keyPaid", "Оплачено заявок (bid_pay)"],
    ["keyReady", "Ждут вашей проверки (bid_done)"],
    ["keyStarted", "Начато (bid_start)"],
    ["keyRework", "На доработке (bid_debug)"],
    ["keyRemaining", "Осталось выполнений (не используется)"],
    ["keyTotal", "Всего заявок (не используется)"],
  ];

  return (
    <div className="space-y-5">
      <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
        <h3 className="text-lg font-extrabold tracking-[-0.02em] text-black">Подключение к SocPublic</h3>
        <ul className="mt-3 space-y-1.5 text-sm font-bold">
          <li className={socConfigured ? "text-[#028c36]" : "text-red-600"}>{socConfigured ? "✓ Ключи SOCPUBLIC_API_ID и SOCPUBLIC_API_KEY найдены в .env" : "✗ Ключи SOCPUBLIC_API_ID / SOCPUBLIC_API_KEY не найдены в .env"}</li>
          <li className="text-black/55">
            • SocPublic принимает запросы <b>только с IP-адресов, указанных в самом API-ключе</b> (SocPublic → «API ключи»). На своём компьютере это ваш IP; когда сайт будет на сервере — добавьте IP сервера, иначе вместо ответа придёт ошибка авторизации (статус 10x).
          </li>
          <li className={cronConfigured ? "text-[#028c36]" : "text-black/45"}>
            {cronConfigured
              ? "✓ CRON_SECRET задан — работает фоновая проверка /api/service-level/cron"
              : "• CRON_SECRET не задан — фоновая проверка по расписанию выключена (статусы всё равно обновляются, когда пользователь открывает раздел)"}
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => void runTool("account")} disabled={tool !== ""} className={ghostButton}>
            {tool === "account" ? <Spinner /> : <Icon name="key" />} Проверить ключи (account_info)
          </button>
          <div style={{ width: 144, flex: "0 0 auto" }}><input value={infoTaskId} onChange={(event) => setInfoTaskId(event.target.value)} inputMode="numeric" placeholder="ID задания" className={`${inputClass} !py-2.5`} aria-label="ID задания SocPublic" /></div>
          <button type="button" onClick={() => void runTool("info")} disabled={tool !== "" || !infoTaskId.trim()} className={ghostButton}>
            {tool === "info" ? <Spinner /> : <Icon name="search" />} Показать task_info
          </button>
        </div>
        {toolResult && <TestOutput result={toolResult} />}
        <p className={hint}>«task_info» нужен, чтобы увидеть, как SocPublic описывает ход задания, и при необходимости поправить ключи ниже.</p>
      </section>

      <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
        <h3 className="text-lg font-extrabold tracking-[-0.02em] text-black">Общие настройки</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Кому доступна услуга</label>
            <select value={form.minTier} onChange={(event) => set("minTier", event.target.value as MinTier)} className={inputClass}>
              {MIN_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_LABEL[tier]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Комиссия SocPublic, %</label>
            <input value={form.commissionPercent} onChange={(event) => set("commissionPercent", event.target.value)} inputMode="decimal" className={inputClass} />
            <p className={hint}>5 ₽ выплаты + 30 % = 6,5 ₽ расхода на выполнение.</p>
          </div>
          <div>
            <label className={label}>Макс. ссылок в заказе</label>
            <input value={form.maxLinksPerOrder} onChange={(event) => set("maxLinksPerOrder", event.target.value)} inputMode="numeric" className={inputClass} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Срок выполнения (текст для пользователей)</label>
            <input value={form.etaText} onChange={(event) => set("etaText", event.target.value)} maxLength={200} className={inputClass} />
            <p className={hint}>Подставляется во фразу «Срок выполнения — …».</p>
          </div>
          <div>
            <label className={label}>Вступление в инструкции</label>
            <textarea value={form.guideIntro} onChange={(event) => set("guideIntro", event.target.value)} rows={3} maxLength={4000} className={`${inputClass} resize-y`} />
            <p className={hint}>Необязательно. Показывается вверху вкладки «Инструкция».</p>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_30px_rgba(16,24,40,0.05)] sm:p-6">
        <h3 className="text-lg font-extrabold tracking-[-0.02em] text-black">Параметры API SocPublic</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
          <div>
            <label className={label}>Коды успешного ответа</label>
            <input value={form.successCodes} onChange={(event) => set("successCodes", event.target.value)} className={inputClass} />
            <p className={hint}>Значения поля status, которые считаются успехом. У SocPublic успех — 0. Через запятую.</p>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className={label}>Шаблон пополнения задания task_pay (JSON)</label>
              <button
                type="button"
                onClick={() => window.confirm("Заменить текущий шаблон на последний стандартный от HelpSell? Свои правки в нём будут потеряны.") && set("payTemplate", DEFAULT_PAY_TEMPLATE)}
                className="mb-1.5 text-xs font-extrabold text-black/40 underline-offset-2 hover:text-[#028c36] hover:underline"
              >
                Сбросить до стандартного
              </button>
            </div>
            <textarea value={form.payTemplate} onChange={(event) => set("payTemplate", event.target.value)} rows={4} spellCheck={false} className={`${inputClass} resize-y font-mono !text-[12px] leading-6`} />
            <p className={hint}>
              Подстановки: <code className="rounded bg-black/[0.06] px-1 font-mono text-[11px]">{"{{taskId}}"}</code>{" "}
              <code className="rounded bg-black/[0.06] px-1 font-mono text-[11px]">{"{{amountRounded}}"}</code> (рубли, с комиссией, округлено вверх до целого){" "}
              <code className="rounded bg-black/[0.06] px-1 font-mono text-[11px]">{"{{amount}}"}</code> (та же сумма, но точная, с копейками){" "}
              <code className="rounded bg-black/[0.06] px-1 font-mono text-[11px]">{"{{amountKopecks}}"}</code> (в копейках){" "}
              <code className="rounded bg-black/[0.06] px-1 font-mono text-[11px]">{"{{count}}"}</code> (число выполнений). Названия полей — по описанию метода task_pay.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="text-sm font-extrabold text-black">Как узнаём, что задание выполнено</div>
          <p className={hint}>
            Названия полей из ответа task_info (по документации SocPublic): <b>bid_pay</b> — оплачено заявок, <b>bid_done</b> — отчётов ждёт вашей проверки, <b>bid_start</b> — начато, <b>bid_debug</b> — на доработке. Заказ становится «Выполнен» автоматически, когда оплачено столько заявок, сколько заказано (то есть вы проверили и оплатили все отчёты на SocPublic). Менять эти значения обычно не нужно.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {keyFields.map(([key, title]) => (
              <div key={key} className="min-w-0">
                <label className={label}>{title}</label>
                <input value={String(form[key])} onChange={(event) => set(key, event.target.value as never)} className={`${inputClass} !text-xs`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary inline-flex items-center gap-2 !px-7 !py-3 text-sm disabled:opacity-60">
          {saving ? <Spinner /> : <Icon name="check" />} Сохранить настройки
        </button>
      </div>
    </div>
  );
}
