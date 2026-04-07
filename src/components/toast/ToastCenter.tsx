"use client";

import { useEffect, useMemo, useState } from "react";

type ToastPayload = {
  type?: "error" | "success" | "info";
  message: string;
};

const EVENT_NAME = "qadocs-toast";

export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
}

export default function ToastCenter() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const styles = useMemo(() => {
    const type = toast?.type ?? "info";
    if (type === "error") return "border-red-500/40 bg-red-500/15 text-red-100";
    if (type === "success") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
    return "border-surface-2 bg-surface-1 text-text-primary";
  }, [toast]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<ToastPayload>;
      if (!ev?.detail?.message) return;
      setToast({ type: ev.detail.type ?? "info", message: ev.detail.message });
    };
    window.addEventListener(EVENT_NAME, handler as any);
    return () => window.removeEventListener(EVENT_NAME, handler as any);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed top-6 left-1/2 z-50 w-[min(720px,calc(100vw-24px))] -translate-x-1/2">
      <div className={`rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${styles}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="whitespace-pre-wrap text-sm">{toast.message}</div>
          <button
            type="button"
            className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1"
            onClick={() => setToast(null)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

