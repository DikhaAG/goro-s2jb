import { requireServerAuth } from "@/lib/server-auth";
import { HomePageClient } from "@/components/home/HomePageClient";

/**
 * Root Operational Dashboard (Beranda Komando).
 * Enforces Layer 2 Server Guard: Unauthenticated visitors are immediately
 * redirected to /login before any client HTML or bundles are generated.
 */
export default async function HomePage() {
  await requireServerAuth();

  return <HomePageClient />;
}
