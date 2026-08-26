import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getServiceSettings } from "@/lib/service-settings";
import AdminUsersClient from "./users-client";

export default async function AdminPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/auth");
  }

  const admin = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  if (!admin || admin.subscriptionLevel !== "admin") {
    redirect("/dashboard");
  }

  const dbUsers = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      publicId: true,
      email: true,
      name: true,
      subscriptionLevel: true,
      subscriptionPrice: true,
      subscriptionPaidAt: true,
      subscriptionEndsAt: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      isActive: true,
      notes: true,
    },
  });

  const users = dbUsers.map((user) => ({
    id: user.id,
    publicId: user.publicId,
    email: user.email,
    name: user.name,
    subscriptionLevel: user.subscriptionLevel,
    subscriptionPrice: user.subscriptionPrice,
    subscriptionPaidAt: user.subscriptionPaidAt
      ? user.subscriptionPaidAt.toISOString()
      : null,
    subscriptionEndsAt: user.subscriptionEndsAt
      ? user.subscriptionEndsAt.toISOString()
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    isActive: user.isActive,
    notes: user.notes,
  }));

  const serviceSettings = await getServiceSettings();

  return (
    <AdminUsersClient
      users={users}
      adminName={admin.name}
      initialServiceSettings={{
        id: serviceSettings.id,
        isYookassaEnabled: serviceSettings.isYookassaEnabled,
      }}
    />
  );
}