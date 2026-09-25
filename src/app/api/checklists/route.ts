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
    return NextResponse.json({ checklists: [] });
  }
  if (!(await canAccessProject(auth.session, projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const checklists = await prisma.checklist.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json({ checklists });
}

const ItemSchema = z.object({
  text: z.string(),
  checked: z.boolean(),
  expectedResult: z.string().optional().default("")
});

const CreateSchema = z.object({
  projectId: z.string().min(1, "Выберите проект"),
  title: z.string().min(1, "Укажите название"),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  tags: z.array(z.string()).optional().default([]),
  items: z.array(ItemSchema).optional().default([])
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

  const created = await prisma.checklist.create({
    data: {
      projectId,
      title: parsed.data.title,
      status: parsed.data.status ?? "draft",
      tags: parsed.data.tags ?? [],
      itemsJson: parsed.data.items ?? []
    }
  });

  return NextResponse.json({ checklist: created });
}

