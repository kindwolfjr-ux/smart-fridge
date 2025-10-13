import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const had = Boolean(req.cookies.get("uid")?.value);
  const res = NextResponse.json({ ok: true, had });
  if (!had) {
    const isProd = process.env.NODE_ENV === "production";
    res.cookies.set("uid", crypto.randomUUID(), {
      httpOnly: true, sameSite: "lax", secure: isProd, maxAge: 60*60*24*180, path: "/",
    });
  }
  return res;
}
