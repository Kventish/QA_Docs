import { NextResponse } from "next/server";
import { apiRequireRole } from "@/lib/api-auth";
export const runtime = "nodejs";
export async function POST() {
 const auth = await apiRequireRole("editor");
 if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
 return NextResponse.json({ error: "Run API retired. Reload the document and use Start." }, { status: 410 });
}
