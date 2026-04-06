"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";

type Item = { text: string; checked: boolean; expectedResult?: string };

export default function ChecklistItems({
  checklistId,
  initialItems,
  canEdit = false
}: {
  checklistId: string;
  initialItems: Item[];
  canEdit?: boolean;
}) {
  const t = useT();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [updating, setUpdating] = useState(false);

  async function toggleChecked(idx: number) {
    if (!canEdit) return;
    const next = items.map((it, i) =>
      i === idx ? { ...it, checked: !it.checked } : it
    );
    setItems(next);
    setUpdating(true);
    const res = await fetch(`/api/checklists/${checklistId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: next })
    }).catch(() => null);
    setUpdating(false);
    if (!res?.ok) setItems(items);
  }

  return (
    <div className="mt-3">
      {items.length ? (
        <div className="overflow-hidden rounded-xl border border-surface-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-2 bg-surface-2/80">
                <th className="w-10 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t("checklists.tableHeader.no")}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t("checklists.tableHeader.step")}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t("checklists.tableHeader.expectedResult")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-2">
              {items.map((it, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-surface-1" : "bg-surface-2/30"}>
                  <td className="px-3 py-2.5 text-text-muted">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <label className={`inline-flex items-start gap-2 ${canEdit ? "cursor-pointer" : ""}`}>
                      <input
                        type="checkbox"
                        checked={it.checked}
                        disabled={!canEdit || updating}
                        onChange={() => toggleChecked(idx)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-2 text-brand-600 focus:ring-2 focus:ring-brand-500"
                      />
                      <span className={it.checked ? "text-text-muted line-through" : ""}>{it.text || t("checklists.emptyText")}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{it.expectedResult || t("checklists.emptyText")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-text-muted">{t("checklists.emptyText")}</div>
      )}
    </div>
  );
}
