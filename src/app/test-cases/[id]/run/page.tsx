import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import RunTestCaseForm from "./RunTestCaseForm";
import { flattenTestCaseSteps } from "@/lib/test-case-includes";

type Step = { step?: string; expectedResult?: string; actualResult?: string; sourceTitle?: string };

export const dynamic = "force-dynamic";

export default async function RunTestCasePage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/test-cases/${params.id}/run`);
  const locale = getServerLocale();
  const tc = await prisma.testCase.findUnique({ where: { id: params.id } });
  if (!tc) return notFound();
  if (!(await canAccessProject(session, tc.projectId))) return notFound();
  const resolved = await flattenTestCaseSteps(prisma, tc.id, tc.projectId);
  const steps: Step[] = resolved.steps.map((s) => ({
    step: s.step,
    expectedResult: s.expectedResult,
    actualResult: s.actualResult,
    sourceTitle: s.sourceTestCaseId !== tc.id ? s.sourceTestCaseTitle : undefined
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("testCases.run.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{t("testCases.run.title", { locale })}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("testCases.run.description", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-cases/${params.id}`}
          >
            {t("common.back", { locale })}
          </Link>
        </div>
      </div>

      <RunTestCaseForm
        id={params.id}
        title={tc.title}
        description={tc.description}
        preconditions={tc.preconditions}
        postconditions={tc.postconditions}
        expectedResult={tc.expected}
        steps={steps}
      />
    </div>
  );
}
