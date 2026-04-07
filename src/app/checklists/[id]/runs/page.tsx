import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import RunHistoryTable from "@/components/run-history/RunHistoryTable";

export const dynamic = "force-dynamic";

type ChecklistRunHistory = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  tags: string[];
  itemsJson: any;
  createdAt: Date;
  updatedAt: Date;
  runs: Array<{
    id: string;
    status: string;
    itemResults: any;
    notes: string;
    attachmentsJson?: Array<{ name: string; url: string }>;
    createdAt: Date;
  }>;
};

export default async function ChecklistRunHistoryPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/checklists/${params.id}/runs`);
  const locale = getServerLocale();
  const cl = await (prisma as any).checklist.findUnique({
    where: { id: params.id },
    include: { runs: { orderBy: { createdAt: "desc" } } }
  }) as ChecklistRunHistory | null;
  if (!cl) return notFound();
  if (!(await canAccessProject(session, cl.projectId))) return notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("runHistory.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{t("runHistory.title", { locale })}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("runHistory.descriptionChecklist", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/checklists/${cl.id}`}
          >
            {t("common.back", { locale })}
          </Link>
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/checklists/${cl.id}/run`}
          >
            {t("common.startRun", { locale })}
          </Link>
        </div>
      </div>

      <RunHistoryTable
        locale={locale}
        emptyLabel={t("runHistory.empty", { locale })}
        runs={cl.runs.map((run) => {
          let detail = "";
          try {
            const itemResults = run.itemResults as unknown;
            if (Array.isArray(itemResults)) {
              detail = `${itemResults.length} ${t("runHistory.checklistItems", { locale })}`;
            } else {
              detail = JSON.stringify(itemResults);
            }
          } catch {
            detail = "";
          }

          return {
            id: run.id,
            status: run.status,
            detail: detail || t("checklists.emptyText", { locale }),
            notes: run.notes || "",
            attachments: (run.attachmentsJson as any) ?? [],
            detailUrl: `/checklists/${cl.id}/runs/${run.id}`,
            createdAt: run.createdAt
          };
        })}
      />
    </div>
  );
}
