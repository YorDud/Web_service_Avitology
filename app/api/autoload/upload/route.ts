import { NextResponse } from "next/server";
import { avito } from "@/lib/autoload/avito";
import { requireAccount, requireAutoloadUser, routeError } from "@/lib/autoload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Запуск выгрузки прямо сейчас (не дожидаясь расписания). */
export async function POST() {
  const auth = await requireAutoloadUser();
  if (!auth.ok) return auth.response;

  const { account, response } = await requireAccount(auth.user.id);
  if (!account) return response;

  try {
    await avito.upload(account);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
