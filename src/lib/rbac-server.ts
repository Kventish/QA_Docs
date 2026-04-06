import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

function hasRequiredRole(
  userRole: "admin" | "editor" | "viewer",
  required: "admin" | "editor" | "viewer"
) {
  if (required === "viewer") return true;
  if (required === "editor") return userRole === "editor" || userRole === "admin";
  return userRole === "admin";
}

export function requireRoleOrRedirect(required: "admin" | "editor" | "viewer", nextPath: string) {
  const session = getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!hasRequiredRole(session.role, required)) redirect("/");
  return session;
}

