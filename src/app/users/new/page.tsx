"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/useT";

type Project = { id: string; name: string; slug: string };

export default function NewUserPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setProjects((j?.projects ?? []) as Project[]))
      .catch(() => setProjects([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: { email: string; password: string; role: string; projectIds?: string[] } = {
      email,
      password,
      role
    };
    if (role === "viewer") payload.projectIds = projectIds;
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);

    if (!res || !res.ok) {
      setSaving(false);
      setError(t("users.createFailed"));
      return;
    }

    window.location.assign("/users");
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <div className="text-sm text-text-muted">{t("users.admin")}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("users.createUser")}</h1>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("users.email")}</label>
            <input
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("users.password")}</label>
            <input
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("users.role")}</label>
            <select
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}
            >
              <option value="viewer">{t("users.viewer")}</option>
              <option value="editor">{t("users.editor")}</option>
              <option value="admin">{t("users.admin")}</option>
            </select>
          </div>

          {role === "viewer" && (
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("users.projectAccesses")}</label>
              <div className="max-h-48 overflow-y-auto rounded-lg border bg-surface-2 p-2">
                {projects.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) setProjectIds((prev) => [...prev, p.id]);
                        else setProjectIds((prev) => prev.filter((id) => id !== p.id));
                      }}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <button
            className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? t("common.loading") : t("common.create")}
          </button>
        </form>
      </div>
    </div>
  );
}

