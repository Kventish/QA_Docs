"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startNavigation } from "@/components/navigation/NavigationProgress";
import { useT } from "@/lib/i18n/useT";

const HISTORY_KEY = "qadocs:internal-navigation-history";
const FALLBACK_PATH = "/projects";
const MAX_HISTORY_ENTRIES = 50;

export const GLOBAL_BACK_REQUEST_EVENT = "qadocs:global-back-request";

export type GlobalBackRequestDetail = {
  target: string;
  commit: () => void;
  release: () => void;
};

type BackAction = {
  target: string;
  remainingHistory: string[];
};

function normalizeInternalPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const origin = window.location.origin;
    const url = new URL(value, origin);
    const isLogin = url.pathname === "/login" || url.pathname.startsWith("/login/");
    const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
    if (url.origin !== origin || isLogin || isApi) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function readHistory(): string[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .map(normalizeInternalPath)
      .filter((entry): entry is string => entry !== null)
      .slice(-MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

function writeHistory(history: string[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY_ENTRIES)));
  } catch {
    // Navigation still works with the safe fallback if session storage is unavailable.
  }
}

function previousAction(history: string[], current: string): BackAction | null {
  const remainingHistory = [...history];
  if (remainingHistory.at(-1) !== current) remainingHistory.push(current);
  while (remainingHistory.at(-1) === current) remainingHistory.pop();

  const target = remainingHistory.at(-1) ?? FALLBACK_PATH;
  if (target === current) return null;
  return { target, remainingHistory };
}

export function GlobalBackButton({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useT();
  const navigatingRef = useRef(false);
  const search = searchParams?.toString();
  const current = useMemo(() => `${pathname ?? ""}${search ? `?${search}` : ""}`, [pathname, search]);
  const [action, setAction] = useState<BackAction | null>(null);

  useEffect(() => {
    navigatingRef.current = false;

    if (pathname === "/login") {
      try {
        sessionStorage.removeItem(HISTORY_KEY);
      } catch {
        // The next protected route will start a fresh in-memory navigation trail.
      }
      setAction(null);
      return;
    }

    if (!enabled || !normalizeInternalPath(current)) {
      setAction(null);
      return;
    }

    const history = readHistory();
    if (history.at(-1) !== current) history.push(current);
    const trimmed = history.slice(-MAX_HISTORY_ENTRIES);
    writeHistory(trimmed);
    setAction(previousAction(trimmed, current));
  }, [current, enabled, pathname]);

  const release = useCallback(() => {
    navigatingRef.current = false;
  }, []);

  const goBack = useCallback(() => {
    if (navigatingRef.current) return;

    const nextAction = previousAction(readHistory(), current);
    if (!nextAction) return;
    navigatingRef.current = true;

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      writeHistory(nextAction.remainingHistory);
      setAction(previousAction(nextAction.remainingHistory, nextAction.target));
    };
    const request = new CustomEvent<GlobalBackRequestDetail>(GLOBAL_BACK_REQUEST_EVENT, {
      cancelable: true,
      detail: { target: nextAction.target, commit, release }
    });

    window.dispatchEvent(request);
    if (request.defaultPrevented) return;

    commit();
    startNavigation(t("common.loading"));
    router.push(nextAction.target);
  }, [current, release, router, t]);

  if (!enabled || !action) return null;

  return (
    <div className="mb-4">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border bg-surface-2 px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-surface-1 hover:text-text-primary"
        onClick={goBack}
      >
        <span aria-hidden="true">←</span>
        {t("common.back")}
      </button>
    </div>
  );
}
