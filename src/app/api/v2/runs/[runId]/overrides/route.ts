import { z } from "zod";
import { apiOperation, revisionSchema, reasonSchema, resultSchema } from "@/lib/run-engine/api";
import { getRun, overrideRun } from "@/lib/run-engine/service";
export const runtime = "nodejs";
const schema = z.object({ revision: revisionSchema, reason: reasonSchema, finalStatus: resultSchema }).strict();
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  return apiOperation(async session => {
    const body = schema.parse(await req.json());
    await overrideRun(params.runId, body.revision, body.finalStatus, body.reason, session);
    return { run: await getRun(params.runId, session) };
  });
}
