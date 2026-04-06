import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { isValidJiraIssueKey, isValidJiraProjectKey, normalizeJiraIssueKey } from "@/lib/jira-keys";

export const runtime = "nodejs";

const PatchSchema = z.object({
  jiraProjectKey: z.union([z.string(), z.null()]).optional(),
  jiraEpicKey: z.union([z.string(), z.null()]).optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, project.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.jiraProjectKey !== undefined && parsed.data.jiraProjectKey !== null && parsed.data.jiraProjectKey !== "") {
    if (!isValidJiraProjectKey(parsed.data.jiraProjectKey)) {
      return NextResponse.json({ error: "Invalid Jira project key format" }, { status: 400 });
    }
  }
  if (parsed.data.jiraEpicKey !== undefined && parsed.data.jiraEpicKey !== null && parsed.data.jiraEpicKey !== "") {
    if (!isValidJiraIssueKey(parsed.data.jiraEpicKey)) {
      return NextResponse.json({ error: "Invalid Jira epic issue key format" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.jiraProjectKey !== undefined) {
    const v = parsed.data.jiraProjectKey;
    data.jiraProjectKey = v === null || v === "" ? null : v.trim().toUpperCase();
  }
  if (parsed.data.jiraEpicKey !== undefined) {
    const v = parsed.data.jiraEpicKey;
    data.jiraEpicKey = v === null || v === "" ? null : normalizeJiraIssueKey(v);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data
  });
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  await prisma.project.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

