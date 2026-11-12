import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const trpcProxy: any = vi.hoisted(() => {
  const proxy: any = new Proxy(
    () => ({
      data: {
        role: "SUPER_ADMIN",
        name: "Super Administrator GORO",
        services: [],
        processes: [],
        lines: ["[INFO] Worker ready with a very long log line that should wrap gracefully on mobile screens"],
        totalLines: 1,
        sizeBytes: 128,
        resources: {
          cpuCount: 4,
          cpuModel: "x86_64",
          totalMemBytes: 8 * 1024 * 1024 * 1024,
          freeMemBytes: 4 * 1024 * 1024 * 1024,
          usedMemBytes: 4 * 1024 * 1024 * 1024,
          memUsagePercent: 50,
          processUptimeSeconds: 3600,
          systemUptimeSeconds: 86400,
          nodeMemory: { rss: 128 * 1024 * 1024, heapTotal: 64 * 1024 * 1024, heapUsed: 48 * 1024 * 1024, external: 8 * 1024 * 1024 },
          platform: "linux",
          arch: "x64",
        },
        items: [],
        totalCount: 0,
        totalPages: 1,
        kpi: { activeOcr: 0 },
      },
      isFetching: false,
      isLoading: false,
      isPending: false,
      refetch: vi.fn(),
      mutate: vi.fn(),
    }),
    {
      get(_target, prop) {
        if (prop === "useQuery" || prop === "useMutation" || prop === "useUtils") {
          return () => proxy();
        }
        return proxy;
      },
    }
  );
  return proxy;
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/system-processes",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: trpcProxy,
}));

import { GlobalSidebar } from "@/components/layout/GlobalSidebar";
import SystemProcessesPage from "@/app/(admin)/system-processes/page";
import { RunningProcessTable } from "@/components/admin/system/RunningProcessTable";
import { ServiceStatusGrid } from "@/components/admin/system/ServiceStatusGrid";
import { LiveLogViewer } from "@/components/admin/system/LiveLogViewer";
import { ReviewsDashboard } from "@/components/operator/reviews/ReviewsDashboard";

describe("Mobile responsive & layout regression guards", () => {
  it("pins GlobalSidebar footer with scrollable nav so Keluar dari Sesi never clips on short screens", () => {
    const html = renderToStaticMarkup(<GlobalSidebar onClose={vi.fn()} className="w-full" />);

    expect(html).toContain("max-h-[100dvh]");
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("min-h-0");
    expect(html).toContain("shrink-0");
    expect(html).toContain("Keluar dari Sesi");
  });

  it("prevents ReviewsDashboard header title crush and button clipping across tablet/laptop widths", () => {
    const html = renderToStaticMarkup(
      <ReviewsDashboard
        initialSession={{
          id: "u1",
          username: "admin",
          name: "Super Administrator GORO",
          role: "SUPER_ADMIN",
        }}
      />
    );

    expect(html).toContain("Pusat Triase &amp; Kelola Data Ulasan");
    expect(html).toContain("2xl:flex-row");
    expect(html).toContain("flex-wrap");
    // Export CSV label should remain visible on mobile rather than icon-only
    expect(html).not.toContain('class="hidden sm:inline">Ekspor CSV<');
  });

  it("renders SystemProcessesPage with responsive outer padding and full-width flow", () => {
    const html = renderToStaticMarkup(<SystemProcessesPage />);

    expect(html).toContain("p-4 sm:p-6 lg:p-8");
    expect(html).toContain("min-w-0");
  });

  it("renders mobile card view in RunningProcessTable alongside desktop table with >=44px action buttons", () => {
    const html = renderToStaticMarkup(
      <RunningProcessTable
        processes={[
          {
            pid: 1234,
            ppid: 1,
            cpuPercent: 12.5,
            memPercent: 3.2,
            rssKb: 256000,
            status: "S",
            elapsedTime: "01:20:00",
            command: "goro-engine --host 0.0.0.0 --port 8001",
            serviceType: "RUST_OCR",
            isSafeToKill: true,
          },
        ]}
        onSelectProcessToKill={vi.fn()}
      />
    );

    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden md:block");
    expect(html).toContain("min-h-[44px]");
  });

  it("uses xl:grid-cols-4 (not cramped lg:grid-cols-4) and >=44px actions in ServiceStatusGrid", () => {
    const html = renderToStaticMarkup(
      <ServiceStatusGrid
        services={[
          {
            name: "Rust Vision Core",
            port: 8001,
            serviceType: "RUST_OCR",
            status: "UP",
            latencyMs: 12,
            pid: 42,
          },
        ]}
        onRestartWorker={vi.fn()}
        onViewLogs={vi.fn()}
      />
    );

    expect(html).toContain("xl:grid-cols-4");
    expect(html).not.toContain("lg:grid-cols-4");
    expect(html).toContain("min-h-[44px]");
  });

  it("makes LiveLogViewer toolbar wrap cleanly, keep nowrap tabs, and wrap long log lines on mobile", () => {
    const html = renderToStaticMarkup(
      <LiveLogViewer
        activeFile="worker_ocr.log"
        onSelectFile={vi.fn()}
        lines={["ERROR super-long-unbroken-string-without-spaces-for-mobile-wrap-check"]}
        totalLines={1}
        sizeBytes={64}
        onRefresh={vi.fn()}
        lineCount={100}
        onChangeLineCount={vi.fn()}
      />
    );

    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("break-words");
    expect(html).toContain("min-h-[44px]");
  });
});
