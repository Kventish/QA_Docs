"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";

type User = {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  createdAt: string;
};

export default function UsersPage() {
  const locale = useLocale();
  const t = useT();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/users", { cache: "no-store", credentials: "include" }).catch(
      () => null
    );
    if (!res) {
      setUsers([]);
      setLoading(false);
      setError(t("users.loadFailed"));
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/users")}`);
      return;
    }
    if (res.status === 403) {
      window.location.assign("/");
      return;
    }
    const json = await res.json().catch(() => null);
    setUsers(json?.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function deleteUser(id: string) {
    if (!confirm(t("users.deleteConfirm"))) return;
    setError(null);
    setDeletingId(id);
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      credentials: "include"
    }).catch(() => null);

    if (!res) {
      setDeletingId(null);
      setError(t("users.deleteFailed"));
      return;
    }
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/users")}`);
      return;
    }
    if (!res.ok) {
      setDeletingId(null);
      setError(json?.error ?? t("users.deleteFailed"));
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("users.title")}</h1>
        <Link
          className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
          href="/users/new"
        >
          {t("users.createUser")}
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-surface-1">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-left text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("users.email")}</th>
              <th className="px-4 py-3 font-medium">{t("users.roleLabel")}</th>
              <th className="px-4 py-3 font-medium">{t("users.created")}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs">
                    {t(`users.${u.role}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {new Date(u.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1"
                      href={`/users/${u.id}/edit`}
                    >
                      {t("users.edit")}
                    </Link>
                    <button
                      className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
                      disabled={deletingId === u.id}
                      onClick={() => deleteUser(u.id)}
                    >
                      {deletingId === u.id ? "…" : t("users.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={4}>
                  {t("users.empty")}
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={4}>
                  {t("common.loading")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

