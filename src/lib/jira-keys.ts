/** Jira issue key: PROJECT-123 */
const ISSUE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

export function isValidJiraIssueKey(s: string): boolean {
  return ISSUE_KEY_RE.test(s.trim());
}

export function normalizeJiraIssueKey(s: string): string {
  return s.trim().toUpperCase();
}

/** Jira project key (short, no hyphen-number suffix) */
const PROJECT_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

export function isValidJiraProjectKey(s: string): boolean {
  const t = s.trim();
  return t.length >= 2 && t.length <= 20 && PROJECT_KEY_RE.test(t);
}
