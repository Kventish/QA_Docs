import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import AttachmentViewer from "@/components/AttachmentViewer";
import CopyPageLinkButton from "@/components/CopyPageLinkButton";
import { flattenTestCaseSteps } from "@/lib/test-case-includes";

export const dynamic = "force-dynamic";

type TestCaseRunDetail = {
  id: string;
  status: string;
  actualResult: string;
  notes: string;
  stepsJson?: Array<{ index: number; done: boolean; note?: string }>;
  attachmentsJson?: Array<{ name: string; url: string }>;
  createdAt: Date;
  testCase: {
    id: string;
    title: string;
    projectId: string;
    stepsJson?: Array<{ step?: string; expectedResult?: string }>;
  };
};

export default async function TestCaseRunDetailPage({ params }: { params: { id: string; runId: string } }) {
  const session = requireRoleOrRedirect("viewer", `/test-cases/${params.id}/runs/${params.runId}`);
  const locale = getServerLocale();
  const run = await (prisma as any).testCaseRun.findUnique({
    where: { id: params.runId },
    include: { testCase: true }
  }) as TestCaseRunDetail | null;

  if (!run || run.testCase.id !== params.id) return notFound();
  if (!(await canAccessProject(session, run.testCase.projectId))) return notFound();

  const attachments = (run.attachmentsJson as any) ?? [];
  const resolvedSteps = await flattenTestCaseSteps(prisma, run.testCase.id, run.testCase.projectId);
  const flatSteps = resolvedSteps.steps;
  const failedStep = Array.isArray(run.stepsJson) ? run.stepsJson.find((step) => !step.done) : undefined;
  const failedStepLabel = failedStep?.index !== undefined ? failedStep.index + 1 : "?";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("runHistory.detailTitle", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{run.testCase.title}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("runHistory.descriptionTestCase", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyPageLinkButton path={`/test-cases/${params.id}/runs/${params.runId}`} />
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-cases/${run.testCase.id}/runs`}
          >
            {t("common.viewRuns", { locale })}
          </Link>
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-cases/${run.testCase.id}`}
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
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm text-text-muted">
              <span className="font-medium">{t("runHistory.details", { locale })}</span>
              {Array.isArray(run.stepsJson) && run.stepsJson.length > 0 ? (
                <span className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  {run.status === "failed"
                    ? `${t("runHistory.failedStep", { locale })}: ${failedStepLabel}`
                    : t("runHistory.allStepsPassed", { locale })}
                </span>
              ) : null}
            </div>
            <div className="mt-3 whitespace-pre-wrap text-sm">{run.actualResult || t("testCases.emptyText", { locale })}</div>
          </div>

          {resolvedSteps.error ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {t(`testCases.form.includeErrors.${resolvedSteps.error}` as any, { locale }) || resolvedSteps.error}
            </div>
          ) : null}
          {flatSteps.length > 0 ? (
            <section className="rounded-xl border border-brand-500/25 bg-surface-1 p-6">
              <h2 className="border-b border-brand-500/20 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">
                {t("runHistory.sectionSteps", { locale })}
              </h2>
              <div className="mt-4 space-y-3">
                {flatSteps.map((step, idx) => {
                  const result = Array.isArray(run.stepsJson)
                    ? run.stepsJson.find((item) => item.index === idx)
                    : undefined;
                  const failed = result ? !result.done : false;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border px-4 py-3 ${failed ? "border-red-500/50 bg-red-500/10" : "border-border bg-surface-2"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-text-muted">{t("testCases.stepLabel", { locale, vars: { n: idx + 1 } })}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {step.sourceTestCaseId !== run.testCase.id ? (
                            <span className="text-[11px] text-text-muted">
                              <Link href={`/test-cases/${step.sourceTestCaseId}`} className="text-brand-600 hover:underline">
                                {step.sourceTestCaseTitle}
                              </Link>
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${failed ? "bg-red-500/25 text-red-200" : "bg-emerald-500/15 text-emerald-300"}`}
                          >
                            {failed ? t("runHistory.stepFailed", { locale }) : t("runHistory.stepPassed", { locale })}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-text">{step.step || t("testCases.emptyText", { locale })}</div>
                      {step.expectedResult ? (
                        <div className="mt-2 text-xs text-text-muted">{t("testCases.expectedResult", { locale })}</div>
                      ) : null}
                      {step.expectedResult ? <div className="text-text">{step.expectedResult}</div> : null}
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
