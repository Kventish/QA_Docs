"use client";

import { useMemo, useState } from "react";

type Attachment = {
  name: string;
  url: string;
  type?: string;
};

const imageExtensions = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function isImageAttachment(attachment: Attachment) {
  if (attachment.type) {
    return attachment.type.startsWith("image/");
  }
  return imageExtensions.test(attachment.name);
}

export default function AttachmentViewer({ attachments }: { attachments: Attachment[] }) {
  const [selected, setSelected] = useState<Attachment | null>(null);
  const imageAttachments = useMemo(
    () => attachments.filter(isImageAttachment),
    [attachments]
  );

  return (
    <div className="space-y-4">
      {imageAttachments.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {imageAttachments.map((file) => (
            <button
              key={file.url}
              type="button"
              onClick={() => setSelected(file)}
              className="group overflow-hidden rounded-xl border bg-surface-2 p-2 text-left transition hover:border-brand-500"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-950/5">
                <img
                  src={file.url}
                  alt={file.name}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                />
              </div>
              <div className="mt-2 text-sm text-text-muted">{file.name}</div>
            </button>
          ))}
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((file) => (
            <div key={file.url} className="flex flex-wrap items-center gap-2 rounded-xl border bg-surface-2 p-3">
              <span className="block truncate text-sm text-text-muted">{file.name}</span>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-surface-3 px-3 py-1 text-sm font-medium text-brand-600 hover:bg-surface-1"
              >
                Open
              </a>
              {isImageAttachment(file) ? (
                <button
                  type="button"
                  onClick={() => setSelected(file)}
                  className="rounded-lg bg-surface-3 px-3 py-1 text-sm font-medium text-brand-600 hover:bg-surface-1"
                >
                  Preview
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-text-muted">—</div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-sm text-white hover:bg-black"
          >
            Close
          </button>
          <div className="max-h-full max-w-full overflow-hidden rounded-3xl bg-black p-4 shadow-2xl">
            <img
              src={selected.url}
              alt={selected.name}
              className="max-h-[80vh] max-w-[90vw] object-contain"
            />
            <div className="mt-3 text-center text-sm text-white">{selected.name}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
