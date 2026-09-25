import { apiOperation } from "@/lib/run-engine/api";
import { getRun } from "@/lib/run-engine/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  return apiOperation(async session => ({ run: await getRun(params.runId, session) }));
}
