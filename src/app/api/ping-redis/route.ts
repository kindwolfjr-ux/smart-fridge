import { NextResponse } from "next/server";
import { redis } from "@/lib/cache";

export async function GET() {
  try {
    await redis.set("test:key", "hello");
    const value = await redis.get("test:key");
    return NextResponse.json({ ok: true, value });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
