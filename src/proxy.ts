import { NextResponse, type NextRequest } from "next/server";

// Yalnız sürətli (optimistik) yoxlama: session cookie-si yoxdursa /login-ə yönləndir.
// Əsl yoxlama (DB-də etibarlı session) src/lib/dal.ts-dədir — hər səhifə, action və API özü yoxlayır.
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has("sr_session");
  if (!hasSession && pathname !== "/login") {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // API-lər öz auth yoxlamasını edir (401 qaytarır, yönləndirmir); statik fayllar istisnadır
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp)$).*)"],
};
