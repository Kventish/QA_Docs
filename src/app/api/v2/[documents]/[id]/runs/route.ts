import { z } from "zod";
import { apiOperation, keySchema, parseKind } from "@/lib/run-engine/api";
import { startRun } from "@/lib/run-engine/service";
import { runHistory } from "@/lib/run-engine/history";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { documents: string; id: string } };
export async function POST(req: Request, { params }: Context) {
  return apiOperation(async session => ({ runId: await startRun(parseKind(params.documents), params.id,
    keySchema.parse(req.headers.get("Idempotency-Key")), session) }));
}
export async function GET(req: Request, { params }: Context) {
  return apiOperation(session => runHistory(parseKind(params.documents), params.id, session,
    z.coerce.number().int().min(1).max(100000).parse(new URL(req.url).searchParams.get("page") ?? 1)));
}
