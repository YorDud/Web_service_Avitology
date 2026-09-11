import { NextResponse } from "next/server";
import { runProductionBidderWorker } from "@/lib/avito-bidder-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      ok: false,
      reason:
        "CRON_SECRET не задан. Production worker нельзя запускать без секрета.",
    };
  }

  const authorization = request.headers.get("authorization");
  const receivedBearer = authorization?.replace(/^Bearer\s+/i, "").trim();
  const receivedHeader = request.headers.get("x-cron-secret")?.trim();

  return {
    ok:
      receivedBearer === cronSecret ||
      receivedHeader === cronSecret,
    reason: "Некорректный секрет cron worker.",
  };
}

async function handleWorkerRequest(request: Request) {
  const authorization = isAuthorized(request);

  if (!authorization.ok) {
    return NextResponse.json(
      {
        error: authorization.reason,
      },
      { status: 401 },
    );
  }

  const result = await runProductionBidderWorker({
    source: "cron",
    limit: 100,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        result,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    result,
  });
}

/**
 * Подходит для Vercel Cron:
 * GET /api/internal/bidder-worker
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  return handleWorkerRequest(request);
}

/**
 * Удобно для внешнего cron / Postman / Thunder Client.
 */
export async function POST(request: Request) {
  return handleWorkerRequest(request);
}