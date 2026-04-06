import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import RunChecklistForm from "./RunChecklistForm";
import CopyPageLinkButton from "@/components/CopyPageLinkButton";

export const dynamic = "force-dynamic";

export default async function RunChecklistPage({ params }: { params: { id: string } }) {
  const session = requireRoleOrRedirect("viewer", `/checklists/${params.id}/run`);
  const locale = getServerLocale();
  const checklist = await prisma.checklist.findUnique({ where: { id: params.id } });
  if (!checklist) return notFound();
  if (!(await canAccessProject(session, checklist.projectId))) return notFound();
  const items = (checklist.itemsJson as unknown as Array<{ text: string; expectedResult?: string }>) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text-muted">{t("checklists.run.viewLabel", { locale })}</div>
          <h1 className="mt-1 text-xl font-semibold">{t("checklists.run.title", { locale })}</h1>
          <div className="mt-2 text-sm text-text-muted">{t("checklists.run.description", { locale })}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyPageLinkButton path={`/checklists/${params.id}/run`} />
          <Link
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
            href={`/checklists/${params.id}`}
          >
            {t("common.back", { locale })}
          </Link>
        </div>
      </div>

      <RunChecklistForm id={params.id} title={checklist.title} items={items} />
    </div>
  );
}
