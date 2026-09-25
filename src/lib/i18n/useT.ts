"use client";

import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Locale } from "@/lib/i18n/locale";
import { getClientLocale } from "@/lib/i18n/getClientLocale";
import { t as tBase } from "@/lib/i18n/t";

const LOCALE_EVENT = "qadocs-locale-changed";

const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    const handler = () => setLocale(getClientLocale());
    window.addEventListener(LOCALE_EVENT, handler);
    return () => window.removeEventListener(LOCALE_EVENT, handler);
  }, []);

  return createElement(LocaleContext.Provider, { value: locale }, children);
}

export function useLocale() {
  return useContext(LocaleContext) ?? "en";
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

