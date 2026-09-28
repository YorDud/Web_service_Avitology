import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import type { AutoloadFeed, AvitoAccountConnection } from "@prisma/client";
import { avito, AvitoApiError, markAvitoError } from "./avito";
import { choosePickSource } from "./pick";
import {
  MAX_FIELD_OPTION_VALUES,
  MAX_VALUE_LENGTH,
  isValidTagPath,
  type AdData,
} from "./fields";
import type {
  CatalogField,
  CatalogNode,
  FeedSettings,
  FeedSummary,
  ProfileDto,
  ReportSummary,
  ScheduleRule,
} from "./types";

/* Общие серверные помощники для API автозагрузки. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export const FEED_PATH_MARK = "/api/autoload/feed/";

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Автозагрузка доступна с подпиской Pro (и администраторам). */
export async function requireAutoloadUser() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { ok: false as const, response: fail("Войдите в аккаунт HelpSell.", 401) };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, subscriptionLevel: true },
  });
  if (!user) {
    return { ok: false as const, response: fail("Войдите в аккаунт HelpSell.", 401) };
  }

  const level = String(user.subscriptionLevel ?? "").toLowerCase();
  if (level !== "pro" && level !== "admin") {
    return {
      ok: false as const,
      response: fail("Автозагрузка доступна с подпиской Pro.", 403, { code: "PRO_REQUIRED" }),
    };
  }

  return { ok: true as const, user };
}

export function isProLevel(level: string | null | undefined) {
  const value = String(level ?? "").toLowerCase();
  return value === "pro" || value === "admin";
}

export function routeError(error: unknown) {
  if (error instanceof AvitoApiError) {
    const upstream = error.status >= 500 || error.status === 429;
    return fail(error.message, upstream ? 502 : 400, { avitoStatus: error.status });
  }
  console.error("[autoload]", error);
  const message =
    error instanceof Error && error.message ? error.message : "Внутренняя ошибка сервера.";
  return fail(message, 500);
}

/* ---------- Подключение Авито ----------
   Общее для Бид-менеджера и Автозагрузки: одна таблица AvitoAccountConnection,
   одни и те же ключи client_id/client_secret на пользователя. */

export async function getConnection(userId: number) {
  return prisma.avitoAccountConnection.findUnique({ where: { userId } });
}

export async function requireConnection(userId: number) {
  const connection = await getConnection(userId);
  if (!connection) {
    return {
      connection: null,
      response: fail(
        "Сначала подключите Avito API: укажите client_id и client_secret (это тот же ключ, что и в Бид-менеджере).",
        400,
        { code: "NO_ACCOUNT" },
      ),
    };
  }
  return { connection, response: null };
}

export async function withAvito<T>(connection: AvitoAccountConnection, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await markAvitoError(connection, error);
    throw error;
  }
}

export async function getAccount(userId: number) {
  return getConnection(userId);
}

/** requireAccount — то же самое, что requireConnection, но с именем поля account
 *  (так исторически называлось в API-роутах). Реализован отдельно, а не через
 *  прокидывание результата requireConnection: пересборка объекта после
 *  деструктуризации «расклеивает» связь между полями account/response для
 *  TypeScript (он перестаёт видеть, что response не может быть null, когда
 *  account есть), из-за чего Next.js считает, что обработчик роута может
 *  вернуть null, и билд падает с ошибкой типов. */
export async function requireAccount(userId: number) {
  const account = await getConnection(userId);
  if (!account) {
    return {
      account: null,
      response: fail(
        "Сначала подключите Avito API: укажите client_id и client_secret (это тот же ключ, что и в Бид-менеджере).",
        400,
        { code: "NO_ACCOUNT" },
      ),
    };
  }
  return { account, response: null };
}

/* ---------- Публичный адрес файла ---------- */

export function publicBaseUrl(request: Request) {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const headers = request.headers;
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (host) {
    const proto = headers.get("x-forwarded-proto")?.split(",")[0] || "https";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export function feedUrl(base: string, token: string) {
  return `${base}${FEED_PATH_MARK}${token}.xml`;
}

type FeedWithCount = AutoloadFeed & { _count?: { ads: number } };

export function serializeFeed(feed: FeedWithCount, base: string): FeedSummary {
  return {
    id: feed.id,
    name: feed.name,
    publicUrl: feedUrl(base, feed.publicToken),
    linked: feed.linked,
    adsCount: feed._count?.ads ?? 0,
    lastFetchedAt: feed.lastFetchedAt ? feed.lastFetchedAt.toISOString() : null,
    fetchCount: feed.fetchCount,
    createdAt: feed.createdAt.toISOString(),
    updatedAt: feed.updatedAt.toISOString(),
  };
}

/* ---------- Профиль автозагрузки (/autoload/v2/profile) ---------- */

export function mapProfile(raw: Json | null): ProfileDto {
  if (!raw) {
    return { exists: false, autoloadEnabled: false, reportEmail: "", schedule: [], feeds: [] };
  }

  // С 23.12.2024 Авито отдаёт feeds_data вместо одиночного upload_url.
  const feedsRaw: Json[] = Array.isArray(raw.feeds_data)
    ? raw.feeds_data
    : raw.upload_url
      ? [{ feed_name: "Основной файл", feed_url: raw.upload_url }]
      : [];

  return {
    exists: true,
    autoloadEnabled: Boolean(raw.autoload_enabled),
    reportEmail: typeof raw.report_email === "string" ? raw.report_email : "",
    schedule: Array.isArray(raw.schedule)
      ? raw.schedule.map((rule: Json) => ({
          rate: Number(rule?.rate) || 0,
          weekdays: Array.isArray(rule?.weekdays) ? rule.weekdays.map(Number) : [],
          time_slots: Array.isArray(rule?.time_slots) ? rule.time_slots.map(Number) : [],
        }))
      : [],
    feeds: feedsRaw.map((item) => {
      const url = String(item?.feed_url ?? item?.url ?? "");
      return {
        name: String(item?.feed_name ?? item?.name ?? "Без названия"),
        url,
        ours: url.includes(FEED_PATH_MARK),
      };
    }),
  };
}

export function parseSchedule(input: unknown): ScheduleRule[] | null {
  if (!Array.isArray(input)) return null;
  const result: ScheduleRule[] = [];

  for (const item of input) {
    const rule = item as Partial<ScheduleRule> | null;
    if (!rule || typeof rule !== "object") return null;

    const weekdays = Array.isArray(rule.weekdays) ? rule.weekdays.map(Number) : [];
    const slots = Array.isArray(rule.time_slots) ? rule.time_slots.map(Number) : [];
    const rate = Math.round(Number(rule.rate));

    const validDays = weekdays.length > 0 && weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    const validSlots = slots.length > 0 && slots.every((h) => Number.isInteger(h) && h >= 0 && h <= 23);
    if (!validDays || !validSlots || !Number.isFinite(rate) || rate < 1 || rate > 1_000_000) return null;

    result.push({
      rate,
      weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
      time_slots: [...new Set(slots)].sort((a, b) => a - b),
    });
  }

  return result;
}

type ProfilePatch = {
  autoloadEnabled?: boolean;
  reportEmail?: string;
  schedule?: ScheduleRule[];
  agreement?: boolean;
};

/**
 * Записывает профиль автозагрузки в Авито (POST /autoload/v2/profile).
 * Фиды HelpSell (linked = true) добавляются в feeds_data, а файлы, уже
 * подключённые вручную в кабинете Авито (или из другого сервиса), остаются.
 */
export async function applyProfile(
  connection: AvitoAccountConnection,
  feeds: AutoloadFeed[],
  base: string,
  patch: ProfilePatch = {},
) {
  const existing = await avito.getProfile(connection);
  const current = mapProfile(existing);

  const foreign = current.feeds
    .filter((feed) => !feed.ours)
    .map((feed) => ({ feed_name: feed.name, feed_url: feed.url }));
  const ours = feeds
    .filter((feed) => feed.linked)
    .map((feed) => ({ feed_name: feed.name, feed_url: feedUrl(base, feed.publicToken) }));
  const feedsData = [...foreign, ...ours];

  const reportEmail = (patch.reportEmail ?? current.reportEmail).trim();
  const schedule = patch.schedule ?? current.schedule;
  const enabled = patch.autoloadEnabled ?? current.autoloadEnabled;

  if (!reportEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportEmail)) {
    throw new AvitoApiError("Укажите email для отчётов Авито.", 400);
  }
  if (schedule.length === 0) {
    throw new AvitoApiError("Добавьте хотя бы одно правило расписания.", 400);
  }
  if (!existing && patch.agreement !== true) {
    throw new AvitoApiError(
      "Чтобы создать профиль автозагрузки, примите условия использования Автозагрузки Авито.",
      400,
    );
  }
  if (enabled && feedsData.length === 0) {
    throw new AvitoApiError("Подключите хотя бы одну таблицу, прежде чем включать автозагрузку.", 400);
  }

  const body: Record<string, unknown> = {
    autoload_enabled: enabled,
    report_email: reportEmail,
    schedule,
    feeds_data: feedsData,
  };
  if (patch.agreement === true) body.agreement = true;

  await avito.saveProfile(connection, body);
  return mapProfile(await avito.getProfile(connection));
}

/* ---------- Загрузки (/autoload/v4/uploads/...) ----------
   Отчёты v2/v3 у Авито помечены deprecated — используем только v4. */

function normalizeSections(stats: Json): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  if (typeof stats?.count === "number") out.push({ label: "Всего обработано", value: stats.count });
  for (const section of Array.isArray(stats?.sections) ? stats.sections : []) {
    const value = Number(section?.count);
    const label = String(section?.title ?? section?.slug ?? "");
    if (label && Number.isFinite(value)) out.push({ label, value });
  }
  return out;
}

export function normalizeUpload(raw: Json): ReportSummary {
  return {
    id: String(raw?.upload_id ?? ""),
    status: String(raw?.status ?? "unknown"),
    source: typeof raw?.source === "string" ? raw.source : null,
    startedAt: raw?.started_at ?? null,
    counts: normalizeSections(raw?.stats),
    events: (Array.isArray(raw?.events) ? raw.events : []).map((event: Json) => ({
      type: String(event?.type ?? ""),
      description: String(event?.description ?? ""),
    })),
  };
}

export type UploadPick = {
  /** Откуда брать объявления загрузки: /uploads/current/items или /uploads/last_successful/items. */
  which: "current" | "last";
  upload: ReportSummary;
  /** Самая свежая загрузка из истории (может отличаться от upload, если Авито ещё не обновил current/last_successful). */
  latest: ReportSummary | null;
  /** true — данные по самой свежей загрузке у Авито ещё не готовы, показана предыдущая. */
  stale: boolean;
};

/** Новее — выше: история у Авито «самая свежая в начале», но на всякий случай сортируем сами. */
export function sortUploadsNewestFirst<T extends { started_at?: unknown; upload_id?: unknown }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ta = Date.parse(String(a.started_at ?? "")) || 0;
    const tb = Date.parse(String(b.started_at ?? "")) || 0;
    return tb - ta || Number(b.upload_id ?? 0) - Number(a.upload_id ?? 0);
  });
}

/**
 * Какую загрузку показывать. «last_successful» у Авито может отставать (в документации:
 * «для самой последней загрузки возможны задержки»), поэтому ориентируемся на историю:
 * берём самую свежую и подбираем к ней items из current или last_successful.
 */
export async function pickUpload(connection: AvitoAccountConnection): Promise<UploadPick | null> {
  const [historyR, currentR, lastR] = await Promise.allSettled([
    avito.uploads(connection, { perPage: 5, page: 1 }),
    avito.currentUpload(connection),
    avito.lastSuccessfulUpload(connection),
  ]);
  if (historyR.status === "rejected" && currentR.status === "rejected" && lastR.status === "rejected") {
    throw currentR.reason;
  }

  const history = historyR.status === "fulfilled" && Array.isArray(historyR.value?.uploads) ? sortUploadsNewestFirst(historyR.value.uploads as Json[]) : [];
  const latestRaw: Json | null = history[0] ?? null;
  const current: Json | null = currentR.status === "fulfilled" ? currentR.value : null;
  const last: Json | null = lastR.status === "fulfilled" ? lastR.value : null;

  const choice = choosePickSource(latestRaw, current, last);
  if (!choice) return null;

  return {
    which: choice.which,
    upload: normalizeUpload(choice.raw),
    latest: latestRaw ? normalizeUpload(latestRaw) : null,
    stale: choice.stale,
  };
}

/* ---------- Каталог категорий (/autoload/v1/user-docs/...) ---------- */

type RawCategoryNode = { name?: string; slug?: string; nested?: Record<string, RawCategoryNode[]>[] };

function walkCatalog(nodes: RawCategoryNode[] | undefined, parents: string[], out: CatalogNode[], group: string | null = null) {
  for (const node of nodes ?? []) {
    const name = typeof node?.name === "string" ? node.name : null;
    if (!name) continue;
    const path = [...parents, name];
    out.push({ slug: typeof node.slug === "string" ? node.slug : null, name, path: path.join(" › "), group });

    for (const groupMap of Array.isArray(node.nested) ? node.nested : []) {
      if (!groupMap || typeof groupMap !== "object") continue;
      // Ключ группы — промежуточный раздел (например «Аудио и видео»): показываем его в пути,
      // чтобы по нему можно было искать, и запоминаем как группу для вложенных пунктов.
      for (const [groupName, children] of Object.entries(groupMap)) {
        if (!Array.isArray(children)) continue;
        const label = groupName.trim();
        const useLabel = label && label !== name ? label : null;
        walkCatalog(children, useLabel ? [...path, useLabel] : path, out, useLabel);
      }
    }
  }
}

/** Дерево категорий Авито (GET /autoload/v1/user-docs/tree) плоским списком. */
export function flattenCatalog(raw: Json): CatalogNode[] {
  const out: CatalogNode[] = [];
  walkCatalog(raw?.categories, [], out);
  return out.slice(0, 6000);
}

function collectFieldValues(contents: Json[]): string[] {
  const values = new Set<string>();
  for (const content of contents) {
    for (const item of Array.isArray(content?.values) ? content.values : []) {
      const value = typeof item?.value === "string" ? item.value : "";
      if (value) values.add(value);
    }
  }
  return [...values].slice(0, 200);
}

/** Поля категории (GET /autoload/v1/user-docs/node/{slug}/fields). */
export function parseCatalogFields(raw: Json): CatalogField[] {
  const out: CatalogField[] = [];

  const visit = (list: Json[] | undefined) => {
    for (const field of list ?? []) {
      const tag = typeof field?.tag === "string" ? field.tag.trim() : "";
      if (tag) {
        const contents: Json[] = Array.isArray(field?.content) ? field.content : [];
        const conditionTexts: string[] = contents.flatMap((content) =>
          Array.isArray(content?.dependencies_text) ? content.dependencies_text.filter((t: unknown) => typeof t === "string") : [],
        );
        out.push({
          tag,
          label: String(field?.label ?? field?.descriptions ?? tag),
          description: typeof field?.descriptions === "string" ? field.descriptions : "",
          required: contents.some((content) => content?.required === true),
          conditional: contents.some((content) => content?.required_by_dependency === true),
          condition: [...new Set(conditionTexts)].join("; ").slice(0, 300),
          values: collectFieldValues(contents),
        });
      }
      if (Array.isArray(field?.children)) visit(field.children);
    }
  };

  visit(raw?.fields);
  return out;
}

/* ---------- Проверка входных данных ---------- */

export function sanitizeData(input: unknown): AdData {
  const result: AdData = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;

  for (const [tag, value] of Object.entries(input as Record<string, unknown>)) {
    if (tag === "Id" || !isValidTagPath(tag)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
    if (trimmed) result[tag] = trimmed;
  }
  return result;
}

export function sanitizeSettings(input: unknown): FeedSettings {
  if (!input || typeof input !== "object") return {};
  const raw = input as FeedSettings;
  const result: FeedSettings = {};

  if (Array.isArray(raw.columns)) {
    const unique = [...new Set(raw.columns.filter((tag): tag is string => typeof tag === "string"))];
    const columns = unique.filter((tag) => tag === "Id" || isValidTagPath(tag)).slice(0, 40);
    if (columns.length > 0) result.columns = columns;
  }

  if (raw.fieldOptions && typeof raw.fieldOptions === "object" && !Array.isArray(raw.fieldOptions)) {
    const fieldOptions: Record<string, string[]> = {};
    for (const [tag, values] of Object.entries(raw.fieldOptions)) {
      if (!isValidTagPath(tag) || !Array.isArray(values)) continue;
      const clean = [...new Set(values.filter((v): v is string => typeof v === "string" && v.trim() !== ""))]
        .map((v) => v.slice(0, 200))
        .slice(0, MAX_FIELD_OPTION_VALUES);
      if (clean.length > 0) fieldOptions[tag] = clean;
    }
    if (Object.keys(fieldOptions).length > 0) result.fieldOptions = fieldOptions;
  }

  return result;
}

export function stableStringify(data: AdData) {
  return JSON.stringify(Object.keys(data).sort().map((key) => [key, data[key]]));
}

export function parseFeedId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function readDefaults(feed: { defaults: unknown }): AdData {
  return sanitizeData(feed.defaults);
}

export function readSettings(feed: { settings: unknown }): FeedSettings {
  return sanitizeSettings(feed.settings);
}
