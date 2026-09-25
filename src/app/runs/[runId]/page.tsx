import { requireRoleOrRedirect } from "@/lib/rbac-server";
import RunWorkspace from "@/components/run-engine/RunWorkspace";
export const dynamic = "force-dynamic";
export default async function RunPage({ params }: { params: { runId: string } }) {
  await requireRoleOrRedirect("viewer", `/runs/${params.runId}`);
  return <RunWorkspace runId={params.runId} />;
}
