import { z } from "zod";
import { apiOperation, revisionSchema } from "@/lib/run-engine/api";
import { getRun } from "@/lib/run-engine/service";
import { uploadForm, MAX_FILE_BYTES } from "@/lib/run-engine/file-validation";
import { attachFile } from "@/lib/run-engine/attachments";
import { RunError } from "@/lib/run-engine/domain";
export const runtime = "nodejs";
function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string" && typeof value.name === "string" && typeof value.arrayBuffer === "function";
}
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  const context: Record<string, unknown> = { runId: params.runId };
  return apiOperation(async session => {
    const form = await uploadForm(req);
    const file = form.get("file");
    const stepValues = form.getAll("stepRunResultId");
    if (!isUploadedFile(file) || [...form.values()].filter(value => isUploadedFile(value)).length !== 1 ||
      form.getAll("revision").length !== 1 || stepValues.length > 1) throw new RunError("invalidPayload");
    context.fileName = file.name;
    context.fileSize = file.size;
    context.contentType = file.type;
    if (file.size > MAX_FILE_BYTES) throw new RunError("fileSize", 413);
    const revision = revisionSchema.parse(Number(form.get("revision")));
    const stepId = stepValues.length ? z.string().min(1).parse(stepValues[0]) : null;
    context.stepRunResultId = stepId;
    await attachFile(params.runId, stepId, revision, file, session);
    return { run: await getRun(params.runId, session) };
  }, { action: "runAttachmentUpload", context: () => context });
}
