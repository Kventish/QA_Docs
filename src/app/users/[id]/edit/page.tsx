"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/useT";

type User = {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  projectIds?: string[];
};
type Project = { id: string; name: string; slug: string };

export default function EditUserPage({ params }: { params: { id: string } }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<User["role"]>("viewer");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [password, setPassword] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/users/${params.id}`, { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => {
        if (!alive) return;
        const u = j?.user as User | undefined;
        if (!u) {
          setError(t("users.userNotFound"));
          return;
        }
        setUser(u);
        setRole(u.role);
        setProjectIds(u.projectIds ?? []);
      })
      .catch(async (r) => {
        if (!alive) return;
        if (r?.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent(`/users/${params.id}/edit`)}`);
          return;
        }
        setError(t("users.loadFailed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [params.id]);

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setProjects((j?.projects ?? []) as Project[]))
      .catch(() => setProjects([]));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    const payload: any = { role };
    if (password.trim()) payload.password = password.trim();
    if (role === "viewer") payload.projectIds = projectIds;

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);

    if (!res) {
      setSaving(false);
      setError(t("users.saveFailed"));
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(`/users/${params.id}/edit`)}`);
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setSaving(false);
      setError(j?.error ?? t("users.saveFailed"));
      return;
    }

    const j = await res.json().catch(() => null);
    setUser(j?.user ?? user);
    setPassword("");
    setSaving(false);
    window.location.assign("/users");
  }

  if (loading) return <div className="text-sm text-text-muted">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <div className="text-sm text-text-muted">{t("users.admin")}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("users.editUser")}</h1>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <form className="space-y-3" onSubmit={onSave}>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("users.email")}</label>
            <input
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm opacity-80"
              value={user?.email ?? ""}
              disabled
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("users.role")}</label>
            <select
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={role}
              onChange={(e) => setRole(e.target.value as User["role"])}
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

          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("users.newPasswordOptional")}</label>
            <input
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={t("users.leaveEmptyToKeepCurrent")}
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? t("common.loading") : t("common.save")}
            </button>
            <a
              className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
              href="/users"
            >
              {t("common.cancel")}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

