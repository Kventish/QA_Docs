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

  const typeName = cleanEnvValue(process.env.JIRA_ISSUE_TYPE) || "Task";
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

  const fields: Record<string, unknown> = {
    project: { key: params.projectKey },
    summary: params.summary.slice(0, 255),
    issuetype: { id: it.id },
    description: buildAdfDescription(params.descriptionPlain)
  };

  if (params.epicKey?.trim()) {
    fields.parent = { key: params.epicKey.trim().toUpperCase() };
  }

  const body = JSON.stringify({ fields });
  const r = await jiraRequest<{ key: string; id: string }>("/rest/api/3/issue", {
    method: "POST",
    body
  });

  if (!r.ok) {
    return { ok: false, status: r.status, error: r.errorText };
  }
  const key = r.data.key;
  if (!key) {
    return { ok: false, status: 500, error: "Jira did not return issue key" };
  }
  return { ok: true, issueKey: key };
}
