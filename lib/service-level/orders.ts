import { after } from "next/server";
import type { Prisma, ServiceLevelService, ServiceLevelSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildTaskName,
  computeOrderTotals,
  nameLetter,
  parseLinks,
  parseServiceLevelPlanCode,
  round2,
  socQuantityFor,
  hasTierAccess,
  type OrderTotals,
} from "./constants";
import { extractProgress, isTaskComplete } from "./progress";
import { getServiceLevelSettings, progressKeysFrom, successCodesFrom } from "./settings";
import { extractTaskId, rateLimitWaitMinutes, socCall, socConfigured, stringifyRaw } from "./socpublic";
import { renderTemplate } from "./template";

/* =========================================================================
   Заказы «Уровня сервиса»: проверка и создание заказа, зачисление оплаты,
   отправка заданий на SocPublic (создать → пополнить → включить), синхронизация статуса.

   Принципы надёжности:
   – заказ создаётся «черновиком» (awaiting_payment, без номера) и становится заказом
     только после подтверждённой оплаты;
   – зачисление оплаты атомарно и идемпотентно (webhook ЮKassa и проверка статуса
     могут сработать одновременно — заказ оплатится и получит номер ровно один раз);
   – каждый шаг отправки на SocPublic сохраняется в БД до и после вызова; при сбое
     ничего не повторяется автоматически (чтобы не создать дубль и не пополнить дважды) —
     заказ помечается «требует внимания», админ повторяет шаг вручную.
   ========================================================================= */

const DISPATCH_LOCK_MS = 10 * 60 * 1000;
const SYNC_MIN_INTERVAL_MS = 90 * 1000;

type Failure = { ok: false; error: string; status: number };

const fail = (error: string, status = 400): Failure => ({ ok: false, error, status });

/* ---------- Проверка и создание заказа ---------- */

export type PreparedOrder = {
  ok: true;
  service: ServiceLevelService;
  settings: ServiceLevelSettings;
  links: { url: string; key: string }[];
  quantityPerLink: number;
  totals: OrderTotals;
};

export async function prepareOrder(
  user: { subscriptionLevel: string },
  body: { serviceId?: unknown; links?: unknown; quantity?: unknown } | null,
): Promise<PreparedOrder | Failure> {
  const settings = await getServiceLevelSettings();
  if (!settings.isEnabled) return fail("Приём заказов временно закрыт. Попробуйте позже.", 403);
  if (!hasTierAccess(user.subscriptionLevel, settings.minTier)) return fail("Эта услуга недоступна на вашем тарифе.", 403);

  const serviceId = Number(body?.serviceId);
  if (!Number.isInteger(serviceId)) return fail("Выберите услугу.");
  const service = await prisma.serviceLevelService.findFirst({ where: { id: serviceId, isActive: true } });
  if (!service) return fail("Эта услуга сейчас недоступна.", 404);

  const parsed = parseLinks(typeof body?.links === "string" ? body.links : "");
  if (parsed.invalid.length > 0) {
    const first = parsed.invalid[0];
    return fail(`Проверьте ссылки: «${first.raw}» — ${first.reason.toLowerCase()}.`);
  }
  if (parsed.valid.length === 0) return fail("Добавьте хотя бы одну ссылку на объявление Авито.");
  if (parsed.valid.length > settings.maxLinksPerOrder) {
    return fail(`В одном заказе можно указать не больше ${settings.maxLinksPerOrder} ссылок.`);
  }

  const quantityPerLink = Math.round(Number(body?.quantity));
  if (!Number.isInteger(quantityPerLink) || quantityPerLink < service.minQuantity || quantityPerLink > service.maxQuantity) {
    return fail(`Количество на одно объявление — от ${service.minQuantity} до ${service.maxQuantity}.`);
  }

  const totals = computeOrderTotals({
    pricePerUnit: service.pricePerUnit,
    reward: service.reward,
    commissionPercent: settings.commissionPercent,
    linksCount: parsed.valid.length,
    quantityPerLink,
  });
  if (totals.price < 1) return fail("Сумма заказа должна быть больше нуля.");

  return { ok: true, service, settings, links: parsed.valid, quantityPerLink, totals };
}

/** Черновик заказа (ждёт оплаты). Номер ему присваивается только после оплаты. */
export async function createDraftOrder(user: { id: number; name: string }, prepared: PreparedOrder) {
  const letter = nameLetter(user.name);
  const total = prepared.links.length;
  return prisma.serviceLevelOrder.create({
    data: {
      userId: user.id,
      serviceId: prepared.service.id,
      status: "awaiting_payment",
      titleSnapshot: prepared.service.title,
      quantityPerLink: prepared.quantityPerLink,
      linksCount: total,
      totalQuantity: prepared.totals.totalQuantity,
      unitPrice: prepared.service.pricePerUnit,
      amountPaid: prepared.totals.price,
      socCost: prepared.totals.socCost,
      rewardSnapshot: prepared.service.reward,
      commissionSnapshot: prepared.settings.commissionPercent,
      items: {
        create: prepared.links.map((link, index) => ({
          position: index + 1,
          url: link.url,
          quantity: prepared.quantityPerLink,
          socQuantity: socQuantityFor(prepared.quantityPerLink),
          taskName: buildTaskName(prepared.service.taskTitle, {
            letter,
            n: index + 1,
            total,
            numberSingleLink: prepared.service.numberSingleLink,
          }),
        })),
      },
    },
  });
}

/* ---------- Зачисление оплаты ---------- */

/**
 * Оплата заказа подтверждена: платёж → succeeded, заказ → in_progress с порядковым номером.
 * Вызывать можно сколько угодно раз — результат один. Отправку на SocPublic запускает scheduleDispatch.
 */
export async function fulfilServiceLevelPayment(paymentId: number, metadata: Record<string, unknown> = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!payment) throw new Error("Платеж не найден");
        const orderId = parseServiceLevelPlanCode(payment.planCode);
        if (orderId === null) throw new Error("Это не платёж за услугу «Уровень сервиса»");

        const order = await tx.serviceLevelOrder.findUnique({ where: { id: orderId } });
        if (!order || order.userId !== payment.userId) throw new Error("Заказ не найден");

        const claimed = await tx.payment.updateMany({
          where: { id: paymentId, status: { not: "succeeded" } },
          data: {
            status: "succeeded",
            paidAt: new Date(),
            metadata: JSON.stringify({ kind: "service_level", orderId, ...metadata }),
          },
        });
        if (claimed.count === 0) return { orderId, newlyPaid: false };

        if (order.status !== "awaiting_payment") {
          // Платёж пришёл за заказ, который уже не ждёт оплаты (например, отменён админом) — разбирается человек.
          await tx.serviceLevelOrder.update({
            where: { id: orderId },
            data: { attention: true, attentionNote: "Оплата пришла по заказу в статусе «" + order.status + "». Проверьте вручную." },
          });
          return { orderId, newlyPaid: false };
        }

        const last = await tx.serviceLevelOrder.findFirst({
          where: { userId: order.userId, orderNumber: { not: null } },
          orderBy: { orderNumber: "desc" },
          select: { orderNumber: true },
        });
        await tx.serviceLevelOrder.update({
          where: { id: orderId },
          data: {
            status: "in_progress",
            orderNumber: (last?.orderNumber ?? 0) + 1,
            paymentId,
            amountPaid: payment.amount,
            paidAt: new Date(),
          },
        });
        return { orderId, newlyPaid: true };
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      // P2002 — два заказа одного пользователя одновременно взяли один номер: повторяем.
      if (code === "P2002" && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error("Не удалось зачислить оплату заказа");
}

/** Запуск отправки на SocPublic уже после ответа клиенту (с запасным вариантом без `after`). */
export function scheduleDispatch(orderId: number) {
  const run = () =>
    dispatchOrder(orderId).catch((error) => console.error("SERVICE LEVEL DISPATCH ERROR:", error instanceof Error ? error.message : error));
  try {
    after(run);
  } catch {
    void run();
  }
}

export function scheduleSync(orderIds: number[]) {
  if (orderIds.length === 0) return;
  const run = () =>
    syncOrders(orderIds).catch((error) => console.error("SERVICE LEVEL SYNC ERROR:", error instanceof Error ? error.message : error));
  try {
    after(run);
  } catch {
    void run();
  }
}

/* ---------- Отправка заданий на SocPublic ---------- */

type OrderWithRelations = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

async function loadOrder(orderId: number) {
  return prisma.serviceLevelOrder.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { position: "asc" } }, service: true },
  });
}

async function setItem(id: number, data: Prisma.ServiceLevelOrderItemUncheckedUpdateInput) {
  return prisma.serviceLevelOrderItem.update({ where: { id }, data });
}

async function failItem(itemId: number, errorStage: "create" | "fund" | "enable", message: string, raw?: unknown) {
  await setItem(itemId, {
    stage: "error",
    errorStage,
    error: message.slice(0, 500),
    ...(raw !== undefined ? { rawLast: stringifyRaw(raw) } : {}),
  });
}

/** Что продолжить после ручного «повторить»: по месту ошибки. */
function resumeStageFor(errorStage: string | null, hasTaskId: boolean) {
  if (errorStage === "fund") return "created";
  if (errorStage === "enable") return "funded";
  return hasTaskId ? "created" : "pending";
}

export async function dispatchOrder(orderId: number, options: { retryErrors?: boolean } = {}) {
  const now = new Date();
  const locked = await prisma.serviceLevelOrder.updateMany({
    where: { id: orderId, status: "in_progress", OR: [{ dispatchLockedUntil: null }, { dispatchLockedUntil: { lt: now } }] },
    data: { dispatchLockedUntil: new Date(Date.now() + DISPATCH_LOCK_MS) },
  });
  if (locked.count === 0) return;

  let keepAttentionNote = false;
  try {
    if (!socConfigured()) {
      await prisma.serviceLevelOrder.update({
        where: { id: orderId },
        data: { attention: true, attentionNote: "В .env не заданы SOCPUBLIC_API_ID и SOCPUBLIC_API_KEY — задания не отправлены." },
      });
      keepAttentionNote = true; // не затираем эту отметку подсчётом ошибочных заданий
      return;
    }

    let order = await loadOrder(orderId);
    if (!order) return;

    // Прерванные на полпути шаги (сервер перезапустился во время запроса): исход неизвестен — автоматически не повторяем.
    for (const item of order.items) {
      const interrupted: Record<string, "create" | "fund" | "enable"> = { creating: "create", funding: "fund", enabling: "enable" };
      if (interrupted[item.stage]) {
        await failItem(item.id, interrupted[item.stage], "Отправка была прервана, результат неизвестен. Проверьте задание на SocPublic и отметьте нужный шаг вручную.");
      }
    }
    if (options.retryErrors) {
      for (const item of order.items) {
        if (item.stage === "error") {
          await setItem(item.id, { stage: resumeStageFor(item.errorStage, Boolean(item.socTaskId)), error: null, errorStage: null });
        }
      }
    }
    order = await loadOrder(orderId);
    if (!order) return;

    const settings = await getServiceLevelSettings();
    const codes = successCodesFrom(settings);
    for (const item of order.items) {
      // Заказ могли отменить или закрыть, пока мы отправляем предыдущие ссылки — тогда новые задания не создаём.
      const fresh = await prisma.serviceLevelOrder.findUnique({ where: { id: orderId }, select: { status: true } });
      if (fresh?.status !== "in_progress") break;
      await processItem(order, item, settings.payTemplate, codes);
    }
  } finally {
    if (!keepAttentionNote) await refreshAttention(orderId).catch(() => null);
    await prisma.serviceLevelOrder.update({ where: { id: orderId }, data: { dispatchLockedUntil: null } }).catch(() => null);
  }
}

/** Блок data из ответа SocPublic (task_create / task_info) или null. */
function readData(raw: unknown): Record<string, unknown> | null {
  const data = (raw as { data?: unknown } | null)?.data;
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
}

/** Число из поля ответа SocPublic ("1.3000" → 1.3) или null. */
function readNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(number) ? number : null;
}

/**
 * Реальная стоимость ОДНОГО выполнения для нас: SocPublic сам возвращает её при создании задания
 * (data.price, например "1.3000" при выплате 1 ₽). Берём оттуда, а не считаем по настройке комиссии —
 * так пополнение всегда совпадает с тем, что SocPublic спишет на самом деле.
 */
function unitCostFromCreate(rawLast: string | null): number | null {
  if (!rawLast) return null;
  try {
    const price = readNumber(readData(JSON.parse(rawLast))?.price);
    return price !== null && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function processItem(order: OrderWithRelations, startItem: OrderWithRelations["items"][number], payTemplate: string, codes: string[]) {
  let stage = startItem.stage;
  let taskId = startItem.socTaskId;
  // Расчётная стоимость (по комиссии из настроек) — запасной вариант, если SocPublic не вернул цену.
  const socQty = startItem.socQuantity ?? startItem.quantity; // реальное количество на SocPublic (N + 2)
  const estimatedCost = round2(socQty * order.rewardSnapshot * (1 + order.commissionSnapshot / 100));

  if (stage === "pending" && startItem.retryAfter && startItem.retryAfter.getTime() > Date.now()) {
    return; // SocPublic попросил подождать между созданиями заданий — ждём, это не ошибка
  }

  if (stage === "pending") {
    await setItem(startItem.id, { stage: "creating", error: null, errorStage: null });
    const rendered = renderTemplate(order.service.payloadTemplate, {
      name: startItem.taskName,
      links: [startItem.url],
      linksText: startItem.url,
      description: order.service.taskDescription,
      confirm: order.service.confirmInfo,
      reward: order.rewardSnapshot,
      count: socQty,
      quantity: socQty,
      executionMinutes: order.service.executionMinutes,
      // «Время на выполнение» в API — поле work_time в секундах (минуты × 60 дают ровно допустимые значения SocPublic).
      executionSeconds: order.service.executionMinutes * 60,
    });
    if (!rendered.ok) return failItem(startItem.id, "create", `Шаблон задания настроен неверно: ${rendered.error}. Поправьте «Шаблон запроса task_create» в настройках услуги.`);

    const created = await socCall("task_create", { data: JSON.stringify(rendered.data) }, codes);
    if (!created.ok) {
      // Ограничение самого SocPublic на частоту создания заданий — ждём и пробуем снова сами,
      // без ручного вмешательства; это не ошибка шаблона и не повод помечать заказ «требует внимания».
      const waitMinutes = rateLimitWaitMinutes(created.error);
      if (waitMinutes !== null) {
        await setItem(startItem.id, {
          stage: "pending",
          retryAfter: new Date(Date.now() + waitMinutes * 60_000),
          rawLast: stringifyRaw(created.raw),
        });
        return;
      }
      return failItem(startItem.id, "create", `Не удалось создать задание на SocPublic: ${created.error ?? "неизвестная ошибка"}. Проверьте «Шаблон запроса task_create» в настройках услуги.`, created.raw);
    }
    await setItem(startItem.id, { retryAfter: null });

    taskId = extractTaskId(created.raw);
    if (!taskId) {
      return failItem(
        startItem.id,
        "create",
        "Задание, скорее всего, создано, но ID в ответе SocPublic не найден. Найдите его в кабинете SocPublic и введите вручную.",
        created.raw,
      );
    }
    await setItem(startItem.id, { stage: "created", socTaskId: taskId, rawLast: stringifyRaw(created.raw) });
    startItem.rawLast = stringifyRaw(created.raw);
    stage = "created";
  }

  if (stage === "created" && taskId) {
    await setItem(startItem.id, { stage: "funding" });
    // Сколько реально нужно: число выполнений × настоящая цена выполнения от SocPublic.
    // SocPublic принимает пополнение только ЦЕЛЫМИ рублями, поэтому округляем вверх — остаток
    // (до 0.99 ₽) вернём на рекламный баланс методом task_charge, когда задание будет выполнено.
    const unitCost = unitCostFromCreate(startItem.rawLast);
    const amount = unitCost !== null ? round2(socQty * unitCost) : estimatedCost;
    const amountRounded = Math.ceil(amount);
    const rendered = renderTemplate(payTemplate, {
      taskId,
      amount,
      amountRounded,
      amountKopecks: Math.round(amount * 100),
      count: socQty,
    });
    if (!rendered.ok) return failItem(startItem.id, "fund", `Шаблон пополнения: ${rendered.error}`);

    const paid = await socCall("task_pay", { data: JSON.stringify(rendered.data) }, codes);
    if (!paid.ok) {
      return failItem(
        startItem.id,
        "fund",
        `Не удалось пополнить задание №${taskId} на ${amountRounded} ₽: ${paid.error ?? "неизвестная ошибка"}. Проверьте баланс аккаунта SocPublic (вкладка «Настройки и SocPublic» → «Проверить ключи» показывает рекламный баланс) и «Шаблон пополнения task_pay» в настройках «Уровня сервиса».`,
        paid.raw,
      );
    }
    await setItem(startItem.id, { stage: "funded", fundedAmount: amountRounded, rawLast: stringifyRaw(paid.raw) });
    stage = "funded";
  }

  if (stage === "funded" && taskId) {
    await setItem(startItem.id, { stage: "enabling" });
    const enabled = await socCall("task_on", { task_id: taskId }, codes);
    if (!enabled.ok) {
      return failItem(startItem.id, "enable", `Задание №${taskId} создано и пополнено, но не удалось включить: ${enabled.error ?? "неизвестная ошибка"}. Включите его вручную в кабинете SocPublic или нажмите «Повторить отправку».`, enabled.raw);
    }
    await setItem(startItem.id, { stage: "active", rawLast: stringifyRaw(enabled.raw) });
  }
}

/** «Требует внимания» — если у заказа есть задания с ошибкой. */
export async function refreshAttention(orderId: number) {
  const items = await prisma.serviceLevelOrderItem.findMany({ where: { orderId }, select: { position: true, stage: true, error: true } });
  const broken = items.filter((item) => item.stage === "error");
  await prisma.serviceLevelOrder.update({
    where: { id: orderId },
    data:
      broken.length > 0
        ? { attention: true, attentionNote: `Ссылок с ошибкой: ${broken.length}. Первая: №${broken[0].position} — ${broken[0].error ?? "ошибка"}` }
        : { attention: false, attentionNote: null },
  });
}

/* ---------- Синхронизация хода выполнения ---------- */

export async function syncOrder(orderId: number, options: { force?: boolean } = {}) {
  const order = await loadOrder(orderId);
  if (!order || order.status !== "in_progress") return { synced: false, reason: "not_in_progress" as const };
  if (!options.force && order.lastSyncAt && Date.now() - order.lastSyncAt.getTime() < SYNC_MIN_INTERVAL_MS) {
    return { synced: false, reason: "recent" as const };
  }
  if (!socConfigured()) return { synced: false, reason: "not_configured" as const };

  const settings = await getServiceLevelSettings();
  const codes = successCodesFrom(settings);
  const keys = progressKeysFrom(settings);

  await prisma.serviceLevelOrder.update({ where: { id: orderId }, data: { lastSyncAt: new Date() } });

  for (const item of order.items) {
    if (item.stage !== "active" || !item.socTaskId) continue;
    const info = await socCall("task_info", { task_id: item.socTaskId }, codes);
    if (!info.ok) {
      await setItem(item.id, { rawLast: stringifyRaw(info.raw ?? { error: info.error }) });
      continue;
    }
    const data = readData(info.raw);

    // Задание заблокировано модерацией SocPublic (active = "ban") — выполняться оно не будет, нужен человек.
    if (data?.active === "ban") {
      await failItem(item.id, "enable", `Задание №${item.socTaskId} заблокировано модерацией SocPublic (статус «ban»). Откройте его в кабинете SocPublic, посмотрите причину и при необходимости создайте задание заново.`, info.raw);
      continue;
    }

    const progress = extractProgress(info.raw, keys);
    const socQty = item.socQuantity ?? item.quantity;
    const complete = isTaskComplete(progress, socQty);
    await setItem(item.id, {
      rawLast: stringifyRaw(info.raw),
      doneCount: progress.paid !== null ? Math.min(Math.max(0, Math.round(progress.paid)), socQty) : item.doneCount,
      ...(complete === true ? { stage: "done" } : {}),
    });

    // Задание выполнено полностью — возвращаем на рекламный баланс остаток после округления
    // пополнения до целого рубля (например, 7 ₽ внесли за 6.5 ₽ стоимости → вернётся 0.5 ₽).
    if (complete === true) {
      const leftover = readNumber(data?.balance);
      if (leftover !== null && leftover > 0.009) {
        await socCall("task_charge", { data: JSON.stringify({ id: item.socTaskId }) }, codes);
      }
    }
  }
  // Если при проверке нашлась проблема (например, задание заблокировано) — заказ сразу получает отметку «Внимание».
  await refreshAttention(orderId);
  await finalizeIfDone(orderId);
  return { synced: true as const };
}

/**
 * Отмена заказа: останавливаем его задания на SocPublic (task_off) и забираем неиспользованный
 * баланс обратно на рекламный счёт (task_charge). Иначе исполнители продолжили бы выполнять уже
 * отменённый заказ за ваши деньги. Деньги, зарезервированные за уже начатые исполнителями
 * заявки, остаются у SocPublic — они выплатятся исполнителям после проверки отчётов.
 * Работает «по возможности»: сбой одного шага не мешает остальным, итог возвращается текстом.
 */
export async function shutdownOrderTasks(orderId: number): Promise<string> {
  const order = await loadOrder(orderId);
  if (!order) return "Заказ не найден.";
  const withTasks = order.items.filter((item) => item.socTaskId);
  if (withTasks.length === 0) return "На SocPublic по этому заказу ещё ничего не создано — останавливать нечего.";
  if (!socConfigured()) return "Ключи SocPublic не заданы — задания на SocPublic не остановлены, сделайте это вручную.";

  const settings = await getServiceLevelSettings();
  const codes = successCodesFrom(settings);
  const lines: string[] = [];

  for (const item of withTasks) {
    const label = `задание №${item.socTaskId} (ссылка ${item.position})`;
    const off = await socCall("task_off", { task_id: item.socTaskId }, codes);
    const charge = await socCall("task_charge", { data: JSON.stringify({ id: item.socTaskId }) }, codes);
    const balance = readNumber(readData(charge.raw)?.balance);
    lines.push(
      `${label}: ${off.ok ? "остановлено" : `не удалось остановить (${off.error ?? "ошибка"})`}; ${
        charge.ok ? "остаток баланса возвращён на рекламный счёт" : `остаток не возвращён (${charge.error ?? "ошибка"})`
      }${balance !== null ? ` (баланс задания теперь ${balance} ₽)` : ""}`,
    );
  }
  return lines.join(". ");
}

export async function syncOrders(orderIds: number[]) {
  for (const id of orderIds) await syncOrder(id);
}

/** Все задания выполнены → заказ «Выполнен». */
export async function finalizeIfDone(orderId: number) {
  const items = await prisma.serviceLevelOrderItem.findMany({ where: { orderId }, select: { stage: true } });
  if (items.length > 0 && items.every((item) => item.stage === "done")) {
    await prisma.serviceLevelOrder.updateMany({
      where: { id: orderId, status: "in_progress" },
      data: { status: "completed", completedAt: new Date(), attention: false, attentionNote: null },
    });
  }
}

/* ---------- Представления для интерфейса ---------- */

type OrderRow = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

export type UserOrderView = {
  id: number;
  number: number;
  service: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  quantityPerLink: number;
  linksCount: number;
  totalQuantity: number;
  amount: number;
  doneTotal: number | null;
  items: { position: number; url: string; quantity: number; stage: string; doneCount: number | null }[];
};

export function toUserOrderView(order: OrderRow): UserOrderView {
  // Сколько выполнено: у завершённого заказа — всё; иначе — по данным SocPublic, если они есть.
  const hasProgressData = order.items.some((item) => item.stage === "done" || item.doneCount !== null);
  const doneTotal =
    order.status === "completed"
      ? order.totalQuantity
      : hasProgressData
        ? order.items.reduce((sum, item) => sum + (item.stage === "done" ? item.quantity : Math.min(item.doneCount ?? 0, item.quantity)), 0)
        : null;
  return {
    id: order.id,
    number: order.orderNumber ?? 0,
    service: order.titleSnapshot,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    quantityPerLink: order.quantityPerLink,
    linksCount: order.linksCount,
    totalQuantity: order.totalQuantity,
    amount: order.amountPaid,
    doneTotal,
    items: order.items.map((item) => ({
      position: item.position,
      url: item.url,
      quantity: item.quantity,
      stage: item.stage,
      // Выполненная ссылка — это всегда «целиком», даже если сохранённое число отчётов меньше
      // (например, заказ отметили выполненным вручную до того, как досчитались все отчёты).
      doneCount: item.stage === "done" ? item.quantity : item.doneCount === null ? null : Math.min(item.doneCount, item.quantity), // пользователь не видит запас +2
    })),
  };
}

export type AdminOrderView = UserOrderView & {
  userId: number;
  userName: string;
  publicId: number | null;
  email: string;
  serviceId: number;
  paid: number;
  socCost: number;
  profit: number;
  attention: boolean;
  attentionNote: string | null;
  adminNote: string | null;
  paymentId: number | null;
  itemsAdmin: {
    id: number;
    position: number;
    url: string;
    quantity: number;
    /** Сколько реально заказано на SocPublic (N + 2) */
    socQuantity: number;
    taskName: string;
    stage: string;
    errorStage: string | null;
    socTaskId: string | null;
    fundedAmount: number | null;
    doneCount: number | null;
    error: string | null;
    rawLast: string | null;
    retryAfter: string | null;
  }[];
};

export function toAdminOrderView(order: OrderRow & { user: { id: number; name: string; publicId: number | null; email: string } }): AdminOrderView {
  const base = toUserOrderView(order);
  return {
    ...base,
    userId: order.user.id,
    userName: order.user.name,
    publicId: order.user.publicId,
    email: order.user.email,
    serviceId: order.serviceId,
    paid: order.amountPaid,
    socCost: order.socCost,
    profit: round2(order.amountPaid - order.socCost),
    attention: order.attention,
    attentionNote: order.attentionNote,
    adminNote: order.adminNote,
    paymentId: order.paymentId,
    itemsAdmin: order.items.map((item) => ({
      id: item.id,
      position: item.position,
      url: item.url,
      quantity: item.quantity,
      socQuantity: item.socQuantity ?? item.quantity,
      taskName: item.taskName,
      stage: item.stage,
      errorStage: item.errorStage,
      socTaskId: item.socTaskId,
      fundedAmount: item.fundedAmount,
      doneCount: item.doneCount,
      error: item.error,
      rawLast: item.rawLast,
      retryAfter: item.retryAfter ? item.retryAfter.toISOString() : null,
    })),
  };
}
