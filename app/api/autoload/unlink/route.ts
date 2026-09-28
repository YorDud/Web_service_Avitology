import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyProfile,
  publicBaseUrl,
  requireAccount,
  requireAutoloadUser,
  routeError,
} from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Отключить автозагрузку»: убирает файлы HelpSell из профиля автозагрузки
 * Авито (feeds_data) и снимает флаг linked со всех таблиц пользователя.
 *
 * Ключи Авито (client_id/client_secret в AvitoAccountConnection) НЕ трогает —
 * это тот же аккаунт, что и в Бид-менеджере Авито; полное отключение ключей
 * делается на странице Бид-менеджера («Кабинет Авито» → «Отключить»).
 */
export async function POST(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    const feeds = await prisma.autoloadFeed.findMany({ where: { userId: auth.user.id } });
    if (feeds.some((feed) => feed.linked)) {
      await applyProfile(account, [], publicBaseUrl(request));
    }
    await prisma.autoloadFeed.updateMany({ where: { userId: auth.user.id }, data: { linked: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
