"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";

type Project = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  testCaseCount: number;
  checklistCount: number;
  testPlanCount: number;
  coverage: number;
  totalTestCases: number;
  coveredTestCases: number;
};

export default function ProjectsPage() {
  const locale = useLocale();
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "editor" | "viewer" | null>(null);

  const canEdit = role === "editor" || role === "admin";
  const isAdmin = role === "admin";

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRole((j?.session?.role as "admin" | "editor" | "viewer") ?? null))
      .catch(() => setRole(null));
  }, []);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/projects", {
      cache: "no-store",
      credentials: "include"
    }).catch(() => null);
    if (!res) {
      setProjects([]);
      setLoading(false);
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/projects")}`);
      return;
    }
    const json = await res.json().catch(() => null);
    setProjects(json?.projects ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError(t("projects.nameTooShort"));
      return;
    }
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    }).catch(() => null);

    if (!res) {
      setCreating(false);
      setError(t("projects.createFailed"));
      return;
    }

    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/projects")}`);
      return;
    }
    if (res.status === 403) {
      setCreating(false);
      setError(t("validation.forbidden"));
      return;
    }
    if (!res.ok) {
      setCreating(false);
      setError(t("projects.createFailed"));
      return;
    }

    setName("");
    setCreating(false);
    await refresh();
  }

  async function deleteProject(id: string) {
    if (!confirm(t("projects.deleteConfirm"))) return;
    setError(null);
    setDeletingId(id);
    const res = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      credentials: "include"
    }).catch(() => null);

    if (!res) {
      setDeletingId(null);
      setError(t("projects.deleteFailed"));
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/projects")}`);
      return;
    }
    if (res.status === 403) {
      setDeletingId(null);
      setError(t("validation.forbidden"));
      return;
    }
    if (!res.ok) {
      setDeletingId(null);
      setError(t("projects.deleteFailed"));
      return;
    }

    setDeletingId(null);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("projects.title")}</h1>
        {canEdit && (
          <form className="flex flex-wrap items-center gap-2" onSubmit={createProject}>
            <input
              className="w-64 rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projects.namePlaceholder")}
            />
            <button
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
              disabled={creating}
            >
              {creating ? t("common.loading") : t("projects.newProject")}
            </button>
          </form>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl border bg-surface-1 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
              </div>
              {isAdmin && (
                <button
                  className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
                  disabled={deletingId === p.id}
                  onClick={() => deleteProject(p.id)}
                  title={t("projects.deleteProject")}
                >
                  {deletingId === p.id ? "…" : t("projects.delete")}
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2 text-xs text-text-muted">
              <div className="flex items-center justify-between gap-2">
                <span>{t("projects.coverage")}</span>
                <span className="font-medium">{p.coverage}%</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
                <span>{p.testCaseCount} {t("testCases.title")}</span>
                <span>•</span>
                <span>{p.checklistCount} {t("checklists.title")}</span>
                <span>•</span>
                <span>{p.testPlanCount} {t("testPlans.title")}</span>
              </div>
              <div>
                {t("common.columns.updated")}:{" "}
                {new Date(p.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
              </div>
            </div>
          </div>
        ))}
        {!loading && projects.length === 0 ? (
          <div className="rounded-xl border bg-surface-1 p-4 text-sm text-text-muted">
            {t("projects.empty")}
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-xl border bg-surface-1 p-4 text-sm text-text-muted">
            {t("common.loading")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

