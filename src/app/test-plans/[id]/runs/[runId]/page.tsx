import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import AttachmentViewer from "@/components/AttachmentViewer";
import { flattenTestCaseSteps } from "@/lib/test-case-includes";
import JiraRunIssueActions from "@/components/JiraRunIssueActions";
import { getJiraConfig, jiraBrowseUrl } from "@/lib/jira";

export const dynamic = "force-dynamic";

type TestPlanRunDetail = {
  id: string;
  status: string;
  summary: string;
  detailsJson?: {
    cases?: Array<{ id: string; title: string; stepDone?: boolean[] }>;
    checklists?: Array<{ id: string; title: string; itemDone?: boolean[] }>;
  };
  attachmentsJson?: Array<{ name: string; url: string }>;
  createdAt: Date;
  testPlan: {
    id: string;
    title: string;
    projectId: string;
  };
};

export default async function TestPlanRunDetailPage({ params }: { params: { id: string; runId: string } }) {
  const session = requireRoleOrRedirect("viewer", `/test-plans/${params.id}/runs/${params.runId}`);
  const locale = getServerLocale();
  const jiraCfg = getJiraConfig();
  const canEdit = (session as any)?.role === "editor" || (session as any)?.role === "admin";
  const run = await (prisma as any).testPlanRun.findUnique({
    where: { id: params.runId },
    include: { testPlan: true }
  }) as TestPlanRunDetail | null;

  if (!run || run.testPlan.id !== params.id) return notFound();
  if (!(await canAccessProject(session, run.testPlan.projectId))) return notFound();

  const attachments = (run.attachmentsJson as any) ?? [];
  const details = run.detailsJson as TestPlanRunDetail["detailsJson"] | null;
  const caseIds = Array.isArray(details?.cases) ? details.cases.map((item) => item.id) : [];
  const checklistIds = Array.isArray(details?.checklists) ? details.checklists.map((item) => item.id) : [];

  const testCases = caseIds.length
    ? await prisma.testCase.findMany({ where: { id: { in: caseIds } } })
    : [];
  const checklists = checklistIds.length
    ? await prisma.checklist.findMany({ where: { id: { in: checklistIds } } })
    : [];

  const testCaseMap = new Map(testCases.map((item) => [item.id, item]));
  const checklistMap = new Map(checklists.map((item) => [item.id, item]));
  const includedCases = caseIds
    .map((id) => testCaseMap.get(id))
    .filter((item): item is (typeof testCases)[number] => Boolean(item));
  const includedChecklists = checklistIds
    .map((id) => checklistMap.get(id))
    .filter((item): item is (typeof checklists)[number] => Boolean(item));

  const caseDoneMap = new Map(
    (Array.isArray(details?.cases) ? details!.cases! : []).map((c) => [c.id, Array.isArray(c.stepDone) ? c.stepDone : []])
  );
  const checklistDoneMap = new Map(
    (Array.isArray(details?.checklists) ? details!.checklists! : []).map((c) => [c.id, Array.isArray(c.itemDone) ? c.itemDone : []])
  );

  const caseStepResolutions = await Promise.all(
    includedCases.map(async (item) => ({
      item,
      resolved: await flattenTestCaseSteps(prisma, item.id, item.projectId)
    }))
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("runHistory.detailTitle", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{run.testPlan.title}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("runHistory.descriptionTestPlan", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <JiraRunIssueActions
            entity="testPlanRun"
            runId={run.id}
            issueKey={(run as any).jiraIssueKey ?? null}
            browseUrl={(run as any).jiraIssueKey && jiraCfg ? jiraBrowseUrl(jiraCfg.baseUrl, (run as any).jiraIssueKey) : null}
            canEdit={canEdit}
            jiraConfigured={!!jiraCfg}
            size="md"
          />
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-plans/${run.testPlan.id}/runs`}
          >
            {t("common.viewRuns", { locale })}
          </Link>
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-plans/${run.testPlan.id}`}
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

        <div className="rounded-xl border bg-surface-1 p-6 space-y-4">
          <div>
            <div className="text-sm text-text-muted">{t("runHistory.details", { locale })}</div>
            <div className="mt-2 whitespace-pre-wrap">{run.summary || t("testPlans.emptyText", { locale })}</div>
          </div>
          <div>
            <div className="text-sm text-text-muted">{t("runHistory.includedItems", { locale })}</div>
            <div className="mt-4 space-y-6">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-text-muted">{t("runHistory.includedTestCases", { locale })}</div>
                {includedCases.length > 0 ? (
                  <div className="mt-3 space-y-4">
                    {caseStepResolutions.map(({ item, resolved }) => {
                      const done = caseDoneMap.get(item.id) ?? [];
                      const doneCount = done.filter(Boolean).length;
                      const totalCount = resolved.steps.length;
                      return (
                      <section key={item.id} className="rounded-xl border bg-surface-2 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <Link href={`/test-cases/${item.id}`} className="text-lg font-semibold text-brand-600 hover:underline">
                            {item.title}
                          </Link>
                          <span className="rounded-md bg-surface-1 px-2 py-1 text-xs text-text-muted">
                            {t(`testCases.status.${item.status}` as any, { locale })}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-text-muted">
                          {doneCount} / {totalCount || done.length} {t("testCases.run.stepsLabel", { locale })}
                        </div>
                        {item.description ? (
                          <div className="mt-3 text-sm text-text-muted">
                            <div className="font-medium text-text">{t("testCases.description", { locale })}</div>
                            <div className="mt-1 text-text">{item.description}</div>
                          </div>
                        ) : null}
                        {item.preconditions ? (
                          <div className="mt-3 text-sm text-text-muted">
                            <div className="font-medium text-text">{t("testCases.preconditions", { locale })}</div>
                            <div className="mt-1 text-text">{item.preconditions}</div>
                          </div>
                        ) : null}
                        {item.postconditions ? (
                          <div className="mt-3 text-sm text-text-muted">
                            <div className="font-medium text-text">{t("testCases.postconditions", { locale })}</div>
                            <div className="mt-1 text-text">{item.postconditions}</div>
                          </div>
                        ) : null}
                        {item.expected ? (
                          <div className="mt-3 text-sm text-text-muted">
                            <div className="font-medium text-text">{t("testCases.expectedResult", { locale })}</div>
                            <div className="mt-1 text-text">{item.expected}</div>
                          </div>
                        ) : null}
                        {resolved.error ? (
                          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                            {t(`testCases.form.includeErrors.${resolved.error}` as any, { locale }) || resolved.error}
                          </div>
                        ) : null}
                        {resolved.steps.length > 0 ? (
                          <div className="mt-3 text-sm text-text-muted">
                            <div className="font-medium text-text">{t("testCases.run.stepsLabel", { locale })}</div>
                            <ul className="mt-2 space-y-2">
                              {resolved.steps.map((step, idx) => (
                                <li key={idx} className="rounded-lg border bg-surface-1 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                                    <span>{t("testCases.stepLabel", { locale, vars: { n: (idx + 1).toString() } })}</span>
                                    {step.sourceTestCaseId !== item.id ? (
                                      <Link href={`/test-cases/${step.sourceTestCaseId}`} className="text-brand-600 hover:underline">
                                        {step.sourceTestCaseTitle}
                                      </Link>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        done[idx] ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/20 text-red-200"
                                      }`}
                                    >
                                      {done[idx] ? t("runHistory.stepPassed", { locale }) : t("runHistory.stepFailed", { locale })}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-text">{step.step || t("testCases.emptyText", { locale })}</div>
                                  {step.expectedResult ? (
                                    <div className="mt-2 text-xs text-text-muted">{t("testCases.expectedResult", { locale })}</div>
                                  ) : null}
                                  {step.expectedResult ? <div className="text-text">{step.expectedResult}</div> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-text-muted">{t("runHistory.noIncludedTestCases", { locale })}</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-text-muted">{t("runHistory.includedChecklists", { locale })}</div>
                {includedChecklists.length > 0 ? (
                  <div className="mt-3 space-y-4">
                    {includedChecklists.map((item) => {
                      const done = checklistDoneMap.get(item.id) ?? [];
                      const total = Array.isArray(item.itemsJson) ? item.itemsJson.length : done.length;
                      const doneCount = done.filter(Boolean).length;
                      return (
                      <section key={item.id} className="rounded-xl border bg-surface-2 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Link href={`/checklists/${item.id}`} className="text-lg font-semibold text-brand-600 hover:underline">
                            {item.title}
                          </Link>
                          <span className="rounded-md bg-surface-1 px-2 py-1 text-xs text-text-muted">
                            {t(`checklists.status.${item.status}` as any, { locale })}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-text-muted">
                          {doneCount} / {total} {t("runHistory.checklistItems", { locale })}
                        </div>
                        {Array.isArray(item.itemsJson) && item.itemsJson.length > 0 ? (
                          <div className="mt-3 text-sm text-text-muted">
                            <div className="font-medium text-text">{t("checklists.itemsLabel", { locale })}</div>
                            <ul className="mt-2 space-y-2">
                              {item.itemsJson.map((itemEntry: any, idx: number) => (
                                <li key={idx} className="rounded-lg border bg-surface-1 p-3">
                                  <div className="text-xs text-text-muted">{t("testCases.stepLabel", { locale, vars: { n: idx + 1 } })}</div>
                                  <div className="mt-2 flex items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        done[idx] ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/20 text-red-200"
                                      }`}
                                    >
                                      {done[idx] ? t("runHistory.stepPassed", { locale }) : t("runHistory.stepFailed", { locale })}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-text">{itemEntry.text || t("checklists.emptyText", { locale })}</div>
                                  {itemEntry.expectedResult ? (
                                    <div className="mt-2 text-xs text-text-muted">{t("checklists.run.expectedResult", { locale })}</div>
                                  ) : null}
                                  {itemEntry.expectedResult ? <div className="text-text">{itemEntry.expectedResult}</div> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-text-muted">{t("checklists.run.noItems", { locale })}</div>
                        )}
                      </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-text-muted">{t("runHistory.noIncludedChecklists", { locale })}</div>
                )}
              </div>
            </div>
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
