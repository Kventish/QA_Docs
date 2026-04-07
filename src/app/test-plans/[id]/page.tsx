import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function TestPlanViewPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/test-plans/${params.id}`);
  const locale = getServerLocale();
  const plan = await prisma.testPlan.findUnique({
    where: { id: params.id },
    include: {
      cases: { include: { testCase: true }, orderBy: { order: "asc" } },
      checklists: { include: { checklist: true }, orderBy: { order: "asc" } }
    }
  });
  if (!plan) return notFound();
  if (!(await canAccessProject(session, plan.projectId))) return notFound();

  const canEdit = session.role === "editor" || session.role === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("testPlans.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{plan.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs">{t(`testPlans.status.${plan.status}` as any, { locale })}</span>
            {plan.tags.map((t) => (
              <span key={t} className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Link
              className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
              href={`/test-plans/${plan.id}/run`}
            >
              {t("common.startRun", { locale })}
            </Link>
          ) : null}
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/test-plans/${plan.id}/runs`}
          >
            {t("common.viewRuns", { locale })}
          </Link>
          {canEdit && (
            <Link
              className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
              href={`/test-plans/${plan.id}/edit`}
            >
              {t("common.edit", { locale })}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-surface-1 p-6">
          <div className="text-sm font-medium">{t("testPlans.objective", { locale })}</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{plan.objective || t("testPlans.emptyText", { locale })}</div>
        </section>
        <section className="rounded-xl border bg-surface-1 p-6">
          <div className="text-sm font-medium">{t("testPlans.scope", { locale })}</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{plan.scope || t("testPlans.emptyText", { locale })}</div>
        </section>
      </div>

      <section className="rounded-xl border bg-surface-1 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t("testPlans.includedTestCases", { locale })}</div>
          <div className="text-xs text-text-muted">{plan.cases.length}</div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border bg-surface-2">
          <table className="w-full text-sm">
            <thead className="border-b bg-surface-2 text-left text-text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t("testPlans.tableHeader.title", { locale })}</th>
                <th className="px-4 py-2 font-medium">{t("testPlans.tableHeader.status", { locale })}</th>
              </tr>
            </thead>
            <tbody>
              {plan.cases.map((c) => (
                <tr key={c.testCaseId} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    <Link className="hover:underline" href={`/test-cases/${c.testCaseId}`}>
                      {c.testCase.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-text-muted">{t(`testCases.status.${c.testCase.status}` as any, { locale })}</td>
                </tr>
              ))}
              {plan.cases.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={2}>
                    {t("testPlans.emptyText", { locale })}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-surface-1 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t("testPlans.includedChecklists", { locale })}</div>
          <div className="text-xs text-text-muted">{plan.checklists.length}</div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border bg-surface-2">
          <table className="w-full text-sm">
            <thead className="border-b bg-surface-2 text-left text-text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t("testPlans.tableHeader.title", { locale })}</th>
                <th className="px-4 py-2 font-medium">{t("testPlans.tableHeader.status", { locale })}</th>
              </tr>
            </thead>
            <tbody>
              {plan.checklists.map((c) => (
                <tr key={c.checklistId} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    <Link className="hover:underline" href={`/checklists/${c.checklistId}`}>
                      {c.checklist.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-text-muted">{t(`checklists.status.${c.checklist.status}` as any, { locale })}</td>
                </tr>
              ))}
              {plan.checklists.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={2}>
                    {t("testPlans.emptyText", { locale })}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

