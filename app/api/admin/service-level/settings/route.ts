import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { MIN_TIERS } from "@/lib/service-level/constants";
import { getServiceLevelSettings } from "@/lib/service-level/settings";
import { socConfigured } from "@/lib/service-level/socpublic";
import { validateTemplate } from "@/lib/service-level/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : undefined);

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    const settings = await getServiceLevelSettings();
    return NextResponse.json({
      settings: { ...settings, updatedAt: settings.updatedAt.toISOString() },
      socConfigured: socConfigured(),
      cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    });
  } catch (error) {
    console.error("SERVICE LEVEL SETTINGS GET ERROR:", error);
    return NextResponse.json({ error: "Не удалось загрузить настройки" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });

  const data: Prisma.ServiceLevelSettingsUpdateInput = {};
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

  if (body.isEnabled !== undefined) data.isEnabled = Boolean(body.isEnabled);
  if (body.minTier !== undefined) {
    if (!MIN_TIERS.includes(body.minTier)) return bad("Неизвестный тариф.");
    data.minTier = body.minTier;
  }
  if (body.commissionPercent !== undefined) {
    const value = Number(String(body.commissionPercent).replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 300) return bad("Комиссия SocPublic — от 0 до 300 %.");
    data.commissionPercent = Math.round(value * 100) / 100;
  }
  if (body.maxLinksPerOrder !== undefined) {
    const value = Math.round(Number(body.maxLinksPerOrder));
    if (!Number.isFinite(value) || value < 1 || value > 200) return bad("Максимум ссылок в заказе — от 1 до 200.");
    data.maxLinksPerOrder = value;
  }
  if (body.payTemplate !== undefined) {
    const template = text(body.payTemplate, 4000) ?? "";
    const check = validateTemplate(template);
    if (!check.ok) return bad(`Шаблон пополнения: ${check.error}`);
    data.payTemplate = template;
  }
  for (const key of ["successCodes", "keyRemaining", "keyReady", "keyStarted", "keyRework", "keyTotal", "keyPaid"] as const) {
    if (body[key] !== undefined) {
      const value = text(body[key], 300) ?? "";
      if (!value && key === "successCodes") return bad("Коды успешного ответа не могут быть пустыми.");
      data[key] = value;
    }
  }
  if (body.etaText !== undefined) data.etaText = text(body.etaText, 200) ?? "";
  if (body.guideIntro !== undefined) data.guideIntro = text(body.guideIntro, 4000) ?? "";

  if (Object.keys(data).length === 0) return bad("Нечего сохранять.");

  try {
    await getServiceLevelSettings();
    const settings = await prisma.serviceLevelSettings.update({ where: { id: 1 }, data });
    return NextResponse.json({ settings: { ...settings, updatedAt: settings.updatedAt.toISOString() } });
  } catch (error) {
    console.error("SERVICE LEVEL SETTINGS PATCH ERROR:", error);
    return NextResponse.json({ error: "Не удалось сохранить настройки" }, { status: 500 });
  }
}
