// Home page is client-rendered to react to locale cookie changes.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/useT";

type SessionUser = {
  email: string;
  role: "admin" | "editor" | "viewer";
};

type Project = { id: string; name: string };

export default function HomePage() {
  const t = useT();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setSession(json?.session ?? null);
      })
      .catch(() => setSession(null))
      .finally(() => setLoadingSession(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoadingProjects(true);
    fetch("/api/projects", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setProjects((json?.projects ?? []) as Project[]))
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [session]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-1 shadow-soft border p-6">
        <div className="text-sm text-text-muted">{t("home.welcome")}</div>
        <h1 className="mt-2 text-2xl font-semibold">{t("home.title")}</h1>
        <p className="mt-2 text-text-muted">{t("home.description")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500"
            href="/projects"
          >
            {t("home.openProjects")}
          </Link>
          {!loadingSession && !session ? (
            <Link
              className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
              href="/login"
            >
              {t("home.signIn")}
            </Link>
          ) : null}
        </div>
      </div>

      {!loadingSession && session ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
            <div className="text-sm text-text-muted">{t("home.account")}</div>
            <h2 className="mt-1 text-xl font-semibold">{session.email}</h2>
            <div className="mt-3 text-sm text-text-muted capitalize">{session.role}</div>
          </div>

          <div className="rounded-xl border bg-surface-1 p-6 shadow-soft lg:col-span-2">
            <div className="text-sm text-text-muted">{t("home.quickLinks")}</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Link
                className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                href="/test-cases"
              >
                {t("testCases.title")}
              </Link>
              <Link
                className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                href="/checklists"
              >
                {t("checklists.title")}
              </Link>
              <Link
                className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                href="/test-plans"
              >
                {t("testPlans.title")}
              </Link>
              <Link
                className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                href="/profile"
              >
                {t("profile.profile")}
              </Link>
              <Link
                className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                href="/projects"
              >
                {t("projects.title")}
              </Link>
            </div>
          </div>

          <div className="rounded-xl border bg-surface-1 p-6 shadow-soft lg:col-span-3">
            <div className="text-sm text-text-muted">{t("home.accessibleProjects")}</div>
            <div className="mt-4 space-y-2">
              {loadingProjects ? (
                <div className="text-sm text-text-muted">{t("common.loading")}</div>
              ) : projects.length === 0 ? (
                <div className="text-sm text-text-muted">{t("home.noAccessibleProjects")}</div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="rounded-lg border bg-surface-2 px-3 py-2 text-sm">
                    {project.name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

