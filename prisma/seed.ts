import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "adminmaster@admin.ru";
  const adminPassword = "admin2807";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin Master",
        passwordHash,
        subscriptionLevel: "admin",
        subscriptionPrice: 0,
        isActive: true,
        notes: "Стандартный администратор системы",
      },
    });

    console.log("Admin user created");
  } else {
    console.log("Admin user already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });