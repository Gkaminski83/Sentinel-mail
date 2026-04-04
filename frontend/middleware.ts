import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { TOKEN_KEY } from "@/lib/auth"

const PUBLIC_PATHS = ["/login", "/api"]
const PROTECTED_PREFIXES = ["/"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))
  if (
    isPublic ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(TOKEN_KEY)?.value

  if (!token && PROTECTED_PREFIXES.some((path) => pathname.startsWith(path))) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api).*)"],
}
