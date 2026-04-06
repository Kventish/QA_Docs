import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default function NewChecklistLayout({
  children
}: {
  children: React.ReactNode;
}) {
  requireRoleOrRedirect("editor", "/checklists");
  return <>{children}</>;
}
