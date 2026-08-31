import { prisma } from "@/lib/prisma";

export async function getServiceSettings() {
  const existing = await prisma.serviceSettings.findUnique({
    where: { id: 1 },
  });

  if (existing) {
    return existing;
  }

  return prisma.serviceSettings.create({
    data: {
      id: 1,
      isYookassaEnabled: false,
      isFreeTrialEnabled: false,
    },
  });
}