import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { getDefaultProjectIdForSession } from "@/lib/project";
import { canAccessProject } from "@/lib/project-access";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const url = new URL(req.url);
  let projectId = url.searchParams.get("projectId") ?? null;
  if (!projectId) {
    try {
      projectId = await getDefaultProjectIdForSession(auth.session);
    } catch {
      return NextResponse.json(
        { error: "Default project missing. Run: npm run db:seed" },
        { status: 503 }
      );
    }
  }
  if (!projectId) {
    return NextResponse.json({ testPlans: [] });
  }
  if (!(await canAccessProject(auth.session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const testPlans = await prisma.testPlan.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json({ testPlans });
}

const CreateSchema = z.object({
  projectId: z.string().min(1, "Выберите проект"),
  title: z.string().min(1, "Укажите название"),
  objective: z.string().optional().default(""),
  scope: z.string().optional().default(""),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  tags: z.array(z.string()).optional().default([]),
  testCaseIds: z.array(z.string()).optional().default([]),
  checklistIds: z.array(z.string()).optional().default([])
});

export async function POST(req: Request) {
  const auth = await apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const projectId = parsed.data.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 400 });
  }

  let created;
  try {
    created = await prisma.testPlan.create({
      data: {
        projectId,
        title: parsed.data.title,
        objective: parsed.data.objective ?? "",
        scope: parsed.data.scope ?? "",
        status: parsed.data.status ?? "draft",
        tags: parsed.data.tags ?? [],
        cases: {
          create: (parsed.data.testCaseIds ?? []).map((id, idx) => ({
            testCaseId: id,
            order: idx
          }))
        },
        checklists: {
          create: (parsed.data.checklistIds ?? []).map((id, idx) => ({
            checklistId: id,
            order: idx
          }))
        }
      },
      include: { cases: true, checklists: true }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create test plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ testPlan: created });
}

