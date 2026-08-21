import { computeCrewStats } from "@/lib/reports";
import Cell from "@/components/Cell";

/** Stacked bar of manifest outcomes, so a crew member's record reads at a glance. */
function ManifestBar({
  signed,
  notSigned,
  notAsked,
  noReport,
}: {
  signed: number;
  notSigned: number;
  notAsked: number;
  noReport: number;
}) {
  const total = signed + notSigned + notAsked + noReport;
  if (total === 0) return <span className="faint">—</span>;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="barwrap">
      <div className="bar">
        <span className="seg-signed" style={{ width: pct(signed) }} />
        <span className="seg-notsigned" style={{ width: pct(notSigned) }} />
        <span className="seg-notasked" style={{ width: pct(notAsked) }} />
        <span className="seg-noreport" style={{ width: pct(noReport) }} />
      </div>
    </div>
  );
}

export default async function CrewStatsPage() {
  const stats = computeCrewStats();

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Crew stats</h2>
          <div className="faint small">
            Names are grouped case-insensitively, plus any aliases you&rsquo;ve set. Completion is
            measured only against manifests the form actually asked about.
          </div>
        </div>
      </div>

      <div className="card-body tight">
        <div className="legend">
          <span className="lg">
            <span className="dot signed" /> Signed
          </span>
          <span className="lg">
            <span className="dot notsigned" /> Not signed
          </span>
          <span className="lg">
            <span className="dot notasked" /> Not asked
          </span>
          <span className="lg">
            <span className="dot noreport" /> No return yet
          </span>
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="empty">No crew stats yet — import some show reports first.</div>
      ) : (
        <div className="table-wrap">
          <table className="stacking">
            <thead>
              <tr>
                <th>Crew</th>
                <th className="num">Shows</th>
                <th>Manifest outcomes</th>
                <th className="num">Completion</th>
                <th className="num">Avg quality</th>
                <th>Job #s</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.display.toLowerCase()}>
                  <Cell label="Crew">
                    <strong>{s.display}</strong>
                  </Cell>
                  <Cell label="Shows" className="num mono">
                    {s.shows}
                  </Cell>
                  <Cell label="Manifest outcomes">
                    <ManifestBar
                      signed={s.signed}
                      notSigned={s.notSigned}
                      notAsked={s.notAsked}
                      noReport={s.noReport}
                    />
                    <div className="faint small">
                      {s.signed} signed · {s.notSigned} not · {s.notAsked} not asked ·{" "}
                      {s.noReport} no return
                    </div>
                  </Cell>
                  <Cell label="Completion" className="num mono">
                    {s.manifestPct === null ? "—" : `${s.manifestPct.toFixed(0)}%`}
                  </Cell>
                  <Cell label="Avg quality" className="num mono">
                    {s.avgQuality === null ? "—" : s.avgQuality.toFixed(1)}
                  </Cell>
                  <Cell label="Job #s" className="faint small mono">
                    {s.jobs.join(", ")}
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
