import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import CopyPageLinkButton from "@/components/CopyPageLinkButton";
import JiraIssueActions from "@/components/JiraIssueActions";
import { flattenTestCaseSteps } from "@/lib/test-case-includes";
import { getJiraConfig, jiraBrowseUrl } from "@/lib/jira";

export const dynamic = "force-dynamic";

export default async function TestCaseViewPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/test-cases/${params.id}`);
  const locale = getServerLocale();
  const tc = await prisma.testCase.findUnique({ where: { id: params.id } });
  if (!tc) return notFound();
  if (!(await canAccessProject(session, tc.projectId))) return notFound();

  const canEdit = session.role === "editor" || session.role === "admin";

  const stepsRaw = (tc.stepsJson as unknown) ?? [];
  const hasSteps = Array.isArray(stepsRaw) && stepsRaw.length > 0;
  const resolved = hasSteps
    ? await flattenTestCaseSteps(prisma, tc.id, tc.projectId)
    : { steps: [], error: null as string | null };
  const displaySteps = resolved.steps;

  const jiraCfg = getJiraConfig();
  const jiraBrowse =
    tc.jiraIssueKey && jiraCfg ? jiraBrowseUrl(jiraCfg.baseUrl, tc.jiraIssueKey) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("testCases.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{tc.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs">{t(`testCases.status.${tc.status}` as any, { locale })}</span>
            {tc.tags.map((t) => (
              <span key={t} className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyPageLinkButton path={`/test-cases/${tc.id}`} />
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-cases/${tc.id}/run`}
          >
            {t("common.startRun", { locale })}
          </Link>
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-cases/${tc.id}/runs`}
          >
            {t("common.viewRuns", { locale })}
          </Link>
          {canEdit && (
            <Link
              className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
              href={`/test-cases/${tc.id}/edit`}
            >
              {t("common.edit", { locale })}
            </Link>
          )}
        </div>
      </div>

      <section className="rounded-xl border bg-surface-1 p-4">
        <div className="text-sm font-medium">{t("jira.sectionTitle", { locale })}</div>
        <div className="mt-2">
          <JiraIssueActions
            entity="testCase"
            entityId={tc.id}
            issueKey={tc.jiraIssueKey}
            browseUrl={jiraBrowse}
            canEdit={canEdit}
            jiraConfigured={!!jiraCfg}
          />
        </div>
      </section>

      {hasSteps ? (
        <div className="space-y-4">
          {tc.preconditions ? (
            <section className="rounded-xl border bg-surface-1 p-6">
              <div className="text-sm font-medium">{t("testCases.preconditions", { locale })}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{tc.preconditions}</div>
            </section>
          ) : null}
          {resolved.error ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {t(`testCases.form.includeErrors.${resolved.error}` as any, { locale }) || resolved.error}
            </div>
          ) : null}
          {displaySteps.map((s, idx) => (
            <section key={idx} className="rounded-xl border bg-surface-1 p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-text-muted">
                <span>{t("testCases.stepLabel", { locale, vars: { n: (idx + 1).toString() } })}</span>
                {s.sourceTestCaseId !== tc.id ? (
                  <span className="text-xs font-normal text-text-muted">
                    {t("testCases.form.includedFrom", { locale })}:{" "}
                    <Link href={`/test-cases/${s.sourceTestCaseId}`} className="text-brand-600 hover:underline">
                      {s.sourceTestCaseTitle}
                    </Link>
                  </span>
                ) : null}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-text-muted">{t("testCases.step", { locale })}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{s.step || t("testCases.emptyText", { locale })}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">{t("testCases.expectedResult", { locale })}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{s.expectedResult || t("testCases.emptyText", { locale })}</div>
                </div>
                {s.actualResult !== undefined && s.actualResult !== "" ? (
                  <div>
                    <div className="text-xs text-text-muted">{t("testCases.actualResult", { locale })}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm">{s.actualResult}</div>
                  </div>
                ) : null}
              </div>
            </section>
          ))}
          {tc.postconditions ? (
            <section className="rounded-xl border bg-surface-1 p-6">
              <div className="text-sm font-medium">{t("testCases.postconditions", { locale })}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{tc.postconditions}</div>
            </section>
          ) : null}
        </div>
      ) : (
        <>
          <section className="rounded-xl border bg-surface-1 p-6">
            <div className="text-sm font-medium">{t("testCases.description", { locale })}</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{tc.description || t("testCases.emptyText", { locale })}</div>
          </section>
          <section className="rounded-xl border bg-surface-1 p-6">
            <div className="text-sm font-medium">{t("testCases.preconditions", { locale })}</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{tc.preconditions || t("testCases.emptyText", { locale })}</div>
          </section>
          <section className="rounded-xl border bg-surface-1 p-6">
            <div className="text-sm font-medium">{t("testCases.postconditions", { locale })}</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{tc.postconditions || t("testCases.emptyText", { locale })}</div>
          </section>
          <section className="rounded-xl border bg-surface-1 p-6">
            <div className="text-sm font-medium">{t("testCases.expectedResult", { locale })}</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{tc.expected || t("testCases.emptyText", { locale })}</div>
          </section>
        </>
      )}
    </div>
  );
}
