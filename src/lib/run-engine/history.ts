import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/auth";
import { Kind } from "./domain";
import { documentAccess, documentWhere } from "./service";

export async function runHistory(kind: Kind, id: string, session: SessionUser, page = 1) {
  const document = await documentAccess(kind, id, session);
  const where = documentWhere(kind, id);
  const [runs, total, legacy] = await Promise.all([
    prisma.run.findMany({ where, orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 30, take: 30,
      select: { id: true, startedAt: true, startedById: true, startedByEmailSnapshot: true, lifecycle: true, finalStatus: true, autoStatus: true, durationMs: true } }),
    prisma.run.count({ where }),
    // Scenario A: three existing TestCaseRun rows; no conversion of boolean step results.
    kind === "test_case" ? prisma.testCaseRun.findMany({ where: { testCaseId: id }, orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, status: true } }) : Promise.resolve([])
  ]);
  return { document: { id: document.id, title: document.title },
    runs: runs.map(run => ({ ...run, durationMs: run.durationMs === null ? null : Number(run.durationMs) })),
    legacy, total, page, pages: Math.max(1, Math.ceil(total / 30)) };
}
