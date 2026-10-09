import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { DEFAULT_CREATE_TEMPLATE } from "@/lib/service-level/defaults";
import { parseServiceInput } from "@/lib/service-level/service-input";
import { getServiceLevelSettings } from "@/lib/service-level/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  try {
    await getServiceLevelSettings(); // при первом открытии создаёт стартовые услуги
    const services = await prisma.serviceLevelService.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { orders: true } } },
    });
    return NextResponse.json({
      services: services.map(({ _count, createdAt, updatedAt, ...service }) => ({
        ...service,
        ordersCount: _count.orders,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("SERVICE LEVEL SERVICES GET ERROR:", error);
    return NextResponse.json({ error: "Не удалось загрузить услуги" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = parseServiceInput({ payloadTemplate: DEFAULT_CREATE_TEMPLATE, ...(body ?? {}) });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const slug = `service-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const created = await prisma.serviceLevelService.create({ data: { ...parsed.data, slug } });
    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error("SERVICE LEVEL SERVICES POST ERROR:", error);
    return NextResponse.json({ error: "Не удалось создать услугу" }, { status: 500 });
  }
}
