import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { parseStoredSteps, validateStepsForSave } from "@/lib/test-case-includes";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const tc = await prisma.testCase.findUnique({ where: { id: params.id } });
  if (!tc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, tc.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ testCase: tc });
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

const PatchSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  preconditions: z.string().optional(),
  postconditions: z.string().optional(),
  expected: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
  steps: z.array(StepRowSchema).optional()
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.testCase.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, existing.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.projectId !== undefined) {
    const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }
  }

  const effectiveProjectId = parsed.data.projectId ?? existing.projectId;

  const data: Record<string, unknown> = {};
  if (parsed.data.projectId !== undefined) data.projectId = parsed.data.projectId;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.preconditions !== undefined) data.preconditions = parsed.data.preconditions;
  if (parsed.data.postconditions !== undefined) data.postconditions = parsed.data.postconditions;
  if (parsed.data.expected !== undefined) data.expected = parsed.data.expected;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.tags !== undefined) data.tags = parsed.data.tags;
  if (parsed.data.steps !== undefined) {
    const rows = parseStoredSteps(parsed.data.steps);
    const v = await validateStepsForSave(prisma, effectiveProjectId, params.id, rows);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    data.stepsJson = parsed.data.steps as unknown as object[];
  }

  const updated = await prisma.testCase.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json({ testCase: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  await prisma.testCase.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
