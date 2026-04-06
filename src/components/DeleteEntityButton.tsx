"use client";

import { useState } from "react";

type DeleteEntityButtonProps = {
  href: string;
  redirectTo: string;
  confirmText: string;
  label: string;
};

export default function DeleteEntityButton({ href, redirectTo, confirmText, label }: DeleteEntityButtonProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(confirmText)) return;
    setDeleting(true);

    const res = await fetch(href, {
      method: "DELETE",
      credentials: "include"
    }).catch(() => null);

    if (!res || !res.ok) {
      setDeleting(false);
      alert("Delete failed");
      return;
    }

    window.location.assign(redirectTo);
  }

  return (
    <button
      type="button"
      className="rounded-lg border border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? "Deleting…" : label}
    </button>
  );
}
