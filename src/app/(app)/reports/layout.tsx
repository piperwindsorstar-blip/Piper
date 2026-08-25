import { requireArea } from "@/lib/auth";
import { allReports, computeGroups, testReports } from "@/lib/reports";
import { formatEastern } from "@/lib/dates";
import ReportTabs from "./ReportTabs";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireArea("reports", "view");

  const groups = computeGroups();
  const djOnly = [...groups.djByJob.keys()].filter((job) => !groups.whByJob.has(job)).length;
  const whOnly = [...groups.whByJob.keys()].filter((job) => !groups.djByJob.has(job)).length;
  const tests = testReports().length;

  const reports = allReports(true);
  const latest = reports.reduce<string | null>(
    (max, r) => (max === null || r.sent_at > max ? r.sent_at : max),
    null,
  );

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Crew Reports</h1>
          <div className="topbar-sub">
            Imported from the report emails · most recent {latest ? formatEastern(latest) : "—"}
          </div>
        </div>
      </header>

      <div className="content">
        <div className="grid cols-4">
          <div className="card stat">
            <div className="stat-label">Matched job #s</div>
            <div className="stat-value" style={{ color: "var(--accent)" }}>
              {groups.matchedPairs.length}
            </div>
            <div className="stat-note">both reports in</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Awaiting warehouse</div>
            <div className="stat-value">{djOnly}</div>
            <div className="stat-note">DJ report, no return yet</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Awaiting DJ</div>
            <div className="stat-value">{whOnly}</div>
            <div className="stat-note">return, no show report</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Test entries</div>
            <div className="stat-value" style={{ color: tests ? "var(--danger)" : undefined }}>
              {tests}
            </div>
            <div className="stat-note">excluded from all figures</div>
          </div>
        </div>

        <div style={{ marginTop: "1.25rem" }}>
          <ReportTabs />
          {children}
        </div>
      </div>
    </>
  );
}
