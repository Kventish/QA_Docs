import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, createdAt: true, updatedAt: true }
  });
  return NextResponse.json({ users });
}

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "editor", "viewer"]),
  projectIds: z.array(z.string()).optional().default([])
});

export async function POST(req: Request) {
  const auth = apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const projectIds = Array.from(new Set(parsed.data.projectIds ?? []));
  if (parsed.data.role === "viewer") {
    if (projectIds.length === 0) {
      return NextResponse.json({ error: "Viewer must have at least one project" }, { status: 400 });
    }
    const count = await prisma.project.count({ where: { id: { in: projectIds } } });
    if (count !== projectIds.length) {
      return NextResponse.json({ error: "Some projects not found" }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const created = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      projectAccesses:
        parsed.data.role === "viewer" && projectIds.length > 0
          ? {
              createMany: {
                data: projectIds.map((projectId) => ({ projectId }))
              }
            }
          : undefined
    }
  });

  return NextResponse.json({
    user: { id: created.id, email: created.email, role: created.role }
  });
}

