"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { flushSync } from "react-dom";
import NavigationProgress, {
  NAVIGATION_START_EVENT
} from "@/components/navigation/NavigationProgress";
import { useT } from "@/lib/i18n/useT";

export type LoadingToken = symbol;

type LoadingContextValue = {
  startLoading: (message?: string) => LoadingToken;
  stopLoading: (token: LoadingToken) => void;
  runWithLoading: <T>(operation: () => Promise<T>, message?: string) => Promise<T>;
};

type LoadingOperation = {
  token: LoadingToken;
  message: string;
  startedAt: number;
  stopTimer?: ReturnType<typeof setTimeout>;
};

const GlobalLoadingContext = createContext<LoadingContextValue | null>(null);
const NAVIGATION_FAIL_SAFE_MS = 15_000;
const MINIMUM_VISIBLE_MS = 200;

export function useGlobalLoading() {
  const value = useContext(GlobalLoadingContext);
  if (!value) throw new Error("useGlobalLoading must be used inside GlobalLoadingProvider");
  return value;
}

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT();
  const operationsRef = useRef(new Map<LoadingToken, LoadingOperation>());
  const navigationTokenRef = useRef<LoadingToken | null>(null);
  const failSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUrl = `${pathname ?? ""}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const currentUrlRef = useRef(currentUrl);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const [visibleOperation, setVisibleOperation] = useState<LoadingOperation | null>(null);

  const publishOperations = useCallback(() => {
    if (!mountedRef.current) return;
    const operations = [...operationsRef.current.values()];
    setVisibleOperation(operations.at(-1) ?? null);
  }, []);

  const startLoading = useCallback((message?: string) => {
    const token = Symbol("global-loading");
    operationsRef.current.set(token, {
      token,
      message: message || t("common.loading"),
      startedAt: performance.now()
    });
    // Commit feedback before a handler can start a fast request or navigation.
    flushSync(publishOperations);
    return token;
  }, [publishOperations, t]);

  const stopLoading = useCallback((token: LoadingToken) => {
    const operation = operationsRef.current.get(token);
    if (!operation || operation.stopTimer) return;
    const remaining = MINIMUM_VISIBLE_MS - (performance.now() - operation.startedAt);
    if (remaining > 0) {
      operation.stopTimer = setTimeout(() => {
        operationsRef.current.delete(token);
        publishOperations();
      }, remaining);
      return;
    }
    operationsRef.current.delete(token);
    publishOperations();
  }, [publishOperations]);

  const runWithLoading = useCallback(async <T,>(operation: () => Promise<T>, message?: string) => {
    const token = startLoading(message);
    try {
      return await operation();
    } finally {
      stopLoading(token);
    }
  }, [startLoading, stopLoading]);

  const stopNavigation = useCallback(() => {
    if (failSafeRef.current) clearTimeout(failSafeRef.current);
    failSafeRef.current = null;
    if (navigationTokenRef.current) stopLoading(navigationTokenRef.current);
    navigationTokenRef.current = null;
  }, [stopLoading]);

  const beginNavigation = useCallback((message?: string) => {
    stopNavigation();
    navigationTokenRef.current = startLoading(message || t("common.loading"));
    failSafeRef.current = setTimeout(stopNavigation, NAVIGATION_FAIL_SAFE_MS);
  }, [startLoading, stopNavigation, t]);

  useEffect(() => {
    if (currentUrlRef.current === currentUrl) return;
    currentUrlRef.current = currentUrl;
    stopNavigation();
  }, [currentUrl, stopNavigation]);

  useEffect(() => {
    const onStart = (event: Event) => {
      const message = event instanceof CustomEvent && typeof event.detail?.message === "string"
        ? event.detail.message
        : undefined;
      beginNavigation(message);
    };
    const onPopState = () => {
      const next = `${window.location.pathname}${window.location.search}`;
      if (next !== currentUrlRef.current) beginNavigation();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target.toLowerCase() !== "_self") return;

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || next.pathname.startsWith("/api/")) return;
      const current = new URL(window.location.href);
      if (next.pathname === current.pathname && next.search === current.search) return;

      beginNavigation();
    };

    window.addEventListener(NAVIGATION_START_EVENT, onStart);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", stopNavigation);
    // Next Link prevents the native click during React's bubble phase.
    // Capture first so every eligible internal link uses the shared loader.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, onStart);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", stopNavigation);
      document.removeEventListener("click", onClick, true);
    };
  }, [beginNavigation, stopNavigation]);

  useEffect(() => {
    mountedRef.current = true;
    const operations = operationsRef.current;
    return () => {
      mountedRef.current = false;
      if (failSafeRef.current) clearTimeout(failSafeRef.current);
      operations.forEach(operation => {
        if (operation.stopTimer) clearTimeout(operation.stopTimer);
      });
      operations.clear();
    };
  }, []);

  const active = visibleOperation !== null;
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.inert = active;
    if (active) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      document.body.setAttribute("aria-busy", "true");
      requestAnimationFrame(() => overlayRef.current?.focus());
    } else {
      document.body.removeAttribute("aria-busy");
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
    return () => {
      content.inert = false;
      document.body.removeAttribute("aria-busy");
    };
  }, [active]);

  const value = useMemo<LoadingContextValue>(() => ({
    startLoading,
    stopLoading,
    runWithLoading
  }), [runWithLoading, startLoading, stopLoading]);

  return (
    <GlobalLoadingContext.Provider value={value}>
      <NavigationProgress active={active} />
      <div ref={contentRef} aria-busy={active}>{children}</div>
      {visibleOperation && (
        <div
          ref={overlayRef}
          role="status"
          aria-live="polite"
          aria-busy="true"
          tabIndex={-1}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-[3px] focus:outline-none"
        >
          <div className="flex min-w-[220px] flex-col items-center gap-4 rounded-xl border border-border bg-surface-1 px-7 py-6 shadow-2xl">
            <span
              aria-hidden="true"
              className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500/25 border-t-brand-500 motion-reduce:animate-none"
            />
            <span className="text-sm font-medium text-text-primary">{visibleOperation.message}</span>
          </div>
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
}
