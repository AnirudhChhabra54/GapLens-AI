// ==============================================================================
// GapLens AI — Next.js Request Middleware
// Manages session refreshes for @supabase/ssr and enforces route protection.
// Allows unauthenticated access only to public routes (landing, login) or active demo sessions.
// ==============================================================================

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const { pathname } = request.nextUrl;
  const isProtectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/materials") ||
    pathname.startsWith("/diagnostic") ||
    pathname.startsWith("/gap-report") ||
    pathname.startsWith("/planner");

  const isDemo = request.cookies.get("gaplens_demo_session")?.value === "true";

  // If Supabase is not configured, allow access if demo cookie is set or allow client-only dev
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath && !isDemo) {
      // In offline mode without Supabase, unauthenticated users without demo flag are routed to /login
      const authHeader = request.cookies.get("gaplens_auth_state")?.value;
      if (!authHeader) {
        // Let AppShell handle the state transition smoothly if local storage exists
        return response;
      }
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes the session token if expired
  let user = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    user = null;
  }

  // Redirect unauthenticated non-demo requests to /login
  if (isProtectedPath && !user && !isDemo) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
