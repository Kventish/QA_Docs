import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import ChecklistItems from "./checklist-items";

export const dynamic = "force-dynamic";

type Item = { text: string; checked: boolean; expectedResult?: string };

export default async function ChecklistViewPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/checklists/${params.id}`);
  const locale = getServerLocale();
  const cl = await prisma.checklist.findUnique({ where: { id: params.id } });
  if (!cl) return notFound();
  if (!(await canAccessProject(session, cl.projectId))) return notFound();

  const items = (cl.itemsJson as unknown as Item[]) ?? [];
  const canEdit = session.role === "editor" || session.role === "admin";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("checklists.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{cl.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs">{t(`checklists.status.${cl.status}` as any, { locale })}</span>
            {cl.tags.map((t) => (
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
              href={`/checklists/${cl.id}/run`}
            >
              {t("common.startRun", { locale })}
            </Link>
          ) : null}
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/checklists/${cl.id}/runs`}
          >
            {t("common.viewRuns", { locale })}
          </Link>
          {canEdit && (
            <Link
              className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
              href={`/checklists/${cl.id}/edit`}
            >
              {t("common.edit", { locale })}
            </Link>
          )}
        </div>
      </div>

      <section className="rounded-xl border bg-surface-1 p-6">
        <div className="text-sm font-medium">{t("checklists.itemsLabel", { locale })}</div>
        <ChecklistItems checklistId={cl.id} initialItems={items} canEdit={canEdit} />
      </section>
    </div>
  );
}

