import { NextResponse, NextRequest } from "next/server";

const PROTECTED = [/^\/admin(\/|$)/, /^\/api\/admin(\/|$)/];

export function middleware(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const isProtected = PROTECTED.some((re) => re.test(url.pathname));
    if (!isProtected) return NextResponse.next();

    const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
    const ADMIN_USER = process.env.ADMIN_USER || "";
    const ADMIN_PASS = process.env.ADMIN_PASS || "";

    if (!ADMIN_SECRET && (!ADMIN_USER || !ADMIN_PASS)) {
      return new NextResponse("Admin auth not configured", { status: 500 });
    }

    const headerSecret = req.headers.get("x-admin-secret") ?? "";
    const cookieSecret = req.cookies.get("admin_secret")?.value ?? "";
    if (ADMIN_SECRET && (headerSecret === ADMIN_SECRET || cookieSecret === ADMIN_SECRET)) {
      return NextResponse.next();
    }

    const auth = req.headers.get("authorization") || "";
    if (auth.startsWith("Basic ") && ADMIN_USER && ADMIN_PASS) {
      try {
        const [login, pass] = atob(auth.slice(6)).split(":");
        if (login === ADMIN_USER && pass === ADMIN_PASS) return NextResponse.next();
      } catch {}
    }

    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  } catch {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
