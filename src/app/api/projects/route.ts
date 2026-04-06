import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { getAccessibleProjectIds } from "@/lib/project-access";

export const runtime = "nodejs";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 50);
}

export async function GET() {
  const auth = apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const accessibleIds = await getAccessibleProjectIds(auth.session);
  const projects = await prisma.project.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          testCases: true,
          checklists: true,
          testPlans: true
        }
      }
    }
  });

  const projectsWithCoverage = await Promise.all(
    projects.map(async (project) => {
      const totalTestCases = await prisma.testCase.count({
        where: { projectId: project.id }
      });
      const coveredTestCases = await prisma.testCase.count({
        where: {
          projectId: project.id,
          plans: { some: {} }
        }
      });
      const coverage = totalTestCases
        ? Math.round((coveredTestCases / totalTestCases) * 100)
        : 0;

      return {
        ...project,
        testCaseCount: project._count.testCases,
        checklistCount: project._count.checklists,
        testPlanCount: project._count.testPlans,
        coverage,
        totalTestCases,
        coveredTestCases
      };
    })
  );

  return NextResponse.json({ projects: projectsWithCoverage });
}

const CreateSchema = z.object({
  name: z.string().min(2).max(80)
});

export async function POST(req: Request) {
  const auth = apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const base = slugify(parsed.data.name) || "project";
  let slug = base;
  for (let i = 1; i < 50; i++) {
    const exists = await prisma.project.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${base}-${i}`;
  }

  const created = await prisma.project.create({
    data: { name: parsed.data.name, slug }
  });

  return NextResponse.json({ project: created });
}

