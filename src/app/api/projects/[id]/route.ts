import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  await prisma.project.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

