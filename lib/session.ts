import { cookies } from "next/headers";
import { verifySessionToken } from "./auth";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "avitology_session";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const sessionUser = verifySessionToken(token);

  if (!sessionUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  if (!user) return null;

  if (
    user.subscriptionLevel === "basic" &&
    user.subscriptionEndsAt &&
    new Date(user.subscriptionEndsAt) < new Date()
  ) {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionLevel: "free",
        subscriptionPrice: 0,
        subscriptionPaidAt: null,
        subscriptionEndsAt: null,
      },
    });

    return {
  id: updatedUser.id,
  publicId: updatedUser.publicId,
  email: updatedUser.email,
  name: updatedUser.name,
  subscriptionLevel: updatedUser.subscriptionLevel,
};
  }

  return {
    id: user.id,
	publicId: user.publicId,
    email: user.email,
    name: user.name,
    subscriptionLevel: user.subscriptionLevel,
  };
}