import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { saveRunAttachments } from "@/lib/run-attachments";

export const runtime = "nodejs";

const RunSchema = z.object({
  status: z.enum(["passed", "failed"]).optional().default("passed"),
  actualResult: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  stepResults: z
    .array(
      z.object({
        index: z.number().min(0),
        done: z.boolean(),
        note: z.string().optional().default("")
      })
    )
    .optional()
    .default([])
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const testCase = await prisma.testCase.findUnique({ where: { id: params.id } });
  if (!testCase) return NextResponse.json({ error: "Test case not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, testCase.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const stepResultsValue = formData.get("stepResults")?.toString() ?? "[]";
  let stepResults = [];
  try {
    stepResults = JSON.parse(stepResultsValue);
  } catch {
    stepResults = [];
  }

  const parsed = RunSchema.safeParse({
    status: formData.get("status")?.toString(),
    actualResult: formData.get("actualResult")?.toString(),
    notes: formData.get("notes")?.toString(),
    stepResults
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const run = await prisma.testCaseRun.create({
    data: {
      testCaseId: params.id,
      status: parsed.data.status,
      actualResult: parsed.data.actualResult,
      notes: parsed.data.notes,
      stepsJson: parsed.data.stepResults,
      attachmentsJson: []
    }
  });

  const attachments = formData.getAll("attachments");
  const savedAttachments = await saveRunAttachments(run.id, attachments);
  const finalRun = savedAttachments.length
    ? await prisma.testCaseRun.update({
        where: { id: run.id },
        data: { attachmentsJson: savedAttachments }
      })
    : run;

  return NextResponse.json({ run: finalRun });
}
