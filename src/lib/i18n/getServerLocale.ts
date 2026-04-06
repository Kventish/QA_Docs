import { cookies } from "next/headers";
import { Locale, LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";

export function getServerLocale(): Locale {
  const v = cookies().get(LOCALE_COOKIE)?.value;
  return normalizeLocale(v);
}

