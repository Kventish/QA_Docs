import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { saveRunAttachments } from "@/lib/run-attachments";

export const runtime = "nodejs";

const RunSchema = z.object({
  status: z.enum(["passed", "failed"]).optional().default("passed"),
  summary: z.string().optional().default("")
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const plan = await prisma.testPlan.findUnique({
    where: { id: params.id },
    include: {
      cases: { include: { testCase: true }, orderBy: { order: "asc" } },
      checklists: { include: { checklist: true }, orderBy: { order: "asc" } }
    } as any
  }) as any;
  if (!plan) return NextResponse.json({ error: "Test plan not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, plan.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const parsed = RunSchema.safeParse({
    status: formData.get("status")?.toString(),
    summary: formData.get("summary")?.toString()
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const prismaAny = prisma as any;
  const run = await prismaAny.testPlanRun.create({
    data: {
      testPlanId: params.id,
      status: parsed.data.status,
      summary: parsed.data.summary,
      detailsJson: {
        cases: plan.cases.map((item: any) => ({ id: item.testCaseId, title: item.testCase.title })),
        checklists: plan.checklists.map((item: any) => ({ id: item.checklistId, title: item.checklist.title }))
      },
      attachmentsJson: []
    }
  });

  const attachments = formData.getAll("attachments");
  const savedAttachments = await saveRunAttachments(run.id, attachments);
  const finalRun = savedAttachments.length
    ? await prismaAny.testPlanRun.update({
        where: { id: run.id },
        data: { attachmentsJson: savedAttachments }
      })
    : run;

  return NextResponse.json({ run: finalRun });
}
