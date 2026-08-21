import { computeGroups, reportsOfKind } from "@/lib/reports";
import { formatEastern } from "@/lib/dates";
import Cell from "@/components/Cell";

export default async function DjReportsPage() {
  const reports = reportsOfKind("dj");
  const { whByJob } = computeGroups();

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Show reports</h2>
          <div className="faint small">
            Every show report received, matched or not. Ratings are client / crowd / staff.
          </div>
        </div>
        <span className="badge badge-plain">{reports.length}</span>
      </div>

      {reports.length === 0 ? (
        <div className="empty">No show reports imported yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="stacking">
            <thead>
              <tr>
                <th>Job #</th>
                <th>Type</th>
                <th>Crew</th>
                <th>Sent</th>
                <th>Matched</th>
                <th>Ratings</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <Cell label="Job #" nowrap>
                    <span className="mono">{r.job_raw}</span>
                  </Cell>
                  <Cell label="Type" className="muted">
                    {r.report_type ?? "—"}
                  </Cell>
                  <Cell label="Crew">{r.crew_raw ?? "—"}</Cell>
                  <Cell label="Sent" className="muted">
                    {formatEastern(r.sent_at)}
                  </Cell>
                  <Cell label="Matched">
                    {whByJob.has(r.job_norm) ? (
                      <span className="badge badge-confirmed">Matched</span>
                    ) : (
                      <span className="badge badge-plain">Not yet</span>
                    )}
                  </Cell>
                  <Cell label="Ratings" className="mono">
                    {r.rating_client
                      ? `${r.rating_client}/${r.rating_crowd ?? "—"}/${r.rating_staff ?? "—"}`
                      : "—"}
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
