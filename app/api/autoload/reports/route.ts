import { NextResponse } from "next/server";
import { avito, AvitoApiError } from "@/lib/autoload/avito";
import {
  isStaleProcessing,
  normalizeUpload,
  requireAccount,
  requireAutoloadUser,
  routeError,
  sortUploadsNewestFirst,
} from "@/lib/autoload/server";
import type { ReportSummary } from "@/lib/autoload/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedReports = { last: ReportSummary | null; current: ReportSummary | null; uploads: ReportSummary[] };

/**
 * Короткий кэш в памяти сервера: сколько бы вкладок или таймеров ни опрашивали этот
 * роут одновременно, сам Авито дёргается не чаще раза в CACHE_TTL_MS — это и есть
 * главная защита от «слишком много запросов к API Авито».
 */
const CACHE_TTL_MS = 15_000;
const cache = new Map<number, { at: number; data: CachedReports }>();

/**
 * История загрузок (/autoload/v4/uploads) — единственный запрос к Авито в обычном
 * случае: она уже содержит и «текущую», и «последнюю завершённую» загрузку. Отдельные
 * методы /last_successful и /current дёргаем, только если сама история пуста или
 * недоступна — так расход лимита на этот раздел меньше в 3 раза по сравнению с тем,
 * чтобы спрашивать все три метода каждый раз.
 */
export async function GET() {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  const cached = cache.get(account.id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const historyRaw = await avito.uploads(account, { perPage: 15, page: 1 });
    const rawHistory = Array.isArray(historyRaw?.uploads) ? sortUploadsNewestFirst(historyRaw.uploads as Record<string, unknown>[]) : [];
    const uploads = rawHistory.map((item) => normalizeUpload(item)).filter((item) => item.id);

    // Если Авито надолго завис в «processing» (см. isStaleProcessing) — не показываем
    // это как текущую загрузку, а считаем, что она на самом деле уже завершилась.
    const rawCurrentFromHistory = rawHistory.find((item) => String(item.status) === "processing") ?? null;
    let current = isStaleProcessing(rawCurrentFromHistory) ? null : uploads.find((item) => item.status === "processing") ?? null;
    let last = uploads.find((item) => item.status !== "processing") ?? null;

    if (uploads.length === 0) {
      // история пуста или недоступна — запасной путь двумя отдельными запросами
      const [lastR, currentR] = await Promise.allSettled([avito.lastSuccessfulUpload(account), avito.currentUpload(account)]);
      if (lastR.status === "fulfilled" && lastR.value) last = normalizeUpload(lastR.value);
      if (currentR.status === "fulfilled" && currentR.value) {
        const candidate = normalizeUpload(currentR.value);
        if (candidate.status === "processing" && !isStaleProcessing(currentR.value)) current = candidate;
        else if (!last || Number(candidate.id) > Number(last.id)) last = candidate;
      }
    }

    const data: CachedReports = { last, current, uploads };
    cache.set(account.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (error) {
    // При 429 отдаём то, что уже знаем (пусть и устаревшее), а не пустой экран с ошибкой —
    // это то самое сообщение, из-за которого разработчик обращался: теперь оно не мешает
    // видеть последний известный статус, если он есть.
    if (error instanceof AvitoApiError && error.status === 429 && cached) {
      return NextResponse.json(cached.data);
    }
    return routeError(error);
  }
}
