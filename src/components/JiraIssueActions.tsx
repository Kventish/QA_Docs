"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { showToast } from "@/components/toast/ToastCenter";

type Entity = "testCase" | "testPlan" | "checklist";

export default function JiraIssueActions(props: {
  entity: Entity;
  entityId: string;
  issueKey: string | null;
  browseUrl: string | null;
  canEdit: boolean;
  /** Jira env vars present on server */
  jiraConfigured: boolean;
}) {
  const { entity, entityId, issueKey, browseUrl, canEdit, jiraConfigured } = props;
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createIssue() {
    setLoading(true);
    try {
      const res = await fetch("/api/jira/issues", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, id: entityId })
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`);
        return;
      }
      if (res.status === 409) {
        showToast({ type: "error", message: json?.error ?? t("jira.alreadyLinked") });
        setLoading(false);
        router.refresh();
        return;
      }
      if (!res.ok) {
        showToast({ type: "error", message: json?.error ?? t("jira.createFailed") });
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      showToast({ type: "error", message: t("jira.createFailed") });
    } finally {
      setLoading(false);
    }
  }

  if (issueKey) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
        <div className="text-text-muted">{t("jira.linkedIssue")}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{issueKey}</span>
          {browseUrl ? (
            <a
              className="rounded border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1"
              href={browseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("jira.openInJira")}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return null;
  }

  if (!jiraConfigured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-text-muted">
        {t("jira.notConfigured")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-surface-2 bg-surface-2/30 px-3 py-2 text-sm space-y-2">
      <div className="text-text-muted">{t("jira.noIssueYet")}</div>
      <button
        type="button"
        className="rounded-lg border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
        onClick={createIssue}
        disabled={loading}
      >
        {loading ? t("common.loading") : t("jira.createInJira")}
      </button>
    </div>
  );
}
