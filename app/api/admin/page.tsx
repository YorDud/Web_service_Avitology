import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
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

  const users = await prisma.user.findMany({
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

console.log("ADMIN USERS SAMPLE:", users.slice(0, 3));

console.log(
  "ADMIN USERS:",
  users.map((u) => ({
    id: u.id,
    publicId: u.publicId,
    email: u.email,
  }))
);

  return <AdminUsersClient users={users} adminName={admin.name} />;
}