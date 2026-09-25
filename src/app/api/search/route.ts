import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { getAccessibleProjectIds } from "@/lib/project-access";

export const runtime = "nodejs";

const LIMIT = 8;

export async function GET(req: Request) {
  const auth = await apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ testCases: [], checklists: [], testPlans: [] });
  }
  const accessibleIds = await getAccessibleProjectIds(auth.session);
  const whereBase = accessibleIds ? { projectId: { in: accessibleIds } } : {};

  const [testCases, checklists, testPlans] = await Promise.all([
    prisma.testCase.findMany({
      where: { ...whereBase, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: LIMIT
    }),
    prisma.checklist.findMany({
      where: { ...whereBase, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: LIMIT
    }),
    prisma.testPlan.findMany({
      where: { ...whereBase, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: LIMIT
    })
  ]);

  return NextResponse.json({ testCases, checklists, testPlans });
}
