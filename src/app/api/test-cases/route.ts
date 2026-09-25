import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { getDefaultProjectIdForSession } from "@/lib/project";
import { canAccessProject } from "@/lib/project-access";
import { parseStoredSteps, validateStepsForCreate } from "@/lib/test-case-includes";

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
    return NextResponse.json({ testCases: [] });
  }
  if (!(await canAccessProject(auth.session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const testCases = await prisma.testCase.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json({ testCases });
}

const StepRowSchema = z.union([
  z.object({
    kind: z.literal("include"),
    testCaseId: z.string().min(1)
  }),
  z.object({
    kind: z.literal("step").optional(),
    step: z.string().optional().default(""),
    expectedResult: z.string().optional().default(""),
    actualResult: z.string().optional().default("")
  })
]);

const CreateSchema = z.object({
  projectId: z.string().min(1, "Выберите проект"),
  title: z.string().min(1, "Укажите название"),
  description: z.string().optional().default(""),
  preconditions: z.string().optional().default(""),
  postconditions: z.string().optional().default(""),
  expected: z.string().optional().default(""),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  tags: z.array(z.string()).optional().default([]),
  steps: z.array(StepRowSchema).optional().default([])
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
  if (!(await canAccessProject(auth.session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const steps = parsed.data.steps ?? [];
  const rows = parseStoredSteps(steps);
  const v = await validateStepsForCreate(prisma, projectId, rows);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const created = await prisma.testCase.create({
    data: {
      projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      preconditions: parsed.data.preconditions ?? "",
      postconditions: parsed.data.postconditions ?? "",
      expected: parsed.data.expected ?? "",
      status: parsed.data.status ?? "draft",
      tags: parsed.data.tags ?? [],
      stepsJson: steps as unknown as object[]
    }
  });

  return NextResponse.json({ testCase: created });
}

