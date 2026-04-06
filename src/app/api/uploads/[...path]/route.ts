import path from "node:path";
import { existsSync, promises as fsPromises } from "node:fs";

export const runtime = "nodejs";

function getMimeType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    case ".csv":
      return "text/csv";
    case ".txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export async function GET(_req: Request, { params }: { params: { path?: string[] } }) {
  const segments = params.path ?? [];
  const baseDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(baseDir, ...segments);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(baseDir)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  if (!existsSync(normalized)) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const fileName = path.basename(normalized);
  const mimeType = getMimeType(fileName);
  const fileBuffer = await fsPromises.readFile(normalized);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${fileName}"`
    }
  });
}
