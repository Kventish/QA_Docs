"use client";

export const NAVIGATION_START_EVENT = "qadocs:navigation-start";

export function startNavigation(message?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail: { message } }));
}

export default function NavigationProgress({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[10000] h-0.5 overflow-hidden transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
    >
      <div className="navigation-progress-bar h-full w-full bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
    </div>
  );
}
