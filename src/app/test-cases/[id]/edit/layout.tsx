import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default async function EditTestCaseLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  await requireRoleOrRedirect("editor", `/test-cases/${params.id}`);
  return <>{children}</>;
}
