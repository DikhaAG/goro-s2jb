"use client";

import { useQueryClient } from "@tanstack/react-query";

/**
 * Cached tRPC queries belong to whoever was signed in when they ran, auth.getSession included.
 * Call these whenever the Sesi Pengguna changes, before navigating away.
 */
export function useSessionCache() {
  const queryClient = useQueryClient();

  return {
    /** Resets every query and refetches the mounted ones, so getSession already holds the new user. */
    afterSignIn: () => queryClient.resetQueries(),
    /** Drops every query without refetching; the old page's queries would only get 401s now. */
    afterSignOut: () => queryClient.clear(),
  };
}
