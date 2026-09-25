import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default async function EditChecklistLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  await requireRoleOrRedirect("editor", `/checklists/${params.id}`);
  return <>{children}</>;
}

