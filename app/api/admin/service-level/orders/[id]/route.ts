import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { dispatchOrder, finalizeIfDone, refreshAttention, scheduleDispatch, shutdownOrderTasks, syncOrder } from "@/lib/service-level/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/**
 * Действия админа над заказом (body.action):
 *  startNow     — запустить заказ с отложенным стартом прямо сейчас (не дожидаясь выбранного времени);
 *  retry        — повторить отправку ошибочных заданий на SocPublic;
 *  sync         — обновить ход выполнения у SocPublic прямо сейчас;
 *  complete     — вручную отметить заказ выполненным;
 *  cancel       — отменить заказ (возврат денег пользователю — вручную в ЮKassa);
 *  reopen       — вернуть заказ «в работу»;
 *  setTaskId    — вручную указать ID задания SocPublic (itemId, socTaskId);
 *  markStage    — вручную отметить этап задания (itemId, stage: created | funded | active | done);
 *  note         — заметка админа.
 */
export async function POST(request: Request, context: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    const order = await prisma.serviceLevelOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

    if (action === "startNow") {
      if (order.status !== "in_progress") return NextResponse.json({ error: "Запустить можно только заказ «в работе»." }, { status: 400 });
      await prisma.serviceLevelOrder.update({ where: { id }, data: { scheduledStartAt: null, dispatchLockedUntil: null } });
      const run = () => dispatchOrder(id, { ignoreSchedule: true }).catch((error) => console.error("START NOW ERROR:", error));
      try {
        after(run);
      } catch {
        void run();
      }
      return NextResponse.json({ success: true, message: "Заказ запущен сразу. Обновите список через несколько секунд." });
    }

    if (action === "retry") {
      if (order.status !== "in_progress") return NextResponse.json({ error: "Повторить можно только заказ «в работе»." }, { status: 400 });
      // Сбрасываем блокировку: админ явно просит повторить.
      await prisma.serviceLevelOrder.update({ where: { id }, data: { dispatchLockedUntil: null } });
      const run = () => dispatchOrder(id, { retryErrors: true }).catch((error) => console.error("RETRY ERROR:", error));
      try {
        after(run);
      } catch {
        void run();
      }
      return NextResponse.json({ success: true, message: "Повторная отправка запущена. Обновите список через несколько секунд." });
    }

    if (action === "sync") {
      const result = await syncOrder(id, { force: true });
      return NextResponse.json({ success: true, result });
    }

    if (action === "complete") {
      // doneCount выставляем равным quantity каждой ссылки отдельно (updateMany не может
      // ссылаться на поле самой строки), чтобы у пользователя сразу было видно «N из N», а не 0.
      await Promise.all(order.items.map((item) => prisma.serviceLevelOrderItem.update({ where: { id: item.id }, data: { stage: "done", error: null, errorStage: null, retryAfter: null, doneCount: item.quantity } })));
      await prisma.serviceLevelOrder.update({
        where: { id },
        data: { status: "completed", completedAt: new Date(), attention: false, attentionNote: null },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "cancel") {
      // Отменённый заказ больше не нужно ни отправлять, ни ждать — снимаем все признаки незавершённой отправки,
      // чтобы «Ждём SocPublic» и автоматический дозапуск не продолжали жить для уже отменённого заказа.
      await prisma.serviceLevelOrderItem.updateMany({ where: { orderId: id }, data: { retryAfter: null } });
      await prisma.serviceLevelOrder.update({ where: { id }, data: { status: "cancelled", attention: false, attentionNote: null, dispatchLockedUntil: null } });

      // Останавливаем задания на SocPublic и забираем остаток баланса — в фоне; итог пишем в заметку заказа.
      const previousNote = order.adminNote;
      const stopTasks = async () => {
        const summary = await shutdownOrderTasks(id).catch((error) => `Не удалось остановить задания автоматически: ${error instanceof Error ? error.message : "ошибка"}`);
        await prisma.serviceLevelOrder
          .update({ where: { id }, data: { adminNote: [previousNote, `Отмена: ${summary}`].filter(Boolean).join("\n").slice(0, 2000) } })
          .catch(() => null);
      };
      try {
        after(stopTasks);
      } catch {
        void stopTasks();
      }
      return NextResponse.json({ success: true, message: "Заказ отменён. Задания останавливаются на SocPublic — итог появится в заметке заказа через минуту." });
    }

    if (action === "reopen") {
      await prisma.serviceLevelOrder.update({ where: { id }, data: { status: "in_progress", completedAt: null } });
      return NextResponse.json({ success: true });
    }

    if (action === "setTaskId") {
      const itemId = Number(body?.itemId);
      const socTaskId = typeof body?.socTaskId === "string" ? body.socTaskId.trim() : "";
      const item = order.items.find((entry) => entry.id === itemId);
      if (!item) return NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
      if (!/^\d{3,12}$/.test(socTaskId)) return NextResponse.json({ error: "ID задания SocPublic — число (например, 3099525)." }, { status: 400 });
      await prisma.serviceLevelOrderItem.update({
        where: { id: itemId },
        data: {
          socTaskId,
          error: null,
          errorStage: null,
          // Если задание ещё не создавалось — считаем его созданным и пойдём дальше с пополнения.
          ...(["pending", "creating", "error"].includes(item.stage) && (item.errorStage === "create" || item.errorStage === null) ? { stage: "created" } : {}),
        },
      });
      await refreshAttention(id);
      return NextResponse.json({ success: true });
    }

    if (action === "markStage") {
      const itemId = Number(body?.itemId);
      const stage = typeof body?.stage === "string" ? body.stage : "";
      if (!["created", "funded", "active", "done"].includes(stage)) return NextResponse.json({ error: "Неизвестный этап" }, { status: 400 });
      const item = order.items.find((entry) => entry.id === itemId);
      if (!item) return NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
      if (stage !== "done" && !item.socTaskId && stage !== "created") {
        return NextResponse.json({ error: "Сначала укажите ID задания SocPublic." }, { status: 400 });
      }
      await prisma.serviceLevelOrderItem.update({
        where: { id: itemId },
        data: { stage, error: null, errorStage: null, ...(stage === "done" ? { doneCount: item.quantity } : {}) },
      });
      await refreshAttention(id);
      await finalizeIfDone(id);
      if (stage === "created" || stage === "funded") scheduleDispatch(id);
      return NextResponse.json({ success: true });
    }

    if (action === "note") {
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";
      await prisma.serviceLevelOrder.update({ where: { id }, data: { adminNote: note || null } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("SERVICE LEVEL ORDER ACTION ERROR:", error);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
