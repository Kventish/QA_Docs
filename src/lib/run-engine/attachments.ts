import { randomUUID } from "crypto";
import { del, get, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/auth";
import { mutateRun, runAccess } from "./service";
import { RunError } from "./domain";
import { validateFile } from "./file-validation";

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured for Run attachments");
  return token;
}

export async function attachFile(runId: string, stepId: string | null, revision: number, file: File, session: SessionUser) {
  const { run } = await runAccess(prisma, runId, session, true);
  if (run.lifecycle !== "in_progress") throw new RunError("closed", 409);
  if (run.revision !== revision) throw new RunError("conflict", 409);
  if (stepId && !await prisma.stepRunResult.findFirst({ where: { id: stepId, runId } })) throw new RunError("notFound", 404);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = validateFile(file.name, file.type, bytes);
  const token = blobToken();
  const blob = await put(`runs/${runId}/${randomUUID()}`, Buffer.from(bytes), {
    access: "private", contentType: metadata.contentType, addRandomSuffix: true, token
  });
  try {
    await mutateRun(runId, revision, session, async (tx, _run, actor) => {
      if (stepId && !await tx.stepRunResult.findFirst({ where: { id: stepId, runId } })) throw new RunError("notFound", 404);
      await tx.runAttachment.create({ data: { runId, stepRunResultId: stepId, pathname: blob.pathname,
        ...metadata, size: bytes.length, uploadedById: actor.id, uploadedByEmailSnapshot: actor.email } });
    });
  } catch (error) {
    try { await del(blob.pathname, { token }); }
    catch (cleanupError) { console.error("Orphan private Blob requires cleanup", {
      pathname: blob.pathname,
      errorName: cleanupError instanceof Error ? cleanupError.name : "unknown",
      errorMessage: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
    }); }
    throw error;
  }
}

export async function streamAttachment(pathname: string, name: string, contentType?: string) {
  const blob = await get(pathname, { access: "private", token: blobToken() });
  if (!blob || blob.statusCode !== 200) return new Response(null, { status: 404 });
  const safe = name.replace(/[\x00-\x1f\x7f"\\/]/g, "_").slice(0, 200);
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
  return new Response(blob.stream, { headers: {
    "Content-Type": contentType ?? "application/octet-stream",
    "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encoded}`,
    "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox"
  } });
}
