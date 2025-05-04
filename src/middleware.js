import { NextResponse } from "next/server"

export function middleware(request) {
  // Yalnızca yönlendirme, header işlemleri gibi basit işler yapılabilir
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/excel/:path*", "/api/download/:path*"],
}