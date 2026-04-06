import { getSession } from "@/lib/auth";

export function requireSession() {
  const session = getSession();
  // Server Components on this setup can be rendered via RSC requests where cookies may be absent.
  // Avoid hard-failing with a thrown error here; API routes must use `apiRequireRole` instead.
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function requireRole(role: "admin" | "editor" | "viewer") {
  const session = requireSession();
  if (role === "viewer") return session;
  if (role === "editor" && (session.role === "editor" || session.role === "admin")) return session;
  if (role === "admin" && session.role === "admin") return session;
  throw new Error("FORBIDDEN");
}

