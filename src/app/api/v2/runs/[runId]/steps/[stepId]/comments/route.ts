import { z } from "zod";
import { apiOperation } from "@/lib/run-engine/api";
import { addComment } from "@/lib/run-engine/service";
export const runtime = "nodejs";
const schema = z.object({ body: z.string().trim().min(1).max(10000) }).strict();
export async function POST(req: Request, { params }: { params: { runId: string; stepId: string } }) {
  return apiOperation(async session => {
    const body = schema.parse(await req.json());
    return { comment: await addComment(params.runId, params.stepId, body.body, session) };
  });
}
