import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptAvitoSecret } from "@/lib/avito-credentials";
import { requestToken } from "@/lib/autoload/avito";
import { MAX_CLIENT_NAME_LENGTH } from "@/lib/autoload/clients-plan";
import {
  credentialsFromClient,
  detachOurFeeds,
  fail,
  parseFeedId,
  publicBaseUrl,
  requireAutoloadUser,
  routeError,
} from "@/lib/autoload/server";
import { serializeClient } from "@/lib/autoload/clients-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Переименование клиента и/или замена его ключей Авито. */
export async function PATCH(request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const id = parseFeedId((await context.params).id);
  if (!id) return fail("Клиент не найден.", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Пустой запрос.");

  try {
    const existing = await prisma.autoloadClient.findFirst({ where: { id, userId: auth.user.id } });
    if (!existing) return fail("Клиент не найден.", 404);

    const data: {
      name?: string;
      clientId?: string;
      encryptedClientSecret?: string;
      accessTokenEnc?: string | null;
      tokenExpiresAt?: Date | null;
      lastCheckedAt?: Date;
      lastError?: string | null;
    } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return fail("Название клиента не может быть пустым.");
      if (name.length > MAX_CLIENT_NAME_LENGTH) return fail(`Название клиента — не длиннее ${MAX_CLIENT_NAME_LENGTH} символов.`);
      data.name = name;
    }

    const wantsKeys = body.clientId !== undefined || body.clientSecret !== undefined;
    if (wantsKeys) {
      const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
      const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : "";
      if (clientId.length < 6 || clientId.length > 300) return fail("Укажите корректный Client ID.");
      if (clientSecret.length < 6 || clientSecret.length > 500) return fail("Укажите корректный Client Secret.");

      if (clientId !== existing.clientId) {
        const [other, main] = await Promise.all([
          prisma.autoloadClient.findFirst({ where: { userId: auth.user.id, clientId, NOT: { id } }, select: { name: true } }),
          prisma.avitoAccountConnection.findUnique({ where: { userId: auth.user.id }, select: { clientId: true } }),
        ]);
        if (main && main.clientId === clientId) return fail("Этот аккаунт Авито уже подключён как основной.");
        if (other) return fail(`Этот аккаунт Авито уже добавлен как клиент «${other.name}».`);
      }

      const { expiresIn } = await requestToken(clientId, clientSecret);
      data.clientId = clientId;
      data.encryptedClientSecret = encryptAvitoSecret(clientSecret);
      data.accessTokenEnc = null; // старый токен относился к прежним ключам
      data.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
      data.lastCheckedAt = new Date();
      data.lastError = null;
    }

    if (Object.keys(data).length === 0) return fail("Нечего сохранять.");

    const updated = await prisma.autoloadClient.update({
      where: { id },
      data,
      include: { _count: { select: { feeds: true } } },
    });
    return NextResponse.json({ client: serializeClient(updated) });
  } catch (error) {
    return routeError(error);
  }
}

/**
 * Удаление клиента вместе с его таблицами и объявлениями. Перед этим ссылки на файлы HelpSell
 * убираются из профиля автозагрузки этого аккаунта Авито (если Авито сейчас недоступен или
 * ключи уже отозваны — клиент всё равно удаляется, а в ответе detached = false).
 * Слот при этом освобождается и его можно занять другим клиентом.
 */
export async function DELETE(request: Request, context: Context) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const id = parseFeedId((await context.params).id);
  if (!id) return fail("Клиент не найден.", 404);

  try {
    const client = await prisma.autoloadClient.findFirst({
      where: { id, userId: auth.user.id },
      include: { feeds: { select: { linked: true } } },
    });
    if (!client) return fail("Клиент не найден.", 404);

    let detached = true;
    if (client.feeds.some((feed) => feed.linked)) {
      try {
        await detachOurFeeds(credentialsFromClient(client), publicBaseUrl(request));
      } catch {
        detached = false;
      }
    }

    await prisma.autoloadClient.delete({ where: { id } });
    return NextResponse.json({ ok: true, detached });
  } catch (error) {
    return routeError(error);
  }
}
