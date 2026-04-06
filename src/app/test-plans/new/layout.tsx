import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default function NewTestPlanLayout({
  children
}: {
  children: React.ReactNode;
}) {
  requireRoleOrRedirect("editor", "/test-plans");
  return <>{children}</>;
}
