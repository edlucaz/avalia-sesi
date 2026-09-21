import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "acesso_liberado";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/acesso") ||
    pathname.startsWith("/api/acesso") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname === "/sesi-logo.png"
  ) {
    return NextResponse.next();
  }

  const liberado = request.cookies.get(COOKIE_NAME)?.value === "1";
  if (liberado) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/acesso";
  url.searchParams.set("proximo", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
