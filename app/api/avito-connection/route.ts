import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { encryptAvitoSecret } from "@/lib/avito-credentials";

export const runtime = "nodejs";

function hasBidderAccess(level: string | null | undefined) {
  return level === "basic" || level === "admin";
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function maskClientId(clientId: string) {
  if (clientId.length <= 4) {
    return "••••";
  }

  if (clientId.length <= 8) {
    return `${clientId.slice(0, 2)}••••${clientId.slice(-2)}`;
  }

  return `${clientId.slice(0, 4)}••••${clientId.slice(-4)}`;
}

function serializeConnection(connection: {
  id: number;
  clientId: string;
  tokenExpiresAt: Date | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    clientIdMasked: maskClientId(connection.clientId),
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
    lastError: connection.lastError,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

async function getAuthorizedUser() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      error: NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      subscriptionLevel: true,
    },
  });

  if (!user || !hasBidderAccess(user.subscriptionLevel)) {
    return {
      error: NextResponse.json(
        { error: "Подключение Авито доступно с подпиской Basic" },
        { status: 403 },
      ),
    };
  }

  return { user };
}

async function requestAvitoToken(clientId: string, clientSecret: string) {
  const formData = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  let response: Response;

    try {
    response = await fetch("https://api.avito.ru/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("Avito OAuth request failed:", error);

    const details =
      error instanceof Error && error.message
        ? ` Техническая причина: ${error.message}`
        : "";

    throw new Error(
      `Не удалось связаться с API Авито.${details}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: unknown;
        expires_in?: unknown;
        error_description?: unknown;
        error?: unknown;
      }
    | null;

  if (!response.ok || !payload || typeof payload.access_token !== "string") {
    const avitoError =
      typeof payload?.error_description === "string"
        ? payload.error_description
        : typeof payload?.error === "string"
          ? payload.error
          : null;

    throw new Error(
      avitoError
        ? `Авито отклонило данные подключения: ${avitoError}`
        : "Авито отклонило Client ID или Client Secret. Проверьте введённые данные.",
    );
  }

  const expiresInSeconds =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 24 * 60 * 60;

  return {
    tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}

export async function GET() {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  const connection = await prisma.avitoAccountConnection.findUnique({
    where: {
      userId: authorization.user.id,
    },
  });

  return NextResponse.json({
    connection: connection ? serializeConnection(connection) : null,
  });
}

export async function POST(request: Request) {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  let body: {
    clientId?: unknown;
    clientSecret?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат данных." },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.clientId, 300)) {
    return NextResponse.json(
      { error: "Укажите корректный Client ID." },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.clientSecret, 500)) {
    return NextResponse.json(
      { error: "Укажите корректный Client Secret." },
      { status: 400 },
    );
  }

  const clientId = body.clientId.trim();
  const clientSecret = body.clientSecret.trim();

  try {
    const { tokenExpiresAt } = await requestAvitoToken(
      clientId,
      clientSecret,
    );

    const connection = await prisma.avitoAccountConnection.upsert({
      where: {
        userId: authorization.user.id,
      },
      create: {
        userId: authorization.user.id,
        clientId,
        encryptedClientSecret: encryptAvitoSecret(clientSecret),
        tokenExpiresAt,
        lastCheckedAt: new Date(),
        lastError: null,
      },
      update: {
        clientId,
        encryptedClientSecret: encryptAvitoSecret(clientSecret),
        tokenExpiresAt,
        lastCheckedAt: new Date(),
        lastError: null,
      },
    });

    return NextResponse.json(
      {
        connection: serializeConnection(connection),
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось подключить аккаунт Авито.";

        await prisma.avitoAccountConnection
      .updateMany({
        where: {
          userId: authorization.user.id,
        },
        data: {
          lastCheckedAt: new Date(),
          lastError: message,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const authorization = await getAuthorizedUser();

  if ("error" in authorization) {
    return authorization.error;
  }

  await prisma.avitoAccountConnection.deleteMany({
    where: {
      userId: authorization.user.id,
    },
  });

  return NextResponse.json({ success: true });
}