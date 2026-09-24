import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { listOpenReports } from "@/lib/data/admin";
import { EmptyState } from "@/components/empty-state";
import { formatRelativeTime } from "@/lib/format";
import { ReportActions } from "@/components/admin/report-actions";

export default async function AdminReportsPage() {
  const reports = await listOpenReports();

  return (
    <div>
      {reports.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No open reports" description="Reported posts, comments, and accounts will show up here." />
      ) : (
        reports.map((report) => {
          const targetHref =
            report.targetType === "post"
              ? `/post/${report.targetId}`
              : report.targetType === "user"
                ? report.preview
                  ? `/${report.preview.replace(/^@/, "")}`
                  : undefined
                : undefined;

          return (
            <div key={report.id} className="border-b px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs tracking-wide uppercase">{report.targetType}</span>
                <span className="text-muted-foreground text-xs">{formatRelativeTime(report.createdAt)}</span>
              </div>
              {report.preview && (
                <p className="mt-1 line-clamp-2 text-sm wrap-break-word">
                  {targetHref ? (
                    <Link href={targetHref} className="hover:underline">
                      {report.preview}
                    </Link>
                  ) : (
                    report.preview
                  )}
                </p>
              )}
              <p className="text-muted-foreground mt-1.5 text-sm">
                Reported by {report.reporter ? `@${report.reporter.username}` : "a user"}: {report.reason}
              </p>
              <div className="mt-2">
                <ReportActions reportId={report.id} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
