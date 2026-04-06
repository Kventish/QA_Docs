export type Locale = "en" | "ru";

export const LOCALE_COOKIE = "qadocs_locale";

export function normalizeLocale(input: unknown): Locale {
  const v = String(input ?? "").toLowerCase();
  if (v === "ru") return "ru";
  return "en";
}

