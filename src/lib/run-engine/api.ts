import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession, SessionUser } from "@/lib/auth";
import { RunError, Kind } from "./domain";

export const revisionSchema = z.number().int().nonnegative();
export const resultSchema = z.enum(["passed", "failed", "questionable"]);
export const severitySchema = z.enum(["low", "medium", "high", "critical"]);
export const reasonSchema = z.string().trim().min(1).max(5000);
export const keySchema = z.string().min(8).max(100).regex(/^[A-Za-z0-9:_-]+$/);
export const revisionBody = z.object({ revision: revisionSchema });

export function parseKind(documents: string): Kind {
  if (documents === "test-cases") return "test_case";
  if (documents === "checklists") return "checklist";
  if (documents === "test-plans") return "test_plan";
  throw new RunError("notFound", 404);
}

type ApiOperationLog = {
  action?: string;
  context?: () => Record<string, unknown>;
};

export async function apiOperation(operation: (session: SessionUser) => Promise<unknown>, log: ApiOperationLog = {}) {
  try {
    const session = await getSession();
    if (!session) throw new RunError("unauthorized", 401);
    return NextResponse.json(await operation(session), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RunError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "invalidPayload" }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    }
    console.error("Run engine request failed", {
      action: log.action ?? "unknown",
      ...(log.context?.() ?? {}),
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
