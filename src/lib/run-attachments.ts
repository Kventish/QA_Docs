import { put } from "@vercel/blob";

type RunAttachment = {
  name: string;
  size: number;
  type: string;
  url: string;
};

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .replace(/\.{2,}/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment"
  );
}

function encodePathname(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function saveRunAttachments(
  runId: string,
  attachments: FormDataEntryValue[]
): Promise<RunAttachment[]> {
  const stored: RunAttachment[] = [];

  for (const attachment of attachments) {
    if (!(attachment instanceof File)) continue;
    if (!attachment.name || attachment.size === 0) continue;

    const safeName = sanitizeFileName(attachment.name);

    const blob = await put(
      `runs/${runId}/${safeName}`,
      attachment,
      {
        access: "private",
        addRandomSuffix: true,
        contentType: attachment.type || undefined
      }
    );

    stored.push({
      name: safeName,
      size: attachment.size,
      type:
        attachment.type ||
        blob.contentType ||
        "application/octet-stream",
      url: `/api/uploads/${encodePathname(blob.pathname)}`
    });
  }

  return stored;
}