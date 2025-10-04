import { NextResponse } from "next/server";
export const runtime = "edge";
export async function GET() {
  return NextResponse.json({
    ok: true,
    tag: "ping-001", // поменяешь потом, чтобы видеть, что деплой обновился
    now: new Date().toISOString(),
  });
}
