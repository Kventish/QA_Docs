import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default async function NewChecklistLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect("editor", "/checklists");
  return <>{children}</>;
}
