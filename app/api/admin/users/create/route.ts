import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser || sessionUser.subscriptionLevel !== "admin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const subscriptionLevel = String(body.subscriptionLevel || "free") as
      | "free"
      | "basic"
      | "admin";

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Имя, почта и пароль обязательны" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть не короче 6 символов" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с такой почтой уже существует" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const createdUser = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        subscriptionLevel,
        subscriptionPrice: subscriptionLevel === "basic" ? 299 : 0,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: createdUser,
    });
  } catch (error) {
    console.error("ADMIN USER CREATE ERROR:", error);
    return NextResponse.json(
      { error: "Ошибка создания пользователя" },
      { status: 500 }
    );
  }
}