import { apiOperation, revisionBody } from "@/lib/run-engine/api";
import { blockRemainingSteps, getRun } from "@/lib/run-engine/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { runId: string; stepId: string } }) {
  return apiOperation(async session => {
    const body = revisionBody.parse(await req.json());
    const result = await blockRemainingSteps(params.runId, params.stepId, body.revision, session);
    return { ...result, run: await getRun(params.runId, session) };
  }, {
    action: "blockRemainingSteps",
    context: () => ({ runId: params.runId, stepId: params.stepId })
  });
}
