"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Shown when an authenticated user attempts to access a section they are not
 * permitted to enter (e.g. a site_qs user navigating to /admin).
 * This page is intentionally public — no auth guard needed — so the browser
 * can always render it regardless of session state.
 *
 * "use client" is required here because the sign-out action needs to call
 * supabase.auth.signOut() to clear the browser-side session before redirecting.
 */
export default function UnauthorizedPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      // Also notify the server-side session via the API route so cookies are cleared.
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("[UnauthorizedPage] sign-out error:", err);
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="mt-2 text-sm text-gray-600">
          You don&apos;t have permission to access this area.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-8 px-6 space-y-4">
          <p className="text-sm text-gray-500 text-center">
            Your account role does not allow access to the admin portal. You can
            continue to the measurements section or sign out.
          </p>

          <Link
            href="/measurements"
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            Go to Measurements
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
