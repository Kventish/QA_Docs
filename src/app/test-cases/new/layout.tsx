import { requireRoleOrRedirect } from "@/lib/rbac-server";

export default function NewTestCaseLayout({
  children
}: {
  children: React.ReactNode;
}) {
  requireRoleOrRedirect("editor", "/test-cases");
  return <>{children}</>;
}
