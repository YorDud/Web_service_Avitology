import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { getServiceLevelSettings, successCodesFrom } from "@/lib/service-level/settings";
import { extractTaskId, socCall, socConfigured, stringifyRaw } from "@/lib/service-level/socpublic";
import { renderTemplate } from "@/lib/service-level/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * Проверка связи с SocPublic из админки (деньги не тратятся):
 *  account  — метод account_info: проверяет ключи API;
 *  template — создаёт ТЕСТОВОЕ задание по шаблону услуги (без пополнения) и сразу удаляет его;
 *  info     — task_info по указанному ID: показывает, как выглядит ответ (для настройки ключей прогресса).
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!socConfigured()) {
    return NextResponse.json({ ok: false, error: "В .env не заданы SOCPUBLIC_API_ID и SOCPUBLIC_API_KEY. После добавления перезапустите сервер." });
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const settings = await getServiceLevelSettings();
  const codes = successCodesFrom(settings);

  try {
    if (action === "account") {
      const result = await socCall("account_info", {}, codes);
      // Короткая сводка: имя аккаунта и рекламный баланс (из него пополняются задания).
      const info = (result.raw as { data?: Record<string, unknown> } | null)?.data;
      const balance = info ? Number(info.balance_rub_advert) : NaN;
      const summary =
        info && typeof info.name === "string"
          ? `Аккаунт SocPublic: ${info.name}${Number.isFinite(balance) ? ` · рекламный баланс: ${balance.toLocaleString("ru-RU")} ₽` : ""}`
          : undefined;
      return NextResponse.json({ ok: result.ok, error: result.error, status: result.status, summary, response: stringifyRaw(result.raw) });
    }

    if (action === "info") {
      const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
      if (!/^\d{3,12}$/.test(taskId)) return NextResponse.json({ ok: false, error: "Укажите ID задания SocPublic (число)." });
      const result = await socCall("task_info", { task_id: taskId }, codes);
      return NextResponse.json({ ok: result.ok, error: result.error, status: result.status, response: stringifyRaw(result.raw, 8000) });
    }

    if (action === "template") {
      // Можно проверить ещё не сохранённый черновик формы (draft) — тогда serviceId не нужен.
      // Это позволяет подбирать правильные поля шаблона подряд, не сохраняя и не перезагружая каждый раз.
      const draft = body?.draft && typeof body.draft === "object" ? (body.draft as Record<string, unknown>) : null;
      let payloadTemplate: string;
      let taskDescription: string;
      let confirmInfo: string;
      let reward: number;
      let executionMinutes: number;
      let testUrl: string;

      if (draft) {
        payloadTemplate = typeof draft.payloadTemplate === "string" ? draft.payloadTemplate : "";
        taskDescription = typeof draft.taskDescription === "string" ? draft.taskDescription : "";
        confirmInfo = typeof draft.confirmInfo === "string" ? draft.confirmInfo : "";
        reward = Number(draft.reward);
        executionMinutes = Math.round(Number(draft.executionMinutes));
        testUrl = typeof draft.testUrl === "string" && draft.testUrl.trim() ? draft.testUrl.trim() : "https://www.avito.ru/test/test_000000000";
        if (!Number.isFinite(reward) || reward <= 0) reward = 5;
        if (!Number.isFinite(executionMinutes) || executionMinutes <= 0) executionMinutes = 7200;
      } else {
        const serviceId = Number(body?.serviceId);
        const service = Number.isInteger(serviceId) ? await prisma.serviceLevelService.findUnique({ where: { id: serviceId } }) : null;
        if (!service) return NextResponse.json({ ok: false, error: "Услуга не найдена." });
        payloadTemplate = service.payloadTemplate;
        taskDescription = service.taskDescription;
        confirmInfo = service.confirmInfo;
        reward = service.reward;
        executionMinutes = service.executionMinutes;
        testUrl = "https://www.avito.ru/test/test_000000000";
      }

      const rendered = renderTemplate(payloadTemplate, {
        name: "ТЕСТ HelpSell — удалить",
        links: [testUrl],
        linksText: testUrl,
        description: taskDescription,
        confirm: confirmInfo,
        reward,
        count: 1,
        quantity: 1,
        executionMinutes,
        executionSeconds: executionMinutes * 60,
      });
      if (!rendered.ok) return NextResponse.json({ ok: false, error: rendered.error });

      const created = await socCall("task_create", { data: JSON.stringify(rendered.data) }, codes);
      const taskId = created.ok ? extractTaskId(created.raw) : null;

      let cleanup: string | null = null;
      if (taskId) {
        const deleted = await socCall("task_delete", { task_id: taskId }, codes);
        cleanup = deleted.ok ? `Тестовое задание №${taskId} удалено.` : `Не удалось удалить тестовое задание №${taskId} — удалите его в кабинете SocPublic. (${deleted.error ?? ""})`;
      }
      return NextResponse.json({
        ok: created.ok && Boolean(taskId),
        error: created.ok ? (taskId ? undefined : "Задание создано, но ID в ответе не найден — проверьте ответ ниже и задание в кабинете SocPublic.") : created.error,
        status: created.status,
        taskId,
        cleanup,
        sent: stringifyRaw(rendered.data),
        response: stringifyRaw(created.raw),
      });
    }

    return NextResponse.json({ ok: false, error: "Неизвестное действие." }, { status: 400 });
  } catch (error) {
    console.error("SERVICE LEVEL TEST ERROR:", error);
    return NextResponse.json({ ok: false, error: "Ошибка проверки." }, { status: 500 });
  }
}
