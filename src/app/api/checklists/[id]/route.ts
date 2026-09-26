import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { deleteErrorResponse } from "@/lib/api-mutation-errors";

export const runtime = "nodejs";

const ItemSchema = z.object({
  text: z.string(),
  checked: z.boolean(),
  expectedResult: z.string().optional().default("")
});
const PatchSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
  items: z.array(ItemSchema).optional()
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const checklist = await prisma.checklist.findUnique({ where: { id: params.id } });
  if (!checklist) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, checklist.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ checklist });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.tags !== undefined) data.tags = parsed.data.tags;
  if (parsed.data.items !== undefined) data.itemsJson = parsed.data.items as unknown as object[];
  await prisma.checklist.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    await prisma.checklist.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return deleteErrorResponse(error, {
      action: "delete",
      entityType: "checklist",
      entityId: params.id
    });
  }
}

