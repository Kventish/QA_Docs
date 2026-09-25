import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/project-access";
import { legacyAttachments } from "@/lib/run-engine/legacy";
import { streamAttachment } from "@/lib/run-engine/attachments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Preserve the existing legacy URL, authorizing its actual Run/project on every request.
export async function GET(_req: Request, { params }: { params: { path?: string[] } }) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const [prefix, runId] = params.path ?? [];
  if (prefix !== "runs" || !runId) return new Response(null, { status: 404 });
  const run = await prisma.testCaseRun.findUnique({ where: { id: runId }, include: { testCase: { select: { projectId: true } } } });
  if (!run || !await canAccessProject(session, run.testCase.projectId)) return new Response(null, { status: 404 });
  const pathname = params.path!.join("/");
  const attachment = legacyAttachments(run.attachmentsJson, run.id).find(file => file.pathname === pathname);
  if (!attachment) return new Response(null, { status: 404 });
  return streamAttachment(pathname, attachment.name);
}
