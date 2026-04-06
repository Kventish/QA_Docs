/** Пытается вытащить текст ошибки из JSON-ответа Jira. */
export function parseJiraErrorBody(text: string): string {
  const t = text.trim();
  try {
    const j = JSON.parse(t) as {
      message?: string;
      errorMessages?: string[];
    };
    if (Array.isArray(j.errorMessages) && j.errorMessages.length) {
      return j.errorMessages.join("; ");
    }
    if (typeof j.message === "string" && j.message) {
      return j.message;
    }
  } catch {
    /* ignore */
  }
  return t.slice(0, 600);
}
