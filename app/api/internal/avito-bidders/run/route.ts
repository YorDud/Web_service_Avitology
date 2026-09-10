import { NextResponse } from "next/server";
import { runDueBidders } from "@/lib/avito-bidder-runner";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET не настроен на сервере." },
      { status: 500 },
    );
  }

  const token = getBearerToken(request);

  if (!token || token !== expectedSecret) {
    return NextResponse.json(
      { error: "Недостаточно прав для запуска worker." },
      { status: 401 },
    );
  }

  try {
    const result = await runDueBidders({
      limit: 100,
    });

    return NextResponse.json({
      mode: "internal-cron",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось выполнить автоматический цикл обработки бидеров.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}