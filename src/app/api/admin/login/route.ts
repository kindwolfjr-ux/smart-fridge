import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provided = searchParams.get("secret");
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ADMIN_SECRET not set" }, { status: 500 });
  }

  if (provided !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 👇 добавляем await
  const cookieStore = await cookies();
  cookieStore.set("admin_secret", secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 дней
  });

  return NextResponse.json({ ok: true });
}
