import { prisma } from "@/lib/prisma";
import { createBidderEvent, cleanupOldBidderEvents } from "@/lib/avito-bidder-events";
import { getAvitoItemByIdForUser } from "@/lib/avito-api";
import { calculateBidderDecision } from "@/lib/avito-bidder-decision";
import { getBidderPosition } from "@/lib/avito-bidder-position";
import { applyBid } from "@/lib/avito-bid-apply";
import { getNextScheduleStart, isTimeWithinBidderSchedule } from "@/lib/avito-bidder-schedule";

type RunnerResult = { bidderId: number; userId: number; title: string; mode: "dry_run" | "live"; status: "processed" | "skipped" | "failed"; message: string; nextCheckAt: string | null };
const getNextCheckAt = (minutes: number) => new Date(Date.now() + minutes * 60_000);
const isBidderDue = (date: Date | null) => !date || date.getTime() <= Date.now();
const isCooldownActive = (date: Date | null) => Boolean(date && date.getTime() > Date.now());
function getTodayDateKey() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function getCaptchaRetryMinutes() { const value = Number(process.env.BIDDER_CAPTCHA_RETRY_MINUTES ?? "30"); return Number.isInteger(value) ? Math.min(Math.max(value, 10), 180) : 30; }
function isTemporaryAvitoSearchError(message: string | null | undefined) { return /captcha|проверка безопасности|доступ ограничен|не робот|ограничил доступ/i.test(String(message ?? "")); }
function getPositionCheckMinIntervalMinutes() { const value = Number(process.env.BIDDER_POSITION_MIN_INTERVAL_MINUTES ?? "10"); return Number.isInteger(value) ? Math.min(Math.max(value, 5), 60) : 10; }
function getNextPositionCheckAllowedAt(date: Date) { return new Date(date.getTime() + getPositionCheckMinIntervalMinutes() * 60_000); }

export async function runSingleBidder(params: { bidderId: number; userId?: number; force?: boolean }): Promise<RunnerResult> {
  await cleanupOldBidderEvents();
  const bidder = await prisma.avitoBidder.findFirst({ where: { id: params.bidderId, ...(params.userId ? { userId: params.userId } : {}) } });
  if (!bidder) return { bidderId: params.bidderId, userId: params.userId ?? 0, title: "Неизвестный бидер", mode: "dry_run", status: "failed", message: "Бидер не найден.", nextCheckAt: null };
  const resultBase = { bidderId: bidder.id, userId: bidder.userId, title: bidder.title, mode: bidder.mode } as const;
  if (bidder.status !== "active") return { ...resultBase, status: "skipped", message: "Бидер не активен.", nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null };
  if (!params.force && !isBidderDue(bidder.nextCheckAt)) return { ...resultBase, status: "skipped", message: "Ещё не наступило время проверки.", nextCheckAt: bidder.nextCheckAt?.toISOString() ?? null };
  const now = new Date();
  if (!isTimeWithinBidderSchedule(bidder.schedule, now)) {
    const nextCheckAt = getNextScheduleStart(bidder.schedule, now) ?? getNextCheckAt(bidder.checkInterval);
    await prisma.avitoBidder.update({ where: { id: bidder.id }, data: { nextCheckAt, lastError: null } });
    await createBidderEvent({ bidderId: bidder.id, type: "runner_schedule_skip", message: `Проверка пропущена: текущее время вне рабочего окна (${bidder.schedule}).` });
    return { ...resultBase, status: "skipped", message: `Вне рабочего расписания: ${bidder.schedule}`, nextCheckAt: nextCheckAt.toISOString() };
  }
  const todayKey = getTodayDateKey(); const effectiveSpentToday = bidder.spentTodayDate === todayKey ? bidder.spentToday : 0;
  if (!bidder.avitoItemId) {
    const nextCheckAt = getNextCheckAt(bidder.checkInterval); const message = "У бидера нет привязанного объявления Авито.";
    await prisma.avitoBidder.update({ where: { id: bidder.id }, data: { spentToday: effectiveSpentToday, spentTodayDate: todayKey, lastCheckedAt: now, lastError: message, nextCheckAt, status: "attention", lastPromotionStatus: "no_avito_item" } });
    await createBidderEvent({ bidderId: bidder.id, type: "runner_error", message }); return { ...resultBase, status: "failed", message, nextCheckAt: nextCheckAt.toISOString() };
  }
  if (bidder.positionCheckedAt && Date.now() - bidder.positionCheckedAt.getTime() < getPositionCheckMinIntervalMinutes() * 60_000) {
    const nextCheckAt = getNextPositionCheckAllowedAt(bidder.positionCheckedAt);
    await prisma.avitoBidder.update({ where: { id: bidder.id }, data: { nextCheckAt, lastError: null } });
    return { ...resultBase, status: "skipped", message: "Проверка позиции отложена до разрешённого интервала.", nextCheckAt: nextCheckAt.toISOString() };
  }
  try {
    const item = await getAvitoItemByIdForUser(bidder.userId, bidder.avitoItemId);
    const positionResult = await getBidderPosition({ searchUrl: bidder.searchUrl, avitoItemId: bidder.avitoItemId });
    await createBidderEvent({ bidderId: bidder.id, type: "runner_position_detected", message: `Источник позиции: ${positionResult.source}. Значение: ${positionResult.position ?? "не определено"}. ${positionResult.details}` });
    if (positionResult.error) {
      const temporary = isTemporaryAvitoSearchError(positionResult.error); const nextCheckAt = temporary ? getNextCheckAt(getCaptchaRetryMinutes()) : getNextCheckAt(bidder.checkInterval);
      const message = temporary ? `${positionResult.error} Повторная попытка будет выполнена через ${getCaptchaRetryMinutes()} мин.` : positionResult.error;
      // Ошибка выдачи не затирает последнюю подтверждённую позицию. Она остаётся в карточке, а описание ошибки — только в истории/служебных данных.
      const updated = await prisma.avitoBidder.update({ where: { id: bidder.id }, data: { title: item.title || bidder.title, avitoItemUrl: item.url || bidder.avitoItemUrl, spentToday: effectiveSpentToday, spentTodayDate: todayKey, lastCheckedAt: now, lastError: message, lastPositionError: positionResult.error, nextCheckAt, status: temporary ? "active" : "attention", lastPromotionStatus: temporary ? "position_captcha_retry_scheduled" : "position_check_failed" } });
      await createBidderEvent({ bidderId: bidder.id, type: temporary ? "runner_position_captcha_retry" : "runner_position_error", message });
      return { ...resultBase, status: temporary ? "skipped" : "failed", message, nextCheckAt: updated.nextCheckAt?.toISOString() ?? null };
    }
    if (positionResult.position === null) throw new Error("Не удалось получить подтверждённую позицию объявления.");
    const decision = calculateBidderDecision({ currentPosition: positionResult.position, currentBid: bidder.currentBid, minBid: bidder.minBid, maxBid: bidder.maxBid, bidStep: bidder.bidStep, targetFrom: bidder.targetFrom, targetTo: bidder.targetTo, smartEconomyEnabled: bidder.smartEconomyEnabled, dailySpendLimit: bidder.dailySpendLimit, spentToday: effectiveSpentToday });
    await createBidderEvent({ bidderId: bidder.id, type: "runner_decision", message: `Решение: ${decision.action}. ${decision.reason} Расчётная ставка: ${decision.recommendedBid} ₽.` });
    const applyResult = await applyBid({ mode: bidder.mode, userId: bidder.userId, avitoItemId: bidder.avitoItemId, currentBid: bidder.currentBid, recommendedBid: decision.recommendedBid, decisionAction: decision.action, minBid: bidder.minBid, maxBid: bidder.maxBid, dailySpendLimit: bidder.dailySpendLimit, cooldownActive: isCooldownActive(bidder.liveApplyCooldownUntil), positionSource: positionResult.source });
    const nextCheckAt = getNextCheckAt(bidder.checkInterval);
    if (!applyResult.ok) { await prisma.avitoBidder.update({ where: { id: bidder.id }, data: { currentPosition: positionResult.position, positionSource: positionResult.source, positionCheckedAt: now, positionSearchUrl: positionResult.searchUrl || bidder.searchUrl, positionPage: positionResult.page, lastPositionError: null, lastError: applyResult.message, nextCheckAt, status: "attention", lastPromotionStatus: "apply_failed" } }); await createBidderEvent({ bidderId: bidder.id, type: "runner_cpx_apply_error", message: applyResult.message }); return { ...resultBase, status: "failed", message: applyResult.message, nextCheckAt: nextCheckAt.toISOString() }; }
    const applied = applyResult.status === "applied";
    const updated = await prisma.avitoBidder.update({ where: { id: bidder.id }, data: { title: item.title || bidder.title, avitoItemUrl: item.url || bidder.avitoItemUrl, currentPosition: positionResult.position, positionSource: positionResult.source, positionCheckedAt: now, positionSearchUrl: positionResult.searchUrl || bidder.searchUrl, positionPage: positionResult.page, lastPositionError: null, currentBid: applyResult.actualBid, spentToday: effectiveSpentToday, spentTodayDate: todayKey, lastCheckedAt: now, lastError: null, nextCheckAt, status: "active", promotionStrategy: "cpx_manual", lastPromotionPayload: applyResult.lastPromotionPayload ?? bidder.lastPromotionPayload, lastForecastPayload: applyResult.lastForecastPayload ?? bidder.lastForecastPayload, lastSuggestPayload: applyResult.lastSuggestPayload ?? bidder.lastSuggestPayload, lastPromotionStatus: applyResult.lastPromotionStatus ?? bidder.lastPromotionStatus, lastPromotionPrice: applyResult.actualBid, lastPromotionOldPrice: applyResult.cpxRecommendedBid ? Math.round(applyResult.cpxRecommendedBid) : null, lastPromotionOrderId: null, lastPromotionRequestId: null, lastAppliedAt: applied ? now : bidder.lastAppliedAt, liveApplyCooldownUntil: applied ? new Date(Date.now() + 15 * 60_000) : bidder.liveApplyCooldownUntil } });
    const eventTypes: Record<string, string> = { dry_run_only: "runner_cpx_dry_run", cooldown_active: "runner_cpx_cooldown", blocked_unverified_position: "runner_cpx_blocked_unverified_position", already_applied: "runner_cpx_already_applied", applied: "runner_cpx_applied" };
    await createBidderEvent({ bidderId: bidder.id, type: eventTypes[applyResult.status] ?? "runner_cpx_result", message: applyResult.message }); await createBidderEvent({ bidderId: bidder.id, type: "runner_check_success", message: `Worker обработал «${updated.title}» в режиме ${updated.mode}.` });
    return { ...resultBase, title: updated.title, status: "processed", message: applyResult.message, nextCheckAt: updated.nextCheckAt?.toISOString() ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить проверку bidder-а."; const nextCheckAt = getNextCheckAt(bidder.checkInterval);
    await prisma.avitoBidder.update({ where: { id: bidder.id }, data: { spentToday: effectiveSpentToday, spentTodayDate: todayKey, lastCheckedAt: now, lastError: message, nextCheckAt, status: "attention", lastPromotionStatus: "runner_exception" } }); await createBidderEvent({ bidderId: bidder.id, type: "runner_check_error", message: `Worker не смог обработать bidder: ${message}` }); return { ...resultBase, status: "failed", message, nextCheckAt: nextCheckAt.toISOString() };
  }
}
export async function runDueBidders(params?: { userId?: number; limit?: number }) { await cleanupOldBidderEvents(); const bidders = await prisma.avitoBidder.findMany({ where: { status: "active", ...(params?.userId ? { userId: params.userId } : {}) }, orderBy: [{ nextCheckAt: "asc" }, { updatedAt: "asc" }], take: params?.limit ?? 100 }); const results = []; for (const bidder of bidders) results.push(await runSingleBidder({ bidderId: bidder.id, userId: bidder.userId })); return { processedAt: new Date().toISOString(), total: results.length, processed: results.filter(x => x.status === "processed").length, skipped: results.filter(x => x.status === "skipped").length, failed: results.filter(x => x.status === "failed").length, dryRunProcessed: results.filter(x => x.status === "processed" && x.mode === "dry_run").length, liveProcessed: results.filter(x => x.status === "processed" && x.mode === "live").length, results }; }
