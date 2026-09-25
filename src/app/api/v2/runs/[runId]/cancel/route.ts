import { z } from "zod";
import { apiOperation, revisionSchema, reasonSchema } from "@/lib/run-engine/api";
import { getRun, cancelRun } from "@/lib/run-engine/service";
export const runtime = "nodejs";
const schema = z.object({ revision: revisionSchema, reason: reasonSchema }).strict();
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  return apiOperation(async session => {
    const body = schema.parse(await req.json());
    await cancelRun(params.runId, body.revision, body.reason, session);
    return { run: await getRun(params.runId, session) };
  });
}
