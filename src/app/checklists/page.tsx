"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";
import { ProjectFilterSelect } from "@/components/ProjectSelect";

type Checklist = {
  id: string;
  title: string;
  status: string;
  tags: string[];
  updatedAt: string;
};
type Project = { id: string; name: string; slug: string };

export default function ChecklistsPage() {
  const locale = useLocale();
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "editor" | "viewer" | null>(null);

  const canEdit = role === "editor" || role === "admin";

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRole((j?.session?.role as "admin" | "editor" | "viewer") ?? null))
      .catch(() => setRole(null));
  }, []);

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list = (j?.projects ?? []) as Project[];
        setProjects(list);
        if (list.length) setProjectId((current) => current || list[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  async function refresh() {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    const res = await fetch(`/api/checklists?projectId=${encodeURIComponent(projectId)}`, { credentials: "include" }).catch(() => null);
    if (!res) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/checklists")}`);
      return;
    }
    const json = await res.json().catch(() => null);
    setItems(json?.checklists ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [projectId, t]);

  async function deleteChecklist(id: string) {
    if (!confirm(t("checklists.deleteConfirm"))) return;
    setError(null);
    setDeletingId(id);

    const res = await fetch(`/api/checklists/${id}`, {
      method: "DELETE",
      credentials: "include"
    }).catch(() => null);

    if (!res) {
      setDeletingId(null);
      setError(t("checklists.deleteFailed"));
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/checklists")}`);
      return;
    }
    if (res.status === 403) {
      setDeletingId(null);
      setError(t("validation.forbidden"));
      return;
    }
    if (!res.ok) {
      setDeletingId(null);
      setError(t("checklists.deleteFailed"));
      return;
    }

    setDeletingId(null);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold">{t("checklists.title")}</h1>
        <div className="flex items-center gap-2">
          <ProjectFilterSelect
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {canEdit && (
            <Link
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500"
              href="/checklists/new"
            >
              {t("checklists.newChecklist")}
            </Link>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-surface-1">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-left text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("common.columns.title")}</th>
              <th className="px-4 py-3 font-medium">{t("common.columns.status")}</th>
              <th className="px-4 py-3 font-medium">{t("common.columns.tags")}</th>
              <th className="px-4 py-3 font-medium">{t("common.columns.updated")}</th>
              {canEdit && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link className="hover:underline" href={`/checklists/${c.id}`}>
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs">
                    {t(`checklists.status.${c.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted">{c.tags?.join(", ") ?? ""}</td>
                <td className="px-4 py-3 text-text-muted">
                  {new Date(c.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
                      disabled={deletingId === c.id}
                      onClick={() => deleteChecklist(c.id)}
                      title={t("checklists.delete")}
                    >
                      {deletingId === c.id ? "…" : t("checklists.delete")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && projects.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={canEdit ? 5 : 4}>
                  {t("common.noProjectsTableHint")}
                </td>
              </tr>
            ) : null}
            {!loading && projects.length > 0 && items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={canEdit ? 5 : 4}>
                  {t("checklists.empty")}
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={canEdit ? 5 : 4}>
                  {t("common.loading")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
