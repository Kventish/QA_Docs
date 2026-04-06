"use client";

import { useCallback, useEffect, useState } from "react";
import { Locale } from "@/lib/i18n/locale";
import { getClientLocale } from "@/lib/i18n/getClientLocale";
import { t as tBase } from "@/lib/i18n/t";

const LOCALE_EVENT = "qadocs-locale-changed";

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(() => getClientLocale());

  useEffect(() => {
    const handler = () => setLocale(getClientLocale());
    window.addEventListener(LOCALE_EVENT, handler as any);
    return () => window.removeEventListener(LOCALE_EVENT, handler as any);
  }, []);

  return locale;
}

export function useT() {
  const locale = useLocale();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => tBase(key, { locale, vars }),
    [locale]
  );
}

export function notifyLocaleChanged() {
  window.dispatchEvent(new Event(LOCALE_EVENT));
}

