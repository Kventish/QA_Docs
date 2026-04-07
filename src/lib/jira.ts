/**
 * Jira Cloud REST API (Basic auth: email + API token).
 * Server-side only.
 */

import { parseJiraErrorBody } from "./jira-parse";

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

function cleanEnvValue(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  let v = s.trim();
  v = v.replace(/^\uFEFF/, "");
  v = v.replace(/\r/g, "");
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}

export function getJiraConfig(): JiraConfig | null {
  const rawUrl = cleanEnvValue(process.env.JIRA_BASE_URL);
  const baseUrl = rawUrl?.replace(/\/$/, "");
  const emailRaw = cleanEnvValue(process.env.JIRA_EMAIL);
  const apiToken = cleanEnvValue(process.env.JIRA_API_TOKEN);
  if (!baseUrl || !emailRaw || !apiToken) return null;
  const email = emailRaw.toLowerCase();
  return { baseUrl, email, apiToken };
}

export function getEffectiveJiraProjectKey(project: { jiraProjectKey: string | null }): string | null {
  const fromDb = cleanEnvValue(project.jiraProjectKey ?? undefined);
  if (fromDb) return fromDb;
  return cleanEnvValue(process.env.JIRA_PROJECT_KEY) ?? null;
}

function basicAuthHeader(email: string, apiToken: string): string {
  const raw = Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64");
  return `Basic ${raw}`;
}

export function jiraBrowseUrl(baseUrl: string, issueKey: string): string {
  const b = baseUrl.replace(/\/$/, "");
  return `${b}/browse/${encodeURIComponent(issueKey)}`;
}

/** Минимальный Atlassian Document Format для description. */
export function buildAdfDescription(plain: string): {
  type: "doc";
  version: 1;
  content: Array<{ type: "paragraph"; content: Array<{ type: "text"; text: string }> }>;
} {
  const text = plain.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "—" }] }] };
  }
  const chunks = text.split("\n").map((line) => line.slice(0, 12000));
  return {
    type: "doc",
    version: 1,
    content: chunks.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line || " " }]
    }))
  };
}

export type JiraFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; errorText: string };

async function jiraRequest<T>(
  path: string,
  init: { method?: string; body?: string }
): Promise<JiraFetchResult<T>> {
  const cfg = getJiraConfig();
  if (!cfg) {
    return { ok: false, status: 0, errorText: "Jira is not configured" };
  }
  const url = path.startsWith("http") ? path : `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: basicAuthHeader(cfg.email, cfg.apiToken),
    "User-Agent": "qa-docs/1.0 (Jira Cloud REST)"
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: init.body,
    cache: "no-store"
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, errorText: parseJiraErrorBody(text) };
  }
  if (method === "DELETE" || res.status === 204 || !text) {
    return { ok: true, data: {} as T };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: res.status, errorText: parseJiraErrorBody(text) };
  }
}

type CreateMetaResponse = {
  projects?: Array<{
    key: string;
    issuetypes?: Array<{ id: string; name: string }>;
  }>;
};

async function resolveIssueTypeId(projectKey: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const envId = cleanEnvValue(process.env.JIRA_ISSUE_TYPE_ID);
  if (envId) return { ok: true, id: envId };

  // Default to Bug unless explicitly overridden.
  const typeName = cleanEnvValue(process.env.JIRA_ISSUE_TYPE) || "Bug";
  const q = new URLSearchParams({
    projectKeys: projectKey,
    issuetypeNames: typeName
  });
  const r = await jiraRequest<CreateMetaResponse>(`/rest/api/3/issue/createmeta?${q.toString()}`, {});
  if (!r.ok) {
    return { ok: false, error: `createmeta: HTTP ${r.status}: ${r.errorText}` };
  }
  const it = r.data.projects?.[0]?.issuetypes?.[0];
  if (!it?.id) {
    return {
      ok: false,
      error: `Не найден тип задачи «${typeName}» в проекте ${projectKey}. Задайте JIRA_ISSUE_TYPE_ID в .env.`
    };
  }
  return { ok: true, id: it.id };
}

export type JiraCreateIssueParams = {
  projectKey: string;
  summary: string;
  descriptionPlain: string;
  epicKey?: string | null;
};

export async function jiraCreateIssue(
  params: JiraCreateIssueParams
): Promise<{ ok: true; issueKey: string } | { ok: false; status: number; error: string }> {
  const cfg = getJiraConfig();
  if (!cfg) {
    return { ok: false, status: 0, error: "Jira is not configured" };
  }

  const it = await resolveIssueTypeId(params.projectKey);
  if (!it.ok) {
    return { ok: false, status: 400, error: it.error };
  }

  const baseFields: Record<string, unknown> = {
    project: { key: params.projectKey },
    summary: params.summary.slice(0, 255),
    issuetype: { id: it.id },
    description: buildAdfDescription(params.descriptionPlain)
  };

  async function createWithFields(fields: Record<string, unknown>) {
    const body = JSON.stringify({ fields });
    return jiraRequest<{ key: string; id: string }>("/rest/api/3/issue", {
      method: "POST",
      body
    });
  }

  // В разных конфигурациях Jira (иерархия/issue type) привязка к epic через `parent`
  // может быть запрещена и даёт ошибки вида `errors.parentId = ...`.
  const epicKey = params.epicKey?.trim() ? params.epicKey.trim().toUpperCase() : null;
  const firstFields = epicKey ? { ...baseFields, parent: { key: epicKey } } : baseFields;

  let r = await createWithFields(firstFields);
  if (!r.ok && epicKey) {
    const err = String(r.errorText || "");
    const looksLikeParentHierarchyError =
      err.toLowerCase().includes("parentid") ||
      err.toLowerCase().includes("parent") ||
      err.toLowerCase().includes("иерарх");

    if (looksLikeParentHierarchyError) {
      // Ретрай без parent: создаём задачу хотя бы без привязки к epic.
      r = await createWithFields(baseFields);
      if (!r.ok) {
        return {
          ok: false,
          status: r.status,
          error:
            `${err}\n\n` +
            `Дополнительно: не удалось создать задачу даже без Epic (${epicKey}). ` +
            `Проверьте, что ключ Epic относится к этому проекту и что тип задачи поддерживает такую иерархию.`
        };
      }
    }
  }

  if (!r.ok) {
    return { ok: false, status: r.status, error: r.errorText };
  }
  const key = r.data.key;
  if (!key) {
    return { ok: false, status: 500, error: "Jira did not return issue key" };
  }
  return { ok: true, issueKey: key };
}

export type JiraAttachment = {
  fileName: string;
  content: Uint8Array;
  mimeType?: string;
};

export async function jiraAddAttachments(
  issueKey: string,
  attachments: JiraAttachment[]
): Promise<{ ok: true; count: number } | { ok: false; status: number; error: string }> {
  const cfg = getJiraConfig();
  if (!cfg) return { ok: false, status: 0, error: "Jira is not configured" };
  if (!attachments.length) return { ok: true, count: 0 };

  const url = `${cfg.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`;
  const form = new FormData();
  for (const a of attachments) {
    const blob = new Blob([a.content], { type: a.mimeType || "application/octet-stream" });
    form.append("file", blob, a.fileName);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: basicAuthHeader(cfg.email, cfg.apiToken),
      "X-Atlassian-Token": "no-check"
      // NOTE: do not set Content-Type for multipart; fetch will set boundary.
    } as any,
    body: form as any,
    cache: "no-store"
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, error: parseJiraErrorBody(text) };
  }
  return { ok: true, count: attachments.length };
}
