/* =========================================================================
   «Уровень сервиса»: общие константы и чистые функции (без серверных зависимостей —
   ими пользуются и API, и интерфейс пользователя, и админка).
   ========================================================================= */

export const SERVICE_LEVEL_PLAN_PREFIX = "service_level_order_";

/** Код платежа вида «service_level_order_42» — id заказа внутри кода. */
export function serviceLevelPlanCode(orderId: number) {
  return `${SERVICE_LEVEL_PLAN_PREFIX}${orderId}`;
}

export function parseServiceLevelPlanCode(code: string | null | undefined): number | null {
  const match = /^service_level_order_(\d{1,9})$/.exec(code ?? "");
  const id = match ? Number(match[1]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isServiceLevelPlanCode(code: string | null | undefined) {
  return parseServiceLevelPlanCode(code) !== null;
}

export type OrderStatus = "awaiting_payment" | "in_progress" | "completed" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Ожидает оплаты",
  in_progress: "В работе",
  completed: "Выполнен",
  cancelled: "Отменён",
};

export type ItemStage = "pending" | "creating" | "created" | "funding" | "funded" | "enabling" | "active" | "done" | "error";

/** Что видит пользователь вместо внутренних этапов отправки на SocPublic. */
export function userItemState(stage: string): { label: string; tone: "gray" | "amber" | "green" } {
  if (stage === "done") return { label: "Выполнено", tone: "green" };
  if (stage === "active") return { label: "Выполняется", tone: "amber" };
  return { label: "Готовится к запуску", tone: "gray" };
}

export const ITEM_STAGE_LABEL: Record<string, string> = {
  pending: "Ожидает отправки",
  creating: "Создаётся задание",
  created: "Задание создано",
  funding: "Пополняется баланс",
  funded: "Баланс пополнен",
  enabling: "Включается",
  active: "Выполняется",
  done: "Выполнено",
  error: "Ошибка",
};

export const MIN_TIERS = ["free", "basic", "pro"] as const;
export type MinTier = (typeof MIN_TIERS)[number];

export const TIER_LABEL: Record<MinTier, string> = {
  free: "Все пользователи",
  basic: "Basic и выше",
  pro: "Pro и выше",
};

/** Подходит ли тариф пользователя под минимальный тариф услуги (admin — всегда). */
export function hasTierAccess(userLevel: string | null | undefined, minTier: string | null | undefined) {
  const level = String(userLevel ?? "free").toLowerCase();
  if (level === "admin") return true;
  const rank: Record<string, number> = { free: 0, basic: 1, pro: 2 };
  return (rank[level] ?? 0) >= (rank[String(minTier ?? "free").toLowerCase()] ?? 0);
}

/* ---------- Деньги ---------- */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function formatRub(value: number) {
  const rounded = round2(value);
  const hasFraction = Math.abs(rounded - Math.round(rounded)) > 0.0001;
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rounded)} ₽`;
}

/**
 * Запас выполнений на каждую ссылку: на SocPublic уходит больше, чем заказал пользователь.
 *  - от 1 до 15 на ссылку  → +1 (заказал 15 → на SocPublic 16);
 *  - от 16 и больше        → +2 (заказал 16 → 18, 30 → 32).
 * Пользователь видит и оплачивает только своё количество.
 * Чтобы изменить правило — поменяйте числа ниже. Действует на новые заказы.
 */
export const EXTRA_QUANTITY_UP_TO_THRESHOLD = 1; // запас, если на ссылку заказано не больше порога
export const EXTRA_QUANTITY_ABOVE_THRESHOLD = 2; // запас, если заказано больше порога
export const EXTRA_QUANTITY_THRESHOLD = 15; // порог: до 15 включительно — первый запас, от 16 — второй

/** Запас для одной ссылки. */
export function extraQuantityFor(quantityPerLink: number): number {
  return quantityPerLink <= EXTRA_QUANTITY_THRESHOLD ? EXTRA_QUANTITY_UP_TO_THRESHOLD : EXTRA_QUANTITY_ABOVE_THRESHOLD;
}

/** Количество, которое уходит на SocPublic для одной ссылки. */
export function socQuantityFor(quantityPerLink: number): number {
  return quantityPerLink + extraQuantityFor(quantityPerLink);
}

export type OrderTotals = {
  totalQuantity: number;
  /** Сколько платит пользователь, целых ₽ */
  price: number;
  /** Расход на SocPublic, ₽ */
  socCost: number;
  /** Расход на SocPublic на одну ссылку, ₽ */
  socCostPerLink: number;
};

/**
 * Итоги заказа. Расход на SocPublic = выполнения × выплата исполнителю × (1 + комиссия):
 * например, 5 ₽ → 6,5 ₽ за выполнение (так же считает сам SocPublic при пополнении задания).
 */
export function computeOrderTotals(input: {
  pricePerUnit: number;
  reward: number;
  commissionPercent: number;
  linksCount: number;
  quantityPerLink: number;
}): OrderTotals {
  const totalQuantity = input.linksCount * input.quantityPerLink; // то, что видит и оплачивает пользователь
  const socPerLink = socQuantityFor(input.quantityPerLink); // то, что реально уходит на SocPublic
  const unitCost = input.reward * (1 + input.commissionPercent / 100);
  return {
    totalQuantity,
    price: Math.round(input.pricePerUnit * totalQuantity),
    socCost: round2(unitCost * socPerLink * input.linksCount),
    socCostPerLink: round2(unitCost * socPerLink),
  };
}

/* ---------- Ссылки на объявления ---------- */
export const MAX_URL_LENGTH = 500;

export function normalizeAvitoLink(raw: string): { ok: true; url: string; key: string } | { ok: false; reason: string } {
  let text = raw.trim();
  if (!text) return { ok: false, reason: "Пустая ссылка" };
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, reason: "Это не похоже на ссылку" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "Нужна ссылка вида https://…" };
  if (!/(^|\.)avito\.ru$/i.test(url.hostname)) return { ok: false, reason: "Ссылка должна вести на avito.ru" };
  if (url.pathname.replace(/\//g, "").length < 3) return { ok: false, reason: "Нужна ссылка именно на объявление, а не на главную страницу" };

  url.hash = "";
  url.protocol = "https:";
  const href = url.toString();
  if (href.length > MAX_URL_LENGTH) return { ok: false, reason: "Слишком длинная ссылка" };
  return { ok: true, url: href, key: `${url.hostname.replace(/^www\.|^m\./i, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase() };
}

export type ParsedLinks = {
  valid: { url: string; key: string }[];
  invalid: { raw: string; reason: string }[];
  duplicates: number;
};

/** Разбор текстового поля со ссылками: по одной на строку (или через пробел/запятую). */
export function parseLinks(text: string): ParsedLinks {
  const parts = text.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean);
  const seen = new Set<string>();
  const result: ParsedLinks = { valid: [], invalid: [], duplicates: 0 };
  for (const part of parts) {
    const parsed = normalizeAvitoLink(part);
    if (!parsed.ok) {
      result.invalid.push({ raw: part.length > 80 ? `${part.slice(0, 77)}…` : part, reason: parsed.reason });
      continue;
    }
    if (seen.has(parsed.key)) {
      result.duplicates += 1;
      continue;
    }
    seen.add(parsed.key);
    result.valid.push({ url: parsed.url, key: parsed.key });
  }
  return result;
}

/* ---------- Названия заданий на SocPublic ---------- */
export const MAX_TASK_NAME_LENGTH = 70;

/** Первая буква имени пользователя (строчная); если букв нет — «u». */
export function nameLetter(name: string | null | undefined) {
  const match = /[\p{L}\p{N}]/u.exec(name ?? "");
  return (match ? match[0] : "u").toLowerCase();
}

/**
 * «Легкие действия Авито ЦЕНА {letter}{n}» → «Легкие действия Авито ЦЕНА о1».
 * {n} — номер ссылки в заказе; при единственной ссылке номер можно не добавлять.
 */
export function buildTaskName(template: string, params: { letter: string; n: number; total: number; numberSingleLink: boolean }) {
  const number = params.total === 1 && !params.numberSingleLink ? "" : String(params.n);
  return template
    .replace(/\{letter\}/g, params.letter)
    .replace(/\{n\}/g, number)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TASK_NAME_LENGTH);
}

export function pluralRu(count: number, one: string, few: string, many: string) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
