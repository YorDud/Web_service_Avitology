import { prisma } from "./prisma";

function randomSixDigitId() {
  return Math.floor(100000 + Math.random() * 900000);
}

export async function generateUniquePublicId(): Promise<number> {
  for (let i = 0; i < 50; i++) {
    const candidate = randomSixDigitId();

    const existing = await prisma.user.findUnique({
      where: { publicId: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Не удалось сгенерировать уникальный publicId");
}