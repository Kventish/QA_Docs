import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default function EditTestCaseLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  requireRoleOrRedirect("editor", `/test-cases/${params.id}`);
  return <>{children}</>;
}
