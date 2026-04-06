import { Locale, LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";

export function getClientLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const parts = document.cookie.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${LOCALE_COOKIE}=`));
  if (!found) return "en";
  const value = decodeURIComponent(found.split("=").slice(1).join("="));
  return normalizeLocale(value);
}

