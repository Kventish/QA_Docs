"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { showToast } from "@/components/toast/ToastCenter";

type Entity = "testCaseRun" | "checklistRun" | "testPlanRun";

export default function JiraRunIssueActions(props: {
  entity: Entity;
  runId: string;
  issueKey: string | null;
  browseUrl: string | null;
  canEdit: boolean;
  jiraConfigured: boolean;
  size?: "sm" | "md";
}) {
  const { entity, runId, issueKey, browseUrl, canEdit, jiraConfigured, size = "sm" } = props;
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Ошибки показываем глобальным toast (сверху по центру).
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const effectiveKey = issueKey ?? createdKey;
  const effectiveUrl = browseUrl ?? createdUrl;
  const isMd = size === "md";
  const buttonClass = isMd
    ? "rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1 disabled:opacity-60"
    : "rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1 disabled:opacity-60";

  async function createIssue() {
    // clear previous toast by replacing next toast only
    setLoading(true);
    try {
      const res = await fetch("/api/jira/run-issues", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, runId })
      });
      const json = (await res.json().catch(() => null)) as { error?: string; issueKey?: string } | null;
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
      const key = json?.issueKey ?? null;
      if (key) {
        setCreatedKey(key);
        // browseUrl is computed server-side; if absent, just show key
      }
      router.refresh();
    } catch {
      showToast({ type: "error", message: t("jira.createFailed") });
    } finally {
      setLoading(false);
    }
  }

  if (effectiveKey) {
    return (
      <div className={isMd ? "flex flex-wrap items-center gap-2" : "space-y-1"}>
        {effectiveUrl ? (
          <a
            className={buttonClass}
            href={effectiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={t("jira.openInJira")}
          >
            {effectiveKey}
          </a>
        ) : (
          <span className={isMd ? buttonClass : "font-mono text-xs text-text-muted"}>{effectiveKey}</span>
        )}
      </div>
    );
  }

  if (!canEdit) return null;
  if (!jiraConfigured) return isMd ? <span className="text-sm text-text-muted">—</span> : <span className="text-xs text-text-muted">—</span>;

  return (
    <div className={isMd ? "space-y-2" : "space-y-1"}>
      <button
        type="button"
        className={buttonClass}
        onClick={createIssue}
        disabled={loading}
      >
        {loading ? t("common.loading") : t("jira.createInJira")}
      </button>
      {/* Ошибку показываем глобальным toast, чтобы её точно увидели */}
    </div>
  );
}

