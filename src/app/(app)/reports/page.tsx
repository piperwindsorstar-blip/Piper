import Link from "next/link";
import { computeGroups, eventIdsByJobNorm } from "@/lib/reports";
import { formatEastern } from "@/lib/dates";
import Cell from "@/components/Cell";
import ManifestControl from "./ManifestControl";

export default async function MatchedPage() {
  const { matchedPairs } = computeGroups();
  const eventIds = eventIdsByJobNorm();

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Matched</h2>
          <div className="faint small">
            A job number that appears in both a show report and a warehouse return. Numbers are
            matched on a normalised form, so 260647, 26-0647 and 26647 all count as the same job.
          </div>
        </div>
      </div>

      {matchedPairs.length === 0 ? (
        <div className="empty">Nothing matched yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="stacking">
            <thead>
              <tr>
                <th>Job #</th>
                <th>Crew</th>
                <th>Show report</th>
                <th>Return report</th>
                <th>Manifest</th>
                <th>Quality</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {matchedPairs.map(({ dj, wh }) => {
                const eventId = eventIds.get(dj.job_norm);
                const notes = [dj.notes, wh.notes].filter(Boolean).join(" — ");
                return (
                  <tr key={`${dj.id}-${wh.id}`}>
                    <Cell label="Job #" nowrap>
                      <span className="mono">{dj.job_raw}</span>
                      {eventId && (
                        <div className="faint small">
                          <Link href={`/events/${eventId}`}>open wedding →</Link>
                        </div>
                      )}
                    </Cell>
                    <Cell label="Crew">{dj.crew_raw ?? "—"}</Cell>
                    <Cell label="Show report" className="muted">
                      {formatEastern(dj.sent_at)}
                    </Cell>
                    <Cell label="Return report" className="muted">
                      {formatEastern(wh.sent_at)}
                    </Cell>
                    <Cell label="Manifest">
                      <ManifestControl report={wh} />
                    </Cell>
                    <Cell label="Quality">{wh.quality ?? "—"}</Cell>
                    <Cell label="Notes" className="muted small">
                      {notes || "—"}
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
