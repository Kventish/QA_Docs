import { z } from "zod";
import { apiOperation, revisionSchema, resultSchema, reasonSchema } from "@/lib/run-engine/api";
import { getRun, completeRun } from "@/lib/run-engine/service";
export const runtime = "nodejs";
const schema = z.object({ revision: revisionSchema, override: z.object({ finalStatus: resultSchema, reason: reasonSchema }).optional() }).strict();
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  return apiOperation(async session => {
    const body = schema.parse(await req.json());
    await completeRun(params.runId, body.revision, session, body.override);
    return { run: await getRun(params.runId, session) };
  });
}
