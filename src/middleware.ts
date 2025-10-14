import { NextResponse, NextRequest } from "next/server";

const PROTECTED = [/^\/admin(\/|$)/, /^\/api\/admin(\/|$)/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((re) => re.test(pathname));
  if (!isProtected) return NextResponse.next();

  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const ADMIN_USER = process.env.ADMIN_USER || "";
  const ADMIN_PASS = process.env.ADMIN_PASS || "";

  if (!ADMIN_SECRET && (!ADMIN_USER || !ADMIN_PASS)) {
    return new NextResponse("Admin auth not configured", { status: 500 });
  }

  // 1) x-admin-secret (для SSR-fetch) ИЛИ cookie admin_secret
  const headerSecret = req.headers.get("x-admin-secret") ?? "";
  const cookieSecret = req.cookies.get("admin_secret")?.value ?? "";
  if (ADMIN_SECRET && (headerSecret === ADMIN_SECRET || cookieSecret === ADMIN_SECRET)) {
    return NextResponse.next();
  }

  // 2) Basic Auth (для браузера)
  const auth = req.headers.get("authorization");
  if (auth && ADMIN_USER && ADMIN_PASS) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic") {
      const decoded = Buffer.from(encoded ?? "", "base64").toString();
      const [login, password] = decoded.split(":");
      if (login === ADMIN_USER && password === ADMIN_PASS) {
        return NextResponse.next();
      }
    }
  }

  // 3) иначе — запросим авторизацию
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
