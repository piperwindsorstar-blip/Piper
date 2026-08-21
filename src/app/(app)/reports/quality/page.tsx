import { computeMonthlyQuality } from "@/lib/reports";
import Cell from "@/components/Cell";

function monthLabel(key: string): string {
  if (key === "unknown") return "Unknown";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default async function QualityPage() {
  const months = computeMonthlyQuality();

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Warehouse quality</h2>
          <div className="faint small">
            Return quality by month, with the spread across the 1–5 scale and how often a manifest
            came back signed.
          </div>
        </div>
      </div>

      {months.length === 0 ? (
        <div className="empty">No warehouse reports imported yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="stacking">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Returns</th>
                <th className="num">Avg</th>
                <th>Spread</th>
                <th className="num">Signed</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key}>
                  <Cell label="Month" nowrap>
                    <strong>{monthLabel(m.key)}</strong>
                  </Cell>
                  <Cell label="Returns" className="num mono">
                    {m.count}
                  </Cell>
                  <Cell label="Avg" className="num mono">
                    {m.avg.toFixed(2)}
                  </Cell>
                  <Cell label="Spread">
                    <div className="barwrap">
                      <div className="bar">
                        {[5, 4, 3, 2, 1].map((tier) =>
                          m.tiers[tier] ? (
                            <span
                              key={tier}
                              className={`seg-q${tier}`}
                              style={{ width: `${(m.tiers[tier] / m.count) * 100}%` }}
                            />
                          ) : null,
                        )}
                      </div>
                    </div>
                    <div className="faint small">
                      {[5, 4, 3, 2, 1]
                        .filter((tier) => m.tiers[tier])
                        .map((tier) => `${tier}★ ×${m.tiers[tier]}`)
                        .join(" · ")}
                    </div>
                  </Cell>
                  <Cell label="Signed" className="num mono">
                    {m.signed}/{m.signed + m.notSigned + m.notAsked}
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
