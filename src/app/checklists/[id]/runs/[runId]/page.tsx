import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import AttachmentViewer from "@/components/AttachmentViewer";

export const dynamic = "force-dynamic";

type ChecklistRunDetail = {
  id: string;
  status: string;
  itemResults?: Array<{ index: number; done: boolean; note?: string }>;
  notes: string;
  attachmentsJson?: Array<{ name: string; url: string }>;
  createdAt: Date;
  checklist: {
    id: string;
    title: string;
    projectId: string;
    itemsJson?: Array<{ text: string; expectedResult?: string }>;
  };
};

export default async function ChecklistRunDetailPage({ params }: { params: { id: string; runId: string } }) {
  const session = requireRoleOrRedirect("viewer", `/checklists/${params.id}/runs/${params.runId}`);
  const locale = getServerLocale();
  const run = await (prisma as any).checklistRun.findUnique({
    where: { id: params.runId },
    include: { checklist: true }
  }) as ChecklistRunDetail | null;

  if (!run || run.checklist.id !== params.id) return notFound();
  if (!(await canAccessProject(session, run.checklist.projectId))) return notFound();

  const attachments = (run.attachmentsJson as any) ?? [];
  const itemResults = Array.isArray(run.itemResults) ? run.itemResults : [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("runHistory.detailTitle", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{run.checklist.title}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("runHistory.descriptionChecklist", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/checklists/${run.checklist.id}/runs`}
          >
            {t("common.viewRuns", { locale })}
          </Link>
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/checklists/${run.checklist.id}`}
          >
            {t("common.back", { locale })}
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-surface-1 p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-sm text-text-muted">{t("common.columns.status", { locale })}</div>
              <div className="mt-2 text-base font-semibold">{t(`runHistory.status.${run.status}` as any, { locale: locale as any })}</div>
            </div>
            <div>
              <div className="text-sm text-text-muted">{t("runHistory.createdAt", { locale })}</div>
              <div className="mt-2 text-base">{new Date(run.createdAt).toLocaleString(locale)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-surface-1 p-6">
            <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t("runHistory.details", { locale })}
            </h2>
            <div className="mt-3 text-sm text-text-muted">
              {itemResults.length > 0
                ? `${itemResults.filter((item) => item.done).length} / ${itemResults.length} ${t("runHistory.checklistItems", { locale })}`
                : t("checklists.run.noItems", { locale })}
            </div>
          </div>

          {Array.isArray(run.checklist.itemsJson) && run.checklist.itemsJson.length > 0 ? (
            <section className="rounded-xl border border-brand-500/25 bg-surface-1 p-6">
              <h2 className="border-b border-brand-500/20 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">
                {t("runHistory.sectionChecklistItems", { locale })}
              </h2>
              <div className="mt-4 space-y-3">
                {run.checklist.itemsJson.map((item, idx) => {
                  const result = itemResults.find((entry) => entry.index === idx);
                  const failed = result ? !result.done : false;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border px-4 py-3 ${failed ? "border-red-500/50 bg-red-500/10" : "border-border bg-surface-2"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-text-muted">{t("testCases.stepLabel", { locale, vars: { n: idx + 1 } })}</div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${failed ? "bg-red-500/25 text-red-200" : "bg-emerald-500/15 text-emerald-300"}`}
                        >
                          {result?.done ? t("runHistory.stepPassed", { locale }) : t("runHistory.stepFailed", { locale })}
                        </span>
                      </div>
                      <div className="mt-2 text-text">{item.text || t("checklists.emptyText", { locale })}</div>
                      {item.expectedResult ? (
                        <div className="mt-2 text-xs text-text-muted">{t("checklists.run.expectedResult", { locale })}</div>
                      ) : null}
                      {item.expectedResult ? <div className="text-text">{item.expectedResult}</div> : null}
                      {result?.note ? (
                        <div className="mt-3 rounded-lg bg-surface-1 p-3 text-sm text-text-muted">
                          <div className="font-medium text-text">{t("runHistory.stepNote", { locale })}</div>
                          <div className="mt-1 text-text">{result.note}</div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="rounded-xl border bg-surface-1 p-6">
            <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t("runHistory.notes", { locale })}
            </h2>
            <div className="mt-3 whitespace-pre-wrap text-sm">{run.notes || "—"}</div>
          </div>

          <section className="rounded-xl border border-dashed border-border/90 bg-surface-2/35 p-6">
            <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t("runHistory.sectionAttachments", { locale })}
            </h2>
            <div className="mt-4">
              <AttachmentViewer attachments={attachments} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
