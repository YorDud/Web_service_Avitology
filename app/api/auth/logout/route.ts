import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const response = NextResponse.redirect(new URL("/auth", url.origin));

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return response;
}