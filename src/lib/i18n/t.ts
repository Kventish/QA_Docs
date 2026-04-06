import { Locale } from "@/lib/i18n/locale";
import { en } from "@/lib/i18n/dictionaries/en";
import { ru } from "@/lib/i18n/dictionaries/ru";
import { getClientLocale } from "@/lib/i18n/getClientLocale";

type Dict = typeof en;
const dictByLocale: Record<Locale, Dict> = {
  en,
  ru: ru as unknown as Dict
};

function getByPath(obj: any, path: string) {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function interpolate(input: string, vars?: Record<string, string | number>) {
  if (!vars) return input;
  return input.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? "" : String(v);
  });
}

export function t(key: string, opts?: { locale?: Locale; vars?: Record<string, string | number> }) {
  const locale = opts?.locale ?? getClientLocale();
  const dict = dictByLocale[locale] as any;
  const value = getByPath(dict, key);
  if (typeof value !== "string") return key;
  return interpolate(value, opts?.vars);
}

