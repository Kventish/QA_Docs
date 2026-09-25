import { getSession } from "@/lib/auth";

export type ApiAuthResult =
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; status: 401 | 403 };

function hasRequiredRole(
  userRole: "admin" | "editor" | "viewer",
  required: "admin" | "editor" | "viewer"
) {
  if (required === "viewer") return true;
  if (required === "editor") return userRole === "editor" || userRole === "admin";
  return userRole === "admin";
}

export async function apiRequireRole(required: "admin" | "editor" | "viewer"): Promise<ApiAuthResult> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401 };
  if (!hasRequiredRole(session.role, required)) return { ok: false, status: 403 };
  return { ok: true, session };
}

