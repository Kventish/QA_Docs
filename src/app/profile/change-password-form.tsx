"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";

export default function ChangePasswordForm() {
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate() {
    const next: Record<string, string> = {};
    if (!currentPassword) next.currentPassword = t("profile.currentPasswordRequired");
    if (!newPassword) next.newPassword = t("profile.newPasswordRequired");
    if (newPassword && newPassword.length < 6) next.newPassword = t("profile.minPasswordLength");
    if (newPassword && currentPassword && newPassword === currentPassword) {
      next.newPassword = t("profile.passwordMismatch");
    }
    if (confirmPassword !== newPassword) next.confirmPassword = t("profile.passwordsNotMatch");
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!validate()) return;

    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    }).catch(() => null);

    if (!res) {
      setSaving(false);
      setError(t("profile.failedToChange"));
      return;
    }

    const json = (await res.json().catch(() => null)) as { error?: string };
    if (res.status === 401) {
      window.location.assign("/login?next=%2Fprofile");
      return;
    }
    if (!res.ok) {
      setSaving(false);
      setError(json?.error ?? t("profile.failedToChange"));
      return;
    }

    setSaving(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setSuccess(t("profile.successMessage"));
  }

  return (
    <section className="space-y-3 rounded-lg border bg-surface-2 p-4">
      <h2 className="text-sm font-medium">{t("profile.changePassword")}</h2>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm text-text-muted">{t("profile.currentPassword")}</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              className={`w-full rounded-lg border bg-surface-1 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.currentPassword ? "border-red-500" : ""}`}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, currentPassword: "" }));
              }}
            />
            <button
              type="button"
              aria-label={showCurrent ? t("profile.hidePassword") : t("profile.showPassword")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-surface-1"
              onClick={() => setShowCurrent((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          {fieldErrors.currentPassword ? (
            <p className="text-xs text-red-400">{fieldErrors.currentPassword}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="text-sm text-text-muted">{t("profile.newPassword")}</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              className={`w-full rounded-lg border bg-surface-1 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.newPassword ? "border-red-500" : ""}`}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
              }}
            />
            <button
              type="button"
              aria-label={showNew ? t("profile.hidePassword") : t("profile.showPassword")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-surface-1"
              onClick={() => setShowNew((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          {fieldErrors.newPassword ? (
            <p className="text-xs text-red-400">{fieldErrors.newPassword}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="text-sm text-text-muted">{t("profile.confirmNewPassword")}</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              className={`w-full rounded-lg border bg-surface-1 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.confirmPassword ? "border-red-500" : ""}`}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
            />
            <button
              type="button"
              aria-label={showConfirm ? t("profile.hidePassword") : t("profile.showPassword")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-surface-1"
              onClick={() => setShowConfirm((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          {fieldErrors.confirmPassword ? (
            <p className="text-xs text-red-400">{fieldErrors.confirmPassword}</p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm">
            {success}
          </div>
        ) : null}

        <button
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? t("profile.saving") : t("profile.changePassword")}
        </button>
      </form>
    </section>
  );
}

