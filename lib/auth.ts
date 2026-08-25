import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  subscriptionLevel: "free" | "basic" | "admin";
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(user: SessionUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}