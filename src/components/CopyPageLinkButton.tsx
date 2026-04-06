"use client";

import { useCallback, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";
import { getPublicBaseUrlFromEnv } from "@/lib/public-url";

type Props = {
  /** Path starting with /, e.g. /test-cases/abc/runs/xyz */
  path: string;
  className?: string;
};

export default function CopyPageLinkButton({ path, className }: Props) {
  const locale = useLocale();
  const t = useT();
  const [done, setDone] = useState(false);

  const onCopy = useCallback(async () => {
    const base = getPublicBaseUrlFromEnv() || (typeof window !== "undefined" ? window.location.origin : "");
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      alert(t("common.copyLinkFailed", { locale }));
    }
  }, [path, locale, t]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className={
        className ??
        "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-1 hover:text-text-primary"
      }
    >
      {done ? t("common.linkCopied", { locale }) : t("common.copyLink", { locale })}
    </button>
  );
}
