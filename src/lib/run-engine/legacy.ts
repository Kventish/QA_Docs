export type LegacyAttachment = { name: string; url: string; pathname: string };
export function legacyAttachments(raw: unknown, runId: string): LegacyAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const { name, url } = entry as Record<string, unknown>;
    if (typeof name !== "string" || typeof url !== "string" || !url.startsWith("/api/uploads/")) return [];
    try {
      const pathname = url.slice("/api/uploads/".length).split("/").map(decodeURIComponent).join("/");
      if (!pathname.startsWith(`runs/${runId}/`) || pathname.includes("..") || pathname.includes("\\") || pathname.includes("\0")) return [];
      return [{ name, url, pathname }];
    } catch { return []; }
  });
}
