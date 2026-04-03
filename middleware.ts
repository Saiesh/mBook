import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Roles that are allowed to enter the admin portal.
const ADMIN_PORTAL_ROLES = ['admin', 'ho_qs'] as const;

/**
 * Fetches the user's role from `public.users` using the service-role client,
 * which bypasses RLS. Centralised here to avoid repeating the pattern for
 * each protected path check within the same middleware invocation.
 */
async function getUserRole(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string
): Promise<string | null> {
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return data?.role ?? null;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user) {
    // Both /admin/* and /measurements/* require authentication.
    // Unauthenticated visitors are sent to login with a redirect param so
    // they land back in the right place after signing in.
    if (pathname.startsWith('/admin') || pathname.startsWith('/measurements')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // Authenticated users visiting /login should be sent to the section that
  // matches their role rather than always landing on /admin.
  if (pathname === '/login') {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const role = await getUserRole(supabaseUrl, serviceRoleKey, user.id);
      const destination =
        role && (ADMIN_PORTAL_ROLES as readonly string[]).includes(role)
          ? '/admin'
          : '/measurements';
      return NextResponse.redirect(new URL(destination, request.url));
    }
    // Fallback if service role key is missing — keep existing behaviour.
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Gate the entire /admin section to admin-portal roles (admin + ho_qs).
  // site_qs accounts are only permitted in the measurements section and must
  // not reach any admin page, so we redirect them to the dedicated error page.
  if (pathname.startsWith('/admin')) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    const role = await getUserRole(supabaseUrl, serviceRoleKey, user.id);

    if (!role || !(ADMIN_PORTAL_ROLES as readonly string[]).includes(role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Within /admin, the user-management sub-section is further restricted to
    // the 'admin' role only — ho_qs users are redirected back to /admin.
    if (pathname.startsWith('/admin/users') && role !== 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return response;
}

export const config = {
  // Added /measurements/:path* so unauthenticated users are gated at the edge.
  matcher: ['/admin/:path*', '/login', '/measurements/:path*'],
};
