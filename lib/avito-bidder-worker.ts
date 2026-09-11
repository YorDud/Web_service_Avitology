import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { runDueBidders } from "@/lib/avito-bidder-runner";

const LOCK_ID = "avito-bidder-worker-global-lock";
const DEFAULT_LOCK_MINUTES = 12;

type WorkerSource = "cron" | "manual" | "internal";

export type BidderWorkerExecutionResult =
  | { ok: true; skippedBecauseLocked: false; runId: number; token: string; source: WorkerSource; startedAt: string; finishedAt: string; total: number; processed: number; skipped: number; failed: number; dryRunProcessed: number; liveProcessed: number; message: string }
  | { ok: true; skippedBecauseLocked: true; source: WorkerSource; message: string; lockedUntil: string | null }
  | { ok: false; skippedBecauseLocked: false; runId: number | null; token: string; source: WorkerSource; message: string };

function getLockUntil() {
  return new Date(Date.now() + DEFAULT_LOCK_MINUTES * 60 * 1000);
}

async function acquireWorkerLock(token: string) {
  const now = new Date();
  const lockedUntil = getLockUntil();
  try {
    await prisma.bidderWorkerLock.create({ data: { id: LOCK_ID, token, lockedUntil } });
    return { acquired: true as const, lockedUntil };
  } catch {
    const replaced = await prisma.bidderWorkerLock.updateMany({
      where: { id: LOCK_ID, lockedUntil: { lte: now } },
      data: { token, lockedUntil },
    });
    if (replaced.count === 1) return { acquired: true as const, lockedUntil };
    const activeLock = await prisma.bidderWorkerLock.findUnique({ where: { id: LOCK_ID }, select: { lockedUntil: true } });
    return { acquired: false as const, lockedUntil: activeLock?.lockedUntil ?? null };
  }
}

async function releaseWorkerLock(token: string) {
  await prisma.bidderWorkerLock.deleteMany({ where: { id: LOCK_ID, token } });
}

/**
 * userId undefined: global cron worker processes all due active bidder-ы.
 * userId supplied: authenticated manual run processes only that user's bidder-ы.
 */
export async function runProductionBidderWorker(params?: { source?: WorkerSource; limit?: number; userId?: number }): Promise<BidderWorkerExecutionResult> {
  const source = params?.source ?? "internal";
  const token = randomUUID();
  const lock = await acquireWorkerLock(token);

  if (!lock.acquired) {
    return { ok: true, skippedBecauseLocked: true, source, lockedUntil: lock.lockedUntil?.toISOString() ?? null, message: lock.lockedUntil ? `Worker уже выполняется. Lock активен до ${lock.lockedUntil.toISOString()}.` : "Worker уже выполняется другим процессом." };
  }

  let workerRunId: number | null = null;
  const startedAt = new Date();

  try {
    const workerRun = await prisma.bidderWorkerRun.create({ data: { token, source, status: "running", startedAt } });
    workerRunId = workerRun.id;

    const result = await runDueBidders({ userId: params?.userId, limit: params?.limit ?? 100 });
    const finishedAt = new Date();
    const message = ["Bidder worker выполнен.", `Всего: ${result.total}.`, `Обработано: ${result.processed}.`, `Пропущено: ${result.skipped}.`, `Ошибок: ${result.failed}.`, `Dry-run: ${result.dryRunProcessed}.`, `Live: ${result.liveProcessed}.`].join(" ");

    await prisma.bidderWorkerRun.update({ where: { id: workerRun.id }, data: { status: "completed", finishedAt, total: result.total, processed: result.processed, skipped: result.skipped, failed: result.failed, message } });

    return { ok: true, skippedBecauseLocked: false, runId: workerRun.id, token, source, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), total: result.total, processed: result.processed, skipped: result.skipped, failed: result.failed, dryRunProcessed: result.dryRunProcessed, liveProcessed: result.liveProcessed, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка production bidder worker.";
    if (workerRunId !== null) await prisma.bidderWorkerRun.update({ where: { id: workerRunId }, data: { status: "failed", finishedAt: new Date(), error: message, message: "Worker завершился с ошибкой." } });
    return { ok: false, skippedBecauseLocked: false, runId: workerRunId, token, source, message };
  } finally {
    await releaseWorkerLock(token);
  }
}
