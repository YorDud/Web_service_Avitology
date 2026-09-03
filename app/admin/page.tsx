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
      usedFreeTrial: true,
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
    usedFreeTrial: user.usedFreeTrial,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    isActive: user.isActive,
    notes: user.notes,
  }));

  const dbPayments = await prisma.payment.findMany({
    orderBy: { id: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      provider: true,
      status: true,
      amount: true,
      currency: true,
      description: true,
      planCode: true,
      durationMonths: true,
      externalPaymentId: true,
      confirmationUrl: true,
      paidAt: true,
      createdAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          publicId: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const payments = dbPayments.map((payment) => ({
    id: payment.id,
    userId: payment.userId,
    provider: payment.provider,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description,
    planCode: payment.planCode,
    durationMonths: payment.durationMonths,
    externalPaymentId: payment.externalPaymentId,
    confirmationUrl: payment.confirmationUrl,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    createdAt: payment.createdAt.toISOString(),
    expiresAt: payment.expiresAt ? payment.expiresAt.toISOString() : null,
    user: payment.user
      ? {
          id: payment.user.id,
          publicId: payment.user.publicId,
          name: payment.user.name,
          email: payment.user.email,
        }
      : null,
  }));

  const serviceSettings = await getServiceSettings();

  return (
    <AdminUsersClient
      users={users}
      payments={payments}
      adminName={admin.name}
      initialServiceSettings={{
        id: serviceSettings.id,
        isYookassaEnabled: serviceSettings.isYookassaEnabled,
        isFreeTrialEnabled: serviceSettings.isFreeTrialEnabled,
      }}
    />
  );
}