/**
 * Public site URL for absolute links (e.g. paste into JIRA).
 * Set NEXT_PUBLIC_APP_URL in production (e.g. https://qa-docs.example.com) — no trailing slash.
 * If unset, client code falls back to window.location.origin.
 */
export function normalizePublicBaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  return raw.replace(/\/+$/, "");
}

export function getPublicBaseUrlFromEnv(): string {
  return normalizePublicBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
}
