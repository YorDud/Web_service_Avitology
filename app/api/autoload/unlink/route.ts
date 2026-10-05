import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  detachOurFeeds,
  feedScope,
  publicBaseUrl,
  readClientKey,
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
 * Работает с выбранным аккаунтом (основным или клиентом) — таблицы других аккаунтов не трогает.
 * Ключи Авито основного аккаунта (AvitoAccountConnection) НЕ трогает — это тот же аккаунт,
 * что и в Бид-менеджере Авито; полное отключение ключей делается на странице Бид-менеджера
 * («Кабинет Авито» → «Отключить»). Клиента целиком удаляют через /api/autoload/clients/[id].
 */
export async function POST(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id, readClientKey(request));
  if (!account) return response;

  try {
    const scope = { userId: auth.user.id, ...feedScope(account) };
    const feeds = await prisma.autoloadFeed.findMany({ where: scope });
    if (feeds.some((feed) => feed.linked)) {
      await detachOurFeeds(account, publicBaseUrl(request));
    }
    await prisma.autoloadFeed.updateMany({ where: scope, data: { linked: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
