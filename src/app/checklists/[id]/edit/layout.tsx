import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default function EditChecklistLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  requireRoleOrRedirect("editor", `/checklists/${params.id}`);
  return <>{children}</>;
}

