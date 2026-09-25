import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import StartRun from "@/components/run-engine/StartRun";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: { id: string } }) {
 const session = await requireRoleOrRedirect("editor", `/test-cases/${params.id}/run`);
 const document = await prisma.testCase.findUnique({ where: { id: params.id } });
 if (!document || !await canAccessProject(session, document.projectId)) notFound();
 const activeRun = await prisma.run.findFirst({ where: { testCaseId: params.id, startedById: session.id, lifecycle: "in_progress", planItem: null }, orderBy: { startedAt: "desc" }, select: { id: true, startedAt: true, startedByEmailSnapshot: true } });
 const executableCount = Array.isArray(document.stepsJson) ? document.stepsJson.length : undefined;
 return <StartRun kind="test_case" id={params.id} title={document.title} status={document.status} executableCount={executableCount}
  activeRun={activeRun ? { ...activeRun, startedAt: activeRun.startedAt.toISOString() } : null} serverNow={new Date().toISOString()} />;
}
