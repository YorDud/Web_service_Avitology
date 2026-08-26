import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  console.log("YOOKASSA WEBHOOK:", body);

  return NextResponse.json({ ok: true });
}