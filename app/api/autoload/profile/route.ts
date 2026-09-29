import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { avito } from "@/lib/autoload/avito";
import {
  applyProfile,
  fail,
  mapProfile,
  parseSchedule,
  publicBaseUrl,
  requireAccount,
  requireAutoloadUser,
  routeError,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Текущий профиль автозагрузки из Авито. */
export async function GET() {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    const raw = await avito.getProfile(account);
    return NextResponse.json({ profile: mapProfile(raw), raw });
  } catch (error) {
    return routeError(error);
  }
}

/** Сохранение расписания, почты для отчётов и включения автозагрузки. */
export async function POST(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Пустой запрос.");

  const schedule = body.schedule === undefined ? undefined : parseSchedule(body.schedule);
  if (schedule === null) {
    return fail("Проверьте расписание: выберите дни, часы и количество объявлений в каждом правиле.");
  }

  try {
    const feeds = await prisma.autoloadFeed.findMany({ where: { userId: auth.user.id } });
    const profile = await applyProfile(account, feeds, publicBaseUrl(request), {
      autoloadEnabled: typeof body.autoloadEnabled === "boolean" ? body.autoloadEnabled : undefined,
      reportEmail: typeof body.reportEmail === "string" ? body.reportEmail : undefined,
      schedule,
      agreement: body.agreement === true ? true : undefined,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return routeError(error);
  }
}
