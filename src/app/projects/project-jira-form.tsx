"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";

export default function ProjectJiraForm(props: {
  projectId: string;
  initialProjectKey: string | null;
  initialEpicKey: string | null;
}) {
  const { projectId, initialProjectKey, initialEpicKey } = props;
  const t = useT();
  const [jiraProjectKey, setJiraProjectKey] = useState(initialProjectKey ?? "");
  const [jiraEpicKey, setJiraEpicKey] = useState(initialEpicKey ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jiraProjectKey: jiraProjectKey.trim() === "" ? null : jiraProjectKey.trim(),
        jiraEpicKey: jiraEpicKey.trim() === "" ? null : jiraEpicKey.trim()
      })
    }).catch(() => null);
    setSaving(false);
    if (!res) {
      setErr(t("projects.jiraSaveFailed"));
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/projects")}`);
      return;
    }
    const json = (await res.json().catch(() => null)) as { error?: string };
    if (!res.ok) {
      setErr(json?.error ?? t("projects.jiraSaveFailed"));
      return;
    }
    setMsg(t("jira.jiraSettingsSaved"));
  }

  return (
    <form className="mt-3 space-y-2 border-t border-surface-2 pt-3" onSubmit={save}>
      <div className="text-xs font-medium text-text-muted">{t("projects.jiraIntegration")}</div>
      <div className="grid gap-3 sm:grid-cols-2 items-end">
        <div className="space-y-1">
          <label className="text-[11px] text-text-muted">{t("jira.projectKeyLabel")}</label>
          <input
            className="w-full rounded-lg border bg-surface-2 px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={jiraProjectKey}
            onChange={(e) => setJiraProjectKey(e.target.value)}
            placeholder="SCRUM"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-text-muted">{t("jira.epicKeyLabel")}</label>
          <input
            className="w-full rounded-lg border bg-surface-2 px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={jiraEpicKey}
            onChange={(e) => setJiraEpicKey(e.target.value)}
            placeholder={t("jira.epicKeyPlaceholder")}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="submit"
          className="rounded-lg border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? t("common.loading") : t("jira.saveJiraSettings")}
        </button>
        <div className="min-h-[16px] text-right text-xs">
          {msg ? <span className="text-emerald-400">{msg}</span> : null}
          {err ? <span className="text-red-400">{err}</span> : null}
        </div>
      </div>
    </form>
  );
}
