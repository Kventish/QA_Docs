import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";

export const runtime = "nodejs";

type Kind = "testCase" | "checklist" | "testPlan" | "testCaseRun" | "checklistRun" | "testPlanRun";

function parsePathname(pathname: string): { kind: Kind; id: string; runId?: string } | null {
  // Entities
  let m = pathname.match(/^\/test-cases\/([^/]+)\/?$/);
  if (m) return { kind: "testCase", id: m[1] };
  m = pathname.match(/^\/checklists\/([^/]+)\/?$/);
  if (m) return { kind: "checklist", id: m[1] };
  m = pathname.match(/^\/test-plans\/([^/]+)\/?$/);
  if (m) return { kind: "testPlan", id: m[1] };

  // Runs
  m = pathname.match(/^\/test-cases\/([^/]+)\/runs\/([^/]+)\/?$/);
  if (m) return { kind: "testCaseRun", id: m[1], runId: m[2] };
  m = pathname.match(/^\/checklists\/([^/]+)\/runs\/([^/]+)\/?$/);
  if (m) return { kind: "checklistRun", id: m[1], runId: m[2] };
  m = pathname.match(/^\/test-plans\/([^/]+)\/runs\/([^/]+)\/?$/);
  if (m) return { kind: "testPlanRun", id: m[1], runId: m[2] };
  return null;
}

function countDone(arr: unknown) {
  if (!Array.isArray(arr)) return { done: 0, total: 0 };
  const total = arr.length;
  const done = (arr as any[]).filter(Boolean).length;
  return { done, total };
}

function firstFailedIndex(arr: unknown): number | null {
  if (!Array.isArray(arr)) return null;
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i]) return i;
  }
  return null;
}

export async function GET(req: Request) {
  const auth = apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  const parsed = parsePathname(path);
  if (!parsed) return NextResponse.json({ ok: true, context: null });

  if (parsed.kind === "testCase") {
    const tc = await prisma.testCase.findUnique({ where: { id: parsed.id } });
    if (!tc) return NextResponse.json({ ok: true, context: null });
    if (!(await canAccessProject(auth.session, tc.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      ok: true,
      context: {
        kind: parsed.kind,
        id: tc.id,
        title: tc.title,
        links: {
          entityUrl: `/test-cases/${tc.id}`,
          runsUrl: `/test-cases/${tc.id}/runs`
        }
      }
    });
  }

  if (parsed.kind === "checklist") {
    const cl = await prisma.checklist.findUnique({ where: { id: parsed.id } });
    if (!cl) return NextResponse.json({ ok: true, context: null });
    if (!(await canAccessProject(auth.session, cl.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      ok: true,
      context: {
        kind: parsed.kind,
        id: cl.id,
        title: cl.title,
        links: {
          entityUrl: `/checklists/${cl.id}`,
          runsUrl: `/checklists/${cl.id}/runs`
        }
      }
    });
  }

  if (parsed.kind === "testPlan") {
    const plan = await prisma.testPlan.findUnique({
      where: { id: parsed.id },
      include: {
        cases: { include: { testCase: true }, orderBy: { order: "asc" } },
        checklists: { include: { checklist: true }, orderBy: { order: "asc" } }
      } as any
    }) as any;
    if (!plan) return NextResponse.json({ ok: true, context: null });
    if (!(await canAccessProject(auth.session, plan.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({
      ok: true,
      context: {
        kind: parsed.kind,
        id: plan.id,
        title: plan.title,
        linked: {
          testCases: (plan.cases ?? []).map((c: any) => ({ id: c.testCaseId, title: c.testCase?.title ?? "" })),
          checklists: (plan.checklists ?? []).map((c: any) => ({ id: c.checklistId, title: c.checklist?.title ?? "" }))
        },
        links: {
          entityUrl: `/test-plans/${plan.id}`,
          runsUrl: `/test-plans/${plan.id}/runs`
        }
      }
    });
  }

  if (parsed.kind === "testCaseRun") {
    const run = await (prisma as any).testCaseRun.findUnique({
      where: { id: parsed.runId },
      include: { testCase: true }
    }) as any;
    if (!run || run.testCase?.id !== parsed.id) return NextResponse.json({ ok: true, context: null });
    if (!(await canAccessProject(auth.session, run.testCase.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const steps = Array.isArray(run.stepsJson) ? run.stepsJson : [];
    const doneArr = steps.map((s: any) => !!s?.done);
    const progress = countDone(doneArr);
    const firstFail = firstFailedIndex(doneArr);

    return NextResponse.json({
      ok: true,
      context: {
        kind: parsed.kind,
        id: run.id,
        title: run.testCase?.title ?? "",
        run: {
          status: run.status,
          progress,
          firstFailStep: firstFail !== null ? firstFail + 1 : null,
          attachmentsCount: Array.isArray(run.attachmentsJson) ? run.attachmentsJson.length : 0
        },
        links: {
          entityUrl: `/test-cases/${run.testCase.id}`,
          runsUrl: `/test-cases/${run.testCase.id}/runs`
        }
      }
    });
  }

  if (parsed.kind === "checklistRun") {
    const run = await (prisma as any).checklistRun.findUnique({
      where: { id: parsed.runId },
      include: { checklist: true }
    }) as any;
    if (!run || run.checklist?.id !== parsed.id) return NextResponse.json({ ok: true, context: null });
    if (!(await canAccessProject(auth.session, run.checklist.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const items = Array.isArray(run.itemResults) ? run.itemResults : [];
    const doneArr = items.map((s: any) => !!s?.done);
    const progress = countDone(doneArr);
    const firstFail = firstFailedIndex(doneArr);

    return NextResponse.json({
      ok: true,
      context: {
        kind: parsed.kind,
        id: run.id,
        title: run.checklist?.title ?? "",
        run: {
          status: run.status,
          progress,
          firstFailStep: firstFail !== null ? firstFail + 1 : null,
          attachmentsCount: Array.isArray(run.attachmentsJson) ? run.attachmentsJson.length : 0
        },
        links: {
          entityUrl: `/checklists/${run.checklist.id}`,
          runsUrl: `/checklists/${run.checklist.id}/runs`
        }
      }
    });
  }

  // testPlanRun
  const run = await (prisma as any).testPlanRun.findUnique({
    where: { id: parsed.runId },
    include: { testPlan: true }
  }) as any;
  if (!run || run.testPlan?.id !== parsed.id) return NextResponse.json({ ok: true, context: null });
  if (!(await canAccessProject(auth.session, run.testPlan.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const details = (run.detailsJson as any) ?? {};
  const cases = Array.isArray(details?.cases) ? details.cases : [];
  const checklists = Array.isArray(details?.checklists) ? details.checklists : [];
  const caseDoneArr = cases.flatMap((c: any) => (Array.isArray(c.stepDone) ? c.stepDone : []));
  const clDoneArr = checklists.flatMap((c: any) => (Array.isArray(c.itemDone) ? c.itemDone : []));
  const progress = {
    cases: countDone(caseDoneArr),
    checklists: countDone(clDoneArr)
  };
  const failedCases = cases
    .map((c: any) => {
      const done = Array.isArray(c.stepDone) ? c.stepDone : [];
      const firstFail = firstFailedIndex(done);
      if (firstFail === null) return null;
      return { id: c.id, title: c.title ?? c.id, firstFailStep: firstFail + 1 };
    })
    .filter(Boolean);
  const failedChecklists = checklists
    .map((c: any) => {
      const done = Array.isArray(c.itemDone) ? c.itemDone : [];
      const firstFail = firstFailedIndex(done);
      if (firstFail === null) return null;
      return { id: c.id, title: c.title ?? c.id, firstFailStep: firstFail + 1 };
    })
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    context: {
      kind: parsed.kind,
      id: run.id,
      title: run.testPlan?.title ?? "",
      run: {
        status: run.status,
        progress,
        failed: {
          testCases: failedCases,
          checklists: failedChecklists
        },
        attachmentsCount: Array.isArray(run.attachmentsJson) ? run.attachmentsJson.length : 0
      },
      links: {
        entityUrl: `/test-plans/${run.testPlan.id}`,
        runsUrl: `/test-plans/${run.testPlan.id}/runs`
      }
    }
  });
}

