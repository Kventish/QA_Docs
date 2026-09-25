import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default async function NewTestCaseLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect("editor", "/test-cases");
  return <>{children}</>;
}
