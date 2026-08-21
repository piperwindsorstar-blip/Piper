import { computeGroups, reportsOfKind } from "@/lib/reports";
import { formatEastern } from "@/lib/dates";
import Cell from "@/components/Cell";
import ManifestControl from "../ManifestControl";

export default async function WarehouseReportsPage() {
  const reports = reportsOfKind("warehouse");
  const { djByJob } = computeGroups();

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Warehouse returns</h2>
          <div className="faint small">
            Every return report received, matched or not. Quality runs 1 (poor) to 5 (excellent).
          </div>
        </div>
        <span className="badge badge-plain">{reports.length}</span>
      </div>

      {reports.length === 0 ? (
        <div className="empty">No warehouse reports imported yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="stacking">
            <thead>
              <tr>
                <th>Job #</th>
                <th>Sent</th>
                <th>Matched</th>
                <th>Quality</th>
                <th>Manifest</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <Cell label="Job #" nowrap>
                    <span className="mono">{r.job_raw}</span>
                  </Cell>
                  <Cell label="Sent" className="muted">
                    {formatEastern(r.sent_at)}
                  </Cell>
                  <Cell label="Matched">
                    {djByJob.has(r.job_norm) ? (
                      <span className="badge badge-confirmed">Matched</span>
                    ) : (
                      <span className="badge badge-plain">Not yet</span>
                    )}
                  </Cell>
                  <Cell label="Quality">{r.quality ?? "—"}</Cell>
                  <Cell label="Manifest">
                    <ManifestControl report={r} />
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
