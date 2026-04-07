import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import RunHistoryTable from "@/components/run-history/RunHistoryTable";

export const dynamic = "force-dynamic";

type TestCaseRunHistory = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  tags: string[];
  description: string;
  preconditions: string;
  expected: string;
  createdAt: Date;
  updatedAt: Date;
  stepsJson: any;
  runs: Array<{
    id: string;
    status: string;
    actualResult: string;
    notes: string;
    attachmentsJson?: Array<{ name: string; url: string }>;
    createdAt: Date;
  }>;
};

export default async function TestCaseRunHistoryPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/test-cases/${params.id}/runs`);
  const locale = getServerLocale();
  const tc = await (prisma as any).testCase.findUnique({
    where: { id: params.id },
    include: { runs: { orderBy: { createdAt: "desc" } } }
  }) as TestCaseRunHistory | null;
  if (!tc) return notFound();
  if (!(await canAccessProject(session, tc.projectId))) return notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("runHistory.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{t("runHistory.title", { locale })}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("runHistory.descriptionTestCase", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-cases/${tc.id}`}
          >
            {t("common.back", { locale })}
          </Link>
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-cases/${tc.id}/run`}
          >
            {t("common.startRun", { locale })}
          </Link>
        </div>
      </div>

      <RunHistoryTable
        locale={locale}
        emptyLabel={t("runHistory.empty", { locale })}
        runs={tc.runs.map((run) => ({
          id: run.id,
          status: run.status,
          detail: run.actualResult || t("testCases.emptyText", { locale }),
          notes: run.notes || "",
          attachments: (run.attachmentsJson as any) ?? [],
          detailUrl: `/test-cases/${tc.id}/runs/${run.id}`,
          createdAt: run.createdAt
        }))}
      />
    </div>
  );
}
