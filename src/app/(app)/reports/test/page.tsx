import { testReports } from "@/lib/reports";
import { formatEastern } from "@/lib/dates";
import Cell from "@/components/Cell";

export default async function TestEntriesPage() {
  const reports = testReports();

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Test entries</h2>
          <div className="faint small">
            Placeholder job numbers (00-xxxx), non-numeric junk, or obviously throwaway content.
            Held here and excluded from matching, crew stats and quality figures.
          </div>
        </div>
        <span className="badge badge-plain">{reports.length}</span>
      </div>

      {reports.length === 0 ? (
        <div className="empty">No test entries — the forms are being used properly.</div>
      ) : (
        <div className="table-wrap">
          <table className="stacking">
            <thead>
              <tr>
                <th>Job # as entered</th>
                <th>Kind</th>
                <th>Crew</th>
                <th>Sent</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <Cell label="Job # as entered" className="mono">
                    {r.job_raw}
                  </Cell>
                  <Cell label="Kind" className="muted">
                    {r.kind === "dj" ? "Show report" : "Warehouse"}
                  </Cell>
                  <Cell label="Crew">{r.crew_raw ?? "—"}</Cell>
                  <Cell label="Sent" className="muted">
                    {formatEastern(r.sent_at)}
                  </Cell>
                  <Cell label="Notes" className="muted small">
                    {r.notes ?? "—"}
                  </Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
