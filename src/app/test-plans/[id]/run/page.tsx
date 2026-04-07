import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import RunTestPlanForm from "./RunTestPlanForm";
import { flattenTestCaseSteps } from "@/lib/test-case-includes";

type RunTestPlanCase = {
  testCaseId: string;
  testCase: {
    id: string;
    title: string;
    description: string;
    preconditions: string;
    expected: string;
    status: string;
    stepsJson: any;
  };
};

type RunTestPlanChecklist = {
  checklistId: string;
  checklist: {
    id: string;
    title: string;
    itemsJson: any;
    status: string;
  };
};

type TestPlanRunData = {
  id: string;
  title: string;
  objective: string;
  scope: string;
  projectId: string;
  cases: RunTestPlanCase[];
  checklists: RunTestPlanChecklist[];
};

export const dynamic = "force-dynamic";

export default async function RunTestPlanPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("editor", `/test-plans/${params.id}/run`);
  const locale = getServerLocale();
  const plan = await (prisma as any).testPlan.findUnique({
    where: { id: params.id },
    include: {
      cases: { include: { testCase: true }, orderBy: { order: "asc" } },
      checklists: { include: { checklist: true }, orderBy: { order: "asc" } }
    }
  }) as TestPlanRunData | null;
  if (!plan) return notFound();
  if (!(await canAccessProject(session, plan.projectId))) return notFound();

  const casesWithFlat = await Promise.all(
    plan.cases.map(async (item) => {
      const resolved = await flattenTestCaseSteps(prisma, item.testCase.id, plan.projectId);
      return {
        id: item.testCase.id,
        title: item.testCase.title,
        description: item.testCase.description,
        preconditions: item.testCase.preconditions,
        expected: item.testCase.expected,
        status: item.testCase.status,
        flatSteps: resolved.steps.map((s) => ({
          step: s.step,
          expectedResult: s.expectedResult,
          sourceTitle: s.sourceTestCaseId !== item.testCase.id ? s.sourceTestCaseTitle : undefined
        }))
      };
    })
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("testPlans.run.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{t("testPlans.run.title", { locale })}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("testPlans.run.description", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-plans/${params.id}`}
          >
            {t("common.back", { locale })}
          </Link>
        </div>
      </div>

      <RunTestPlanForm
        id={params.id}
        title={plan.title}
        objective={plan.objective}
        scope={plan.scope}
        cases={casesWithFlat}
        checklists={plan.checklists.map((item) => ({
          id: item.checklist.id,
          title: item.checklist.title,
          itemsJson: item.checklist.itemsJson,
          status: item.checklist.status
        }))}
      />
    </div>
  );
}
