"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, notifyLocaleChanged, useT } from "@/lib/i18n/useT";
import ToastCenter from "@/components/toast/ToastCenter";
import NavigationProgress from "@/components/navigation/NavigationProgress";

type SearchResult = {
  testCases: { id: string; title: string }[];
  checklists: { id: string; title: string }[];
  testPlans: { id: string; title: string }[];
};

const nav = [
  { href: "/", key: "nav.dashboard" },
  { href: "/projects", key: "nav.projects" },
  { href: "/test-cases", key: "nav.testCases" },
  { href: "/checklists", key: "nav.checklists" },
  { href: "/test-plans", key: "nav.testPlans" },
  { href: "/users", key: "nav.users" }
];

type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const locale = useLocale();
  const t = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }
    const t = setTimeout(() => {
      setSearchLoading(true);
      setSearchOpen(true);
      fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data: SearchResult) => setSearchResults(data))
        .catch(() => setSearchResults({ testCases: [], checklists: [], testPlans: [] }))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) closeSearch();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick, true);
    };
  }, [closeSearch]);

  const isAuthed = !!session;
  const isAdmin = session?.role === "admin";

  const navFiltered = useMemo(() => {
    if (isAdmin) return nav;
    return nav.filter((i) => i.href !== "/users");
  }, [isAdmin]);

  const activeTitle = useMemo(() => {
    if (!pathname) return t("nav.dashboard");
    const item = nav.find((item) => {
      if (item.href === "/") return pathname === "/";
      return pathname.startsWith(item.href);
    });
    return item ? t(item.key) : "";
  }, [pathname, t]);

  async function loadSession() {
    const res = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "include"
    }).catch(() => null);
    if (!res?.ok) return null;
    const json = await res.json().catch(() => null);
    return (json?.session ?? null) as SessionUser | null;
  }

  useEffect(() => {
    let alive = true;
    setSessionLoading(true);
    loadSession()
      .then((s) => {
        if (!alive) return;
        setSession(s);
      })
      .finally(() => {
        if (!alive) return;
        setSessionLoading(false);
      });

    // Retry a few times after navigation/login: some browsers delay cookie availability after redirects.
    let tries = 0;
    const intervalId = window.setInterval(() => {
      if (!alive) return;
      tries += 1;
      loadSession().then((s) => {
        if (!alive) return;
        if (s) {
          setSession(s);
          window.clearInterval(intervalId);
        }
      });
      if (tries >= 5) window.clearInterval(intervalId);
    }, 700);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <NavigationProgress />
      <ToastCenter />
      <div className="flex min-h-screen">
        <aside className="fixed left-0 top-0 hidden h-screen w-64 shrink-0 border-r bg-surface-1 md:block">
          <div className="flex h-full flex-col overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">QA Docs</div>
              <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
                MVP
              </span>
            </div>
            <div className="mt-4 space-y-1">
              {navFiltered.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                      active
                        ? "bg-surface-2 text-text-primary"
                        : "text-text-muted hover:bg-surface-2 hover:text-text-primary"
                    ].join(" ")}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 opacity-70" />
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto pt-6">
              <div className="text-xs font-medium text-text-muted">{t("common.language")}</div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={[
                    "flex-1 rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1",
                    locale === "en" ? "border-brand-500/60 text-text-primary" : "text-text-muted"
                  ].join(" ")}
                  onClick={async () => {
                    await fetch("/api/i18n/locale", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ locale: "en" })
                    }).catch(() => null);
                    notifyLocaleChanged();
                    router.refresh();
                  }}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={[
                    "flex-1 rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1",
                    locale === "ru" ? "border-brand-500/60 text-text-primary" : "text-text-muted"
                  ].join(" ")}
                  onClick={async () => {
                    await fetch("/api/i18n/locale", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ locale: "ru" })
                    }).catch(() => null);
                    notifyLocaleChanged();
                    router.refresh();
                  }}
                >
                  RU
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:ml-64">
          <header className="sticky top-0 z-10 border-b bg-surface-1/80 backdrop-blur">
            <div className="flex h-14 items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium">{activeTitle}</div>
              </div>
              <div className="flex items-center gap-3">
                <div ref={searchRef} className="relative hidden md:block">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                    className="w-72 rounded-lg border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder={t("common.search")}
                  />
                  {searchOpen && searchQuery.trim() && (
                    <div className="absolute top-full left-0 z-20 mt-1 w-72 rounded-lg border bg-surface-1 shadow-lg">
                      {searchLoading ? (
                        <div className="px-3 py-4 text-center text-sm text-text-muted">{t("common.loading")}</div>
                      ) : searchResults ? (
                        <div className="max-h-80 overflow-y-auto py-2">
                          {[
                            { key: "testCases", labelKey: "testCases.title", items: searchResults.testCases, base: "/test-cases" },
                            { key: "checklists", labelKey: "checklists.title", items: searchResults.checklists, base: "/checklists" },
                            { key: "testPlans", labelKey: "testPlans.title", items: searchResults.testPlans, base: "/test-plans" }
                          ].map(({ key, labelKey, items, base }) =>
                            items.length > 0 ? (
                              <div key={key} className="mb-2 last:mb-0">
                                <div className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                                  {t(labelKey)}
                                </div>
                                <ul className="space-y-0.5">
                                  {items.map((item) => (
                                    <li key={item.id}>
                                      <Link
                                        href={`${base}/${item.id}`}
                                        className="block px-3 py-2 text-sm text-text-primary hover:bg-surface-2"
                                        onClick={closeSearch}
                                      >
                                        {item.title}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null
                          )}
                          {!searchLoading &&
                            searchResults.testCases.length === 0 &&
                            searchResults.checklists.length === 0 &&
                            searchResults.testPlans.length === 0 && (
                              <div className="px-3 py-4 text-center text-sm text-text-muted">{t("common.nothingFound")}</div>
                            )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                {sessionLoading ? (
                  <div className="rounded-lg border bg-surface-2 px-3 py-2 text-sm text-text-muted">
                    {t("common.loading")}
                  </div>
                ) : !isAuthed ? (
                  <Link
                    href="/login"
                    className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                  >
                    {t("common.signIn")}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/profile"
                      className="hidden rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1 md:block"
                      title={session.email}
                    >
                      {session.email}
                    </Link>
                    <button
                      className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST" });
                        setSession(null);
                        window.location.assign("/");
                      }}
                    >
                      {t("common.signOut")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

