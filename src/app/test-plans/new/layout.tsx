import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default async function NewTestPlanLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect("editor", "/test-plans");
  return <>{children}</>;
}
