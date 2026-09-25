import { apiOperation, revisionBody, keySchema } from "@/lib/run-engine/api";
import { startPlanItem } from "@/lib/run-engine/service";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: { runId: string; itemId: string } }) {
  return apiOperation(async session => {
    const body = revisionBody.parse(await req.json());
    return { runId: await startPlanItem(params.runId, params.itemId, body.revision,
      keySchema.parse(req.headers.get("Idempotency-Key")), session) };
  });
}
