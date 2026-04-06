import Link from "next/link";
import { t } from "@/lib/i18n/t";

type RunEntry = {
  id: string;
  status: string;
  detail: string;
  notes: string;
  attachments?: Array<{ name: string; url: string }>;
  detailUrl?: string;
  createdAt: Date;
};

type Props = {
  runs: RunEntry[];
  locale: string;
  emptyLabel: string;
};

export default function RunHistoryTable({ runs, locale, emptyLabel }: Props) {
  if (runs.length === 0) {
    return <div className="rounded-xl border bg-surface-1 p-6 text-sm text-text-muted">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-surface-1">
      <table className="w-full text-sm">
        <thead className="border-b bg-surface-2 text-left text-text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">{t("common.columns.status", { locale: locale as any })}</th>
            <th className="px-4 py-3 font-medium">{t("runHistory.details", { locale: locale as any })}</th>
            <th className="px-4 py-3 font-medium">{t("runHistory.notes", { locale: locale as any })}</th>
            <th className="px-4 py-3 font-medium">{t("runHistory.attachments", { locale: locale as any })}</th>
            <th className="px-4 py-3 font-medium">{t("runHistory.runLink", { locale: locale as any })}</th>
            <th className="px-4 py-3 font-medium">{t("runHistory.createdAt", { locale: locale as any })}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className={`border-b last:border-b-0 ${run.status === "failed" ? "bg-red-500/[0.06]" : ""}`}
            >
              <td className="px-4 py-3">{t(`runHistory.status.${run.status}` as any, { locale: locale as any })}</td>
              <td className="px-4 py-3 break-words">{run.detail || "—"}</td>
              <td className="px-4 py-3 break-words">{run.notes || "—"}</td>
              <td className="px-4 py-3 break-words">
                {run.attachments && run.attachments.length > 0 ? (
                  <div className="space-y-1">
                    {run.attachments.map((file) => (
                      <a
                        key={file.url}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-brand-600 hover:underline"
                      >
                        {file.name}
                      </a>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                {run.detailUrl ? (
                  <Link href={run.detailUrl} className="text-brand-600 hover:underline">
                    {t("runHistory.viewRun", { locale: locale as any })}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-text-muted">{new Date(run.createdAt).toLocaleString(locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
