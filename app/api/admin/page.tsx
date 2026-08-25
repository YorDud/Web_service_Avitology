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
  });

  return <AdminUsersClient users={users} adminName={admin.name} />;
}