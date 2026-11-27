"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { MigrationGuardProvider } from "@/context/MigrationGuardContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <MigrationGuardProvider>{children}</MigrationGuardProvider>
        </NuqsAdapter>
        <Toaster
          position="bottom-center"
          closeButton
          containerAriaLabel="Notifikasi"
          icons={{
            success: <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden />,
            error: <AlertCircle className="w-4 h-4 text-rose-400" aria-hidden />,
            close: <X className="w-3.5 h-3.5" aria-hidden />,
          }}
          toastOptions={{
            unstyled: true,
            closeButtonAriaLabel: "Tutup notifikasi",
            classNames: {
              toast:
                "w-full flex items-center gap-3 bg-[#0f172a] text-white border border-[#334155] shadow-2xl rounded-2xl px-4 py-2.5",
              icon: "shrink-0",
              title: "text-xs font-semibold break-words",
              actionButton:
                "shrink-0 h-8 px-3 text-xs font-semibold rounded-lg bg-[#1e293b] hover:bg-[#334155] text-[#38bdf8] border border-[#0284c7]/40 transition cursor-pointer focus-utility-ring",
              closeButton:
                "order-last ml-auto shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white focus-utility-ring cursor-pointer",
            },
          }}
        />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
