import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: { id: string; runId: string } }) {
 const session = await requireRoleOrRedirect("viewer", `/test-plans/${params.id}/runs/${params.runId}`);
 const run = await prisma.run.findFirst({ where: { id: params.runId, testPlanId: params.id } });
 if (!run || !await canAccessProject(session, run.projectId)) notFound();
 redirect(`/runs/${run.id}`);
}
