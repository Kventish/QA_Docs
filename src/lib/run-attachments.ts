import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type RunAttachment = {
  name: string;
  size: number;
  type: string;
  url: string;
};

function getUniqueFileName(uploadDir: string, fileName: string) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let uniqueName = fileName;
  let counter = 1;

  while (existsSync(path.join(uploadDir, uniqueName))) {
    uniqueName = `${base}-${counter}${ext}`;
    counter += 1;
  }

  return uniqueName;
}

export async function saveRunAttachments(runId: string, attachments: FormDataEntryValue[]): Promise<RunAttachment[]> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", runId);
  mkdirSync(uploadDir, { recursive: true });

  const stored: RunAttachment[] = [];
  for (const attachment of attachments) {
    if (!(attachment instanceof File)) continue;
    if (!attachment.name || attachment.size === 0) continue;

    const safeName = attachment.name.replace(/\.{2,}/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
    const uniqueName = getUniqueFileName(uploadDir, safeName);
    const filePath = path.join(uploadDir, uniqueName);
    const buffer = Buffer.from(await attachment.arrayBuffer());
    writeFileSync(filePath, buffer);

    stored.push({
      name: uniqueName,
      size: buffer.length,
      type: attachment.type,
      url: `/api/uploads/${runId}/${encodeURIComponent(uniqueName)}`
    });
  }

  return stored;
}
