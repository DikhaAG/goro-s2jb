import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueueJobsManager, type QueueJobItem } from "@/components/migration/QueueJobsManager";

const redactedFailedJob: QueueJobItem = {
  id: "job-42",
  name: "import-batch",
  data: null,
  progress: 40,
  timestamp: 1795700000000,
  attemptsMade: 3,
  failedReason: "Job gagal diproses. Detail teknis hanya tersedia untuk Super Admin.",
  stacktrace: [],
};

function render(isSuperAdmin: boolean) {
  return renderToStaticMarkup(
    <QueueJobsManager
      queueName="import"
      onQueueNameChange={vi.fn()}
      status="failed"
      onStatusChange={vi.fn()}
      jobs={[redactedFailedJob]}
      totalJobs={1}
      currentPage={1}
      pageSize={10}
      totalPages={1}
      onPageChange={vi.fn()}
      onRetryJob={vi.fn()}
      onRemoveJob={vi.fn()}
      onRetryAllFailed={vi.fn()}
      onCleanQueue={vi.fn()}
      isSuperAdmin={isSuperAdmin}
    />
  );
}

describe("QueueJobsManager job internals", () => {
  it("does not offer Pegawai a 'Lihat Data' control, since the server sends them no payload", () => {
    const html = render(false);

    expect(html).toContain("Job #job-42");
    expect(html).toContain("Detail teknis hanya tersedia untuk Super Admin");
    expect(html).not.toContain("Lihat Data");
  });

  it("keeps the 'Lihat Data' control for Super Admin", () => {
    expect(render(true)).toContain("Lihat Data");
  });
});
