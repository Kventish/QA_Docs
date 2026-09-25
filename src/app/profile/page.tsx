import { getSession } from "@/lib/auth";
import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { t } from "@/lib/i18n/t";
import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  const locale = getServerLocale();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <div className="text-sm text-text-muted">{t("profile.account", { locale })}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("profile.profile", { locale })}</h1>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        {session ? (
          <div className="space-y-6">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-text-muted">{t("profile.email", { locale })}</div>
                <div className="font-medium">{session.email}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-text-muted">{t("profile.role", { locale })}</div>
                <div className="font-medium">{session.role}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-text-muted">{t("profile.userId", { locale })}</div>
                <div className="font-mono text-xs text-text-muted">{session.id}</div>
              </div>
            </div>
            <ChangePasswordForm />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-text-muted">
              {t("profile.notAuthorized", { locale })}
            </div>
            <Link
              className="inline-flex rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
              href="/login?next=%2Fprofile"
            >
              {t("common.signIn", { locale })}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

