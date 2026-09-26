"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const START_EVENT = "qadocs:navigation-start";

export function startNavigation() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const currentUrl = `${pathname ?? ""}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const currentUrlRef = useRef(currentUrl);
  const failSafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (failSafeRef.current) clearTimeout(failSafeRef.current);
    failSafeRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(() => {
    if (failSafeRef.current) clearTimeout(failSafeRef.current);
    setActive(true);
    failSafeRef.current = setTimeout(() => setActive(false), 15000);
  }, []);

  useEffect(() => {
    currentUrlRef.current = currentUrl;
    stop();
  }, [currentUrl, stop]);

  useEffect(() => {
    const onStart = () => start();
    const onPopState = () => {
      const next = `${window.location.pathname}${window.location.search}`;
      if (next !== currentUrlRef.current) start();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin || next.pathname.startsWith("/api/")) return;
      const current = `${window.location.pathname}${window.location.search}`;
      const targetUrl = `${next.pathname}${next.search}`;
      if (targetUrl === current) return;
      start();
    };

    window.addEventListener(START_EVENT, onStart);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", stop);
    return () => {
      window.removeEventListener(START_EVENT, onStart);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick);
      window.removeEventListener("pageshow", stop);
      if (failSafeRef.current) clearTimeout(failSafeRef.current);
    };
  }, [start, stop]);

  return <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>
    <div className="navigation-progress-bar h-full w-full bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
  </div>;
}
