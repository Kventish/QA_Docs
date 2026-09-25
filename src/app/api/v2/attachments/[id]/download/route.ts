import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAccess } from "@/lib/run-engine/service";
import { streamAttachment } from "@/lib/run-engine/attachments";
import { RunError } from "@/lib/run-engine/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return new Response(null, { status: 401 });
    const attachment = await prisma.runAttachment.findUnique({ where: { id: params.id } });
    if (!attachment) return new Response(null, { status: 404 });
    await runAccess(prisma, attachment.runId, session);
    return await streamAttachment(attachment.pathname, attachment.originalName, attachment.contentType);
  } catch (error) {
    return new Response(null, { status: error instanceof RunError ? error.status : 500 });
  }
}
