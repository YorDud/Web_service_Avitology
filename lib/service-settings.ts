import { prisma } from "@/lib/prisma";

export async function getServiceSettings() {
  let settings = await prisma.serviceSettings.findUnique({
    where: { id: 1 },
  });

  if (!settings) {
    settings = await prisma.serviceSettings.create({
      data: {
        id: 1,
        isYookassaEnabled: false,
      },
    });
  }

  return settings;
}

export async function isYookassaEnabled() {
  const settings = await getServiceSettings();
  return settings.isYookassaEnabled;
}