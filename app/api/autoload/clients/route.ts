import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptAvitoSecret } from "@/lib/avito-credentials";
import { requestToken } from "@/lib/autoload/avito";
import { MAX_CLIENT_NAME_LENGTH } from "@/lib/autoload/clients-plan";
import { buildSlots, serializeClient } from "@/lib/autoload/clients-server";
import { fail, requireAutoloadUser, routeError } from "@/lib/autoload/server";
import type { ClientsOverview } from "@/lib/autoload/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Дополнительные клиенты пользователя и сколько слотов куплено/занято. */
export async function GET() {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  try {
    const clients = await prisma.autoloadClient.findMany({
      where: { userId: auth.user.id },
      include: { _count: { select: { feeds: true } } },
      orderBy: { createdAt: "asc" },
    });
    const overview: ClientsOverview = {
      clients: clients.map(serializeClient),
      slots: buildSlots(auth.user, clients.length),
    };
    return NextResponse.json(overview);
  } catch (error) {
    return routeError(error);
  }
}

/** Добавление клиента: название + ключи Авито. Занимает один купленный слот. */
export async function POST(request: Request) {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";

  if (name.length > MAX_CLIENT_NAME_LENGTH) return fail(`Название клиента — не длиннее ${MAX_CLIENT_NAME_LENGTH} символов.`);
  if (clientId.length < 6 || clientId.length > 300) return fail("Укажите корректный Client ID.");
  if (clientSecret.length < 6 || clientSecret.length > 500) return fail("Укажите корректный Client Secret.");

  try {
    const [existingClients, main] = await Promise.all([
      prisma.autoloadClient.findMany({ where: { userId: auth.user.id }, select: { id: true, clientId: true, name: true } }),
      prisma.avitoAccountConnection.findUnique({ where: { userId: auth.user.id }, select: { clientId: true } }),
    ]);

    const unlimited = String(auth.user.subscriptionLevel).toLowerCase() === "admin";
    if (!unlimited && existingClients.length >= auth.user.autoloadExtraClientSlots) {
      return fail("Свободных слотов для клиентов нет. Докупите слоты, чтобы добавить ещё клиентов.", 403, { code: "NO_SLOTS" });
    }

    if (main && main.clientId === clientId) {
      return fail("Этот аккаунт Авито уже подключён как основной.", 400, { code: "DUPLICATE_CLIENT" });
    }
    const duplicate = existingClients.find((item) => item.clientId === clientId);
    if (duplicate) {
      return fail(`Этот аккаунт Авито уже добавлен как клиент «${duplicate.name}».`, 400, { code: "DUPLICATE_CLIENT" });
    }

    // Проверяем ключи у самого Авито — клиент с неверными ключами не создаётся.
    const { expiresIn } = await requestToken(clientId, clientSecret);

    const finalName = (name || `Клиент ${existingClients.length + 1}`).slice(0, MAX_CLIENT_NAME_LENGTH);
    const created = await prisma.autoloadClient.create({
      data: {
        userId: auth.user.id,
        name: finalName,
        clientId,
        encryptedClientSecret: encryptAvitoSecret(clientSecret),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        lastCheckedAt: new Date(),
        lastError: null,
      },
      include: { _count: { select: { feeds: true } } },
    });

    return NextResponse.json({ client: serializeClient(created) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
