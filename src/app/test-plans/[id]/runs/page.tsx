import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import RunHistoryTable from "@/components/run-history/RunHistoryTable";

export const dynamic = "force-dynamic";

type TestPlanRunHistory = {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  scope: string;
  status: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  runs: Array<{
    id: string;
    status: string;
    summary: string;
    detailsJson?: any;
    attachmentsJson?: Array<{ name: string; url: string }>;
    createdAt: Date;
  }>;
};

export default async function TestPlanRunHistoryPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/test-plans/${params.id}/runs`);
  const locale = getServerLocale();
  const plan = await (prisma as any).testPlan.findUnique({
    where: { id: params.id },
    include: { runs: { orderBy: { createdAt: "desc" } } }
  }) as TestPlanRunHistory | null;
  if (!plan) return notFound();
  if (!(await canAccessProject(session, plan.projectId))) return notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("runHistory.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{t("runHistory.title", { locale })}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("runHistory.descriptionTestPlan", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-plans/${plan.id}`}
          >
            {t("common.back", { locale })}
          </Link>
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-plans/${plan.id}/run`}
          >
            {t("common.startRun", { locale })}
          </Link>
        </div>
      </div>

      <RunHistoryTable
        locale={locale}
        emptyLabel={t("runHistory.empty", { locale })}
        runs={plan.runs.map((run) => {
          const details = run.detailsJson as any;
          const cases = Array.isArray(details?.cases) ? details.cases : [];
          const checklists = Array.isArray(details?.checklists) ? details.checklists : [];
          const caseDone = cases.reduce((acc: number, c: any) => acc + (Array.isArray(c.stepDone) ? c.stepDone.filter(Boolean).length : 0), 0);
          const caseTotal = cases.reduce((acc: number, c: any) => acc + (Array.isArray(c.stepDone) ? c.stepDone.length : 0), 0);
          const clDone = checklists.reduce((acc: number, c: any) => acc + (Array.isArray(c.itemDone) ? c.itemDone.filter(Boolean).length : 0), 0);
          const clTotal = checklists.reduce((acc: number, c: any) => acc + (Array.isArray(c.itemDone) ? c.itemDone.length : 0), 0);
          const progress =
            caseTotal || clTotal
              ? `${caseDone}/${caseTotal} • ${clDone}/${clTotal}`
              : "";

          return {
            id: run.id,
            status: run.status,
            detail: [run.summary || t("testPlans.emptyText", { locale }), progress].filter(Boolean).join("\n"),
            notes: "",
            attachments: (run.attachmentsJson as any) ?? [],
            detailUrl: `/test-plans/${plan.id}/runs/${run.id}`,
            createdAt: run.createdAt
          };
        })}
      />
    </div>
  );
}
