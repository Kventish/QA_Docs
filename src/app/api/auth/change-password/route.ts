import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { clearSessionCookie } from "@/lib/auth";

const BodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

export async function POST(req: Request) {
  const auth = apiRequireRole("viewer");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.session.id } });
  if (!user) {
    clearSessionCookie();
    return NextResponse.json(
      { error: "Сессия недействительна. Войдите снова." },
      { status: 401 }
    );
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Текущий пароль неверный" }, { status: 400 });
  }

  const sameAsCurrent = await bcrypt.compare(parsed.data.newPassword, user.passwordHash);
  if (sameAsCurrent) {
    return NextResponse.json(
      { error: "Новый пароль должен отличаться от текущего" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  return NextResponse.json({ ok: true });
}

