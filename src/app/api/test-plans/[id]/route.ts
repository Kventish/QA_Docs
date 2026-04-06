import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { isValidJiraIssueKey, normalizeJiraIssueKey } from "@/lib/jira-keys";

export const runtime = "nodejs";

const PatchSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  objective: z.string().optional(),
  scope: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
  testCaseIds: z.array(z.string()).optional(),
  checklistIds: z.array(z.string()).optional(),
  jiraIssueKey: z.union([z.string(), z.null()]).optional()
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const plan = await prisma.testPlan.findUnique({
    where: { id: params.id },
    include: {
      cases: {
        include: { testCase: true },
        orderBy: { order: "asc" }
      },
      checklists: {
        include: { checklist: true },
        orderBy: { order: "asc" }
      }
    }
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, plan.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ testPlan: plan });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (parsed.data.jiraIssueKey !== undefined && parsed.data.jiraIssueKey !== null && parsed.data.jiraIssueKey !== "") {
    if (!isValidJiraIssueKey(parsed.data.jiraIssueKey)) {
      return NextResponse.json({ error: "Invalid Jira issue key format" }, { status: 400 });
    }
  }

  if (parsed.data.projectId !== undefined) {
    const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.projectId !== undefined) data.projectId = parsed.data.projectId;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.objective !== undefined) data.objective = parsed.data.objective;
  if (parsed.data.scope !== undefined) data.scope = parsed.data.scope;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.tags !== undefined) data.tags = parsed.data.tags;
  if (parsed.data.jiraIssueKey !== undefined) {
    const v = parsed.data.jiraIssueKey;
    data.jiraIssueKey =
      v === null || v === "" ? null : normalizeJiraIssueKey(v);
  }

  const updatePayload: Record<string, unknown> = { ...data };
  if (parsed.data.testCaseIds !== undefined) {
    updatePayload.cases = {
      deleteMany: {},
      create: parsed.data.testCaseIds.map((id, idx) => ({ testCaseId: id, order: idx }))
    };
  }
  if (parsed.data.checklistIds !== undefined) {
    updatePayload.checklists = {
      deleteMany: {},
      create: parsed.data.checklistIds.map((id, idx) => ({ checklistId: id, order: idx }))
    };
  }

  try {
    await prisma.testPlan.update({
      where: { id: params.id },
      data: updatePayload
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update test plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  await prisma.testPlan.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

