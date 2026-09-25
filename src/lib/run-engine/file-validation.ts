import { RunError } from "./domain";
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_BODY_BYTES = 4_000_000;

export function validateFile(name: string, declaredType: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new RunError("fileSize", 413);
  const extension = name.toLowerCase().split(".").pop();
  const starts = (signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b);
  let contentType: string;
  if (extension === "png" && starts([137,80,78,71,13,10,26,10])) contentType = "image/png";
  else if (["jpg", "jpeg"].includes(extension ?? "") && starts([255,216,255])) contentType = "image/jpeg";
  else if (extension === "webp" && starts([82,73,70,70]) && starts([87,69,66,80], 8)) contentType = "image/webp";
  else if (extension === "pdf" && starts([37,80,68,70,45])) contentType = "application/pdf";
  else if (["txt", "log"].includes(extension ?? "")) {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new RunError("fileType"); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new RunError("fileType");
    contentType = "text/plain";
  } else throw new RunError("fileType");
  const declared = declaredType.toLowerCase().split(";")[0].trim();
  if (declared && declared !== "application/octet-stream" && declared !== contentType) throw new RunError("fileType");
  return { originalName: name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 200), contentType };
}

export async function uploadForm(req: Request) {
  if (Number(req.headers.get("content-length")) > MAX_UPLOAD_BODY_BYTES) throw new RunError("fileSize", 413);
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new RunError("invalidPayload");
  const reader = req.body?.getReader();
  if (!reader) throw new RunError("invalidPayload");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_UPLOAD_BODY_BYTES) { await reader.cancel(); throw new RunError("fileSize", 413); }
    chunks.push(part.value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Response(body, { headers: { "Content-Type": req.headers.get("content-type")! } }).formData(); }
  catch { throw new RunError("invalidPayload"); }
}
