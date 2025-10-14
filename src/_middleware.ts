import { NextResponse, NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // временно пропускаем всё
  return NextResponse.next();
}

// временно защищаем только API, а НЕ /admin/*
export const config = {
  matcher: ["/api/admin/:path*"],
};
