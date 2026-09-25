import { get } from "@vercel/blob";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { path?: string[] } }
) {
  const session = getSession();

  if (!session) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const segments = params.path ?? [];

  if (segments.length === 0) {
    return new Response(
      JSON.stringify({ error: "Missing path" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const pathname = segments.join("/");

  // Разрешаем читать только вложения прогонов.
  if (
    !pathname.startsWith("runs/") ||
    pathname.includes("..")
  ) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const result = await get(pathname, {
    access: "private",
    ifNoneMatch: req.headers.get("if-none-match") ?? undefined
  });

  if (!result) {
    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache"
      }
    });
  }

  return new Response(result.stream, {
    status: 200,
    headers: {
      "Content-Type":
        result.blob.contentType ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache"
    }
  });
}