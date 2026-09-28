import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { deleteErrorResponse } from "@/lib/api-mutation-errors";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await apiRequireRole("admin");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return deleteErrorResponse(error, {
      action: "delete",
      entityType: "project",
      entityId: params.id
    });
  }
}

