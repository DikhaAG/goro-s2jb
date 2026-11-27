import { NextResponse, type NextRequest } from "next/server";
import { authorizeProxy } from "@/lib/routeAuthorization";
import { session } from "@/server/session/live";

/**
 * Next.js Proxy (Layer 1 Security Adapter, Node runtime).
 *
 * Delegates page authorization, alias canonicalization, and 403/404/login routing
 * to Otorisasi Rute, while owning HTTP header sanitization and NextResponse adaptation.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const decision = await authorizeProxy(
    pathname,
    () => session.getUser(request.headers),
    search
  );

  if (decision.kind === "bypass") {
    return NextResponse.next();
  }

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  // Prevent client header spoofing by sanitizing internal context headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-role");
  requestHeaders.delete("x-user-name");

  if (decision.user) {
    requestHeaders.set("x-user-id", decision.user.id);
    requestHeaders.set("x-user-role", decision.user.role);
    requestHeaders.set("x-user-name", encodeURIComponent(decision.user.name));
  }

  if (decision.kind === "not-found") {
    const notFoundResponse = NextResponse.rewrite(new URL("/_not-found", request.url), {
      status: 404,
      request: { headers: requestHeaders },
    });
    notFoundResponse.headers.set("x-user-role", decision.user.role);
    notFoundResponse.headers.set("x-user-id", decision.user.id);
    return notFoundResponse;
  }

  const response = decision.rewriteTo
    ? NextResponse.rewrite(new URL(decision.rewriteTo, request.url), {
        request: { headers: requestHeaders },
      })
    : NextResponse.next({
        request: { headers: requestHeaders },
      });

  if (decision.user) {
    response.headers.set("x-user-role", decision.user.role);
    response.headers.set("x-user-id", decision.user.id);
  }
  return response;
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (route handlers and tRPC enforce their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset file extensions
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
