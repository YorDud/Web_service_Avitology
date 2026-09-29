import { NextResponse } from "next/server";
import { avito } from "@/lib/autoload/avito";
import {
  isStaleProcessing,
  normalizeUpload,
  requireAccount,
  requireAutoloadUser,
  routeError,
  sortUploadsNewestFirst,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * История загрузок (/autoload/v4/uploads) — главный источник: «самая свежая в начале».
 * «Последняя завершённая» и «идёт сейчас» вычисляем из неё, а не берём из /last_successful:
 * тот метод у Авито может отставать и показывать более старую загрузку, чем есть на самом деле.
 * Если история недоступна — запасной вариант через /last_successful и /current.
 */
export async function GET() {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    const [historyR, lastR, currentR] = await Promise.allSettled([
      avito.uploads(account, { perPage: 15, page: 1 }),
      avito.lastSuccessfulUpload(account),
      avito.currentUpload(account),
    ]);

    if (historyR.status === "rejected" && lastR.status === "rejected") throw historyR.reason;

    const rawHistory =
      historyR.status === "fulfilled" && Array.isArray(historyR.value?.uploads) ? sortUploadsNewestFirst(historyR.value.uploads as Record<string, unknown>[]) : [];
    const uploads = rawHistory.map((item) => normalizeUpload(item)).filter((item) => item.id);

    // Если Авито надолго завис в «processing» (см. isStaleProcessing) — не показываем
    // это как текущую загрузку, а считаем, что она на самом деле уже завершилась.
    const rawCurrentFromHistory = rawHistory.find((item) => String(item.status) === "processing") ?? null;
    let current = isStaleProcessing(rawCurrentFromHistory) ? null : uploads.find((item) => item.status === "processing") ?? null;
    let last = uploads.find((item) => item.status !== "processing") ?? null;

    if (uploads.length === 0) {
      // история пуста или недоступна — запасной путь
      if (lastR.status === "fulfilled" && lastR.value) last = normalizeUpload(lastR.value);
      if (currentR.status === "fulfilled" && currentR.value) {
        const candidate = normalizeUpload(currentR.value);
        if (candidate.status === "processing") current = candidate;
        else if (!last || Number(candidate.id) > Number(last.id)) last = candidate;
      }
    }

    return NextResponse.json({ last, current, uploads });
  } catch (error) {
    return routeError(error);
  }
}
