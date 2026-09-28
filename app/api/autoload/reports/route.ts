import { NextResponse } from "next/server";
import { avito } from "@/lib/autoload/avito";
import {
  normalizeUpload,
  requireAccount,
  requireAutoloadUser,
  routeError,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Последняя завершённая загрузка (/autoload/v4/uploads/last_successful),
 * текущая загрузка, если она ещё идёт (/autoload/v4/uploads/current),
 * и история загрузок (/autoload/v4/uploads). Методы v2/v3 (report_id-based)
 * у Авито помечены deprecated и не используются.
 */
export async function GET() {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    const [lastResult, currentResult, listResult] = await Promise.allSettled([
      avito.lastSuccessfulUpload(account),
      avito.currentUpload(account),
      avito.uploads(account, { perPage: 10, page: 1 }),
    ]);

    if (lastResult.status === "rejected" && listResult.status === "rejected") {
      throw lastResult.reason;
    }

    const rawList = listResult.status === "fulfilled" ? (listResult.value?.uploads ?? []) : [];

    return NextResponse.json({
      last: lastResult.status === "fulfilled" && lastResult.value ? normalizeUpload(lastResult.value) : null,
      current: currentResult.status === "fulfilled" && currentResult.value ? normalizeUpload(currentResult.value) : null,
      uploads: (rawList as unknown[]).map((item) => normalizeUpload(item)).filter((item) => item.id),
    });
  } catch (error) {
    return routeError(error);
  }
}
