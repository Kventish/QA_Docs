import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
};

const COOKIE_NAME = "qadocs_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

export function signSession(user: SessionUser) {
  return jwt.sign(user, getSecret(), { expiresIn: "7d" });
}

function shouldUseSecureCookie() {
  // If we are on localhost (common for Docker on Windows), Secure cookies won't be stored over http.
  const host = (headers().get("host") ?? "").toLowerCase();
  const proto = (headers().get("x-forwarded-proto") ?? "").toLowerCase();

  const isLocalhost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    host.endsWith(".local");

  if (isLocalhost) return false;

  // If a reverse proxy tells us the original protocol, respect it.
  if (proto) return proto === "https";

  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 0
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const claims = jwt.verify(token, getSecret());
    if (typeof claims === "string" || typeof claims.id !== "string") return null;
    const user = await prisma.user.findUnique({
      where: { id: claims.id },
      select: { id: true, email: true, role: true, disabledAt: true, deletedAt: true }
    });
    if (!user || user.disabledAt || user.deletedAt) return null;
    return { id: user.id, email: user.email, role: user.role };
  } catch {
    return null;
  }
}

