import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { parseServiceInput } from "@/lib/service-level/service-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function PATCH(request: Request, context: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });

  try {
    const existing = await prisma.serviceLevelService.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = parseServiceInput(body, existing);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    await prisma.serviceLevelService.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SERVICE LEVEL SERVICE PATCH ERROR:", error);
    return NextResponse.json({ error: "Не удалось сохранить услугу" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });

  try {
    const orders = await prisma.serviceLevelOrder.count({ where: { serviceId: id } });
    if (orders > 0) {
      return NextResponse.json(
        { error: `По услуге уже есть заказы (${orders}). Удалить её нельзя — отключите её переключателем «Показывать пользователям».` },
        { status: 409 },
      );
    }
    await prisma.serviceLevelService.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SERVICE LEVEL SERVICE DELETE ERROR:", error);
    return NextResponse.json({ error: "Не удалось удалить услугу" }, { status: 500 });
  }
}
