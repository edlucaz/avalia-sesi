import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "acesso_liberado";

export async function POST(request: NextRequest) {
  const { senha } = await request.json();
  const senhaCorreta = process.env.SITE_PASSWORD;

  if (!senhaCorreta || senha !== senhaCorreta) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
