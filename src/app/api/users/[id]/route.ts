import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      projectAccesses: { select: { projectId: true } }
    }
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      projectIds: user.projectAccesses.map((x) => x.projectId)
    }
  });
}

const PatchSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  password: z.string().min(6).optional(),
  projectIds: z.array(z.string()).optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const isSelf = auth.session.id === params.id;
  const force = new URL(req.url).searchParams.get("force") === "true";
  if (isSelf && !force && parsed.data.role && parsed.data.role !== "admin") {
    return NextResponse.json({ error: "Cannot downgrade current admin" }, { status: 400 });
  }

  const projectIds = parsed.data.projectIds ? Array.from(new Set(parsed.data.projectIds)) : undefined;
  const roleToSet = parsed.data.role;
  const currentUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { role: true }
  });
  const effectiveRole = roleToSet ?? currentUser?.role;
  if (effectiveRole === "viewer" && projectIds !== undefined && projectIds.length === 0) {
    return NextResponse.json({ error: "Viewer must have at least one project" }, { status: 400 });
  }
  if (projectIds && projectIds.length > 0) {
    const count = await prisma.project.count({ where: { id: { in: projectIds } } });
    if (count !== projectIds.length) {
      return NextResponse.json({ error: "Some projects not found" }, { status: 400 });
    }
  }

  const data: any = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, role: true, createdAt: true, updatedAt: true }
  });

  if (effectiveRole === "viewer" && projectIds !== undefined) {
    await prisma.userProjectAccess.deleteMany({ where: { userId: params.id } });
    if (projectIds.length > 0) {
      await prisma.userProjectAccess.createMany({
        data: projectIds.map((projectId) => ({ userId: params.id, projectId }))
      });
    }
  } else if (effectiveRole !== "viewer") {
    await prisma.userProjectAccess.deleteMany({ where: { userId: params.id } });
  }

  const updatedWithAccess = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      projectAccesses: { select: { projectId: true } }
    }
  });
  return NextResponse.json({
    user: updatedWithAccess
      ? {
          id: updatedWithAccess.id,
          email: updatedWithAccess.email,
          role: updatedWithAccess.role,
          createdAt: updatedWithAccess.createdAt,
          updatedAt: updatedWithAccess.updatedAt,
          projectIds: updatedWithAccess.projectAccesses.map((x) => x.projectId)
        }
      : updated
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const isSelf = auth.session.id === params.id;
  const force = new URL(req.url).searchParams.get("force") === "true";

  if (isSelf && !force) {
    return NextResponse.json({ error: "Cannot delete current user" }, { status: 400 });
  }

  await prisma.user.updateMany({
    where: { id: params.id, deletedAt: null },
    data: { deletedAt: new Date(), disabledAt: new Date() }
  });
  return NextResponse.json({ ok: true });
}

