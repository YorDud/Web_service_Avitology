import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export async function requireAdmin() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 },
      ),
    };
  }

  if (sessionUser.subscriptionLevel !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }),
    };
  }

  return { ok: true as const, admin: sessionUser };
}
