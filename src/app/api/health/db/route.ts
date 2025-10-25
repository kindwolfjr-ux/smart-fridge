import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // простой запрос к БД
  const now = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
  return NextResponse.json({ ok: true, now: now?.[0]?.now ?? null });
}
