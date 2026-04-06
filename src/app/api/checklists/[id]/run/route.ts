import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { saveRunAttachments } from "@/lib/run-attachments";

export const runtime = "nodejs";

const RunSchema = z.object({
  status: z.enum(["passed", "failed"]).optional().default("passed"),
  notes: z.string().optional().default(""),
  itemResults: z
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

  const checklist = await prisma.checklist.findUnique({ where: { id: params.id } });
  if (!checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, checklist.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const itemResultsValue = formData.get("itemResults")?.toString() ?? "[]";
  let itemResults = [];
  try {
    itemResults = JSON.parse(itemResultsValue);
  } catch {
    itemResults = [];
  }

  const parsed = RunSchema.safeParse({
    status: formData.get("status")?.toString(),
    notes: formData.get("notes")?.toString(),
    itemResults
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const prismaAny = prisma as any;
  const run = await prismaAny.checklistRun.create({
    data: {
      checklistId: params.id,
      status: parsed.data.status,
      itemResults: parsed.data.itemResults,
      notes: parsed.data.notes,
      attachmentsJson: []
    }
  });

  const attachments = formData.getAll("attachments");
  const savedAttachments = await saveRunAttachments(run.id, attachments);
  const finalRun = savedAttachments.length
    ? await prismaAny.checklistRun.update({
        where: { id: run.id },
        data: { attachmentsJson: savedAttachments }
      })
    : run;

  return NextResponse.json({ run: finalRun });
}
