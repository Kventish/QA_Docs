import { z } from "zod";
import { apiOperation, revisionSchema, resultSchema, severitySchema } from "@/lib/run-engine/api";
import { updateStep } from "@/lib/run-engine/service";
export const runtime = "nodejs";
const schema = z.object({ stepRevision: revisionSchema, result: resultSchema.nullable(),
  severity: severitySchema.nullable(), actualResult: z.string().max(20000) }).strict();
export async function PATCH(req: Request, { params }: { params: { runId: string; stepId: string } }) {
  return apiOperation(async session => {
    const body = schema.parse(await req.json());
    return updateStep(params.runId, params.stepId, session, body);
  });
}
