import { db } from "@/lib/db";
import { aliasMap, reportsOfKind, resolveCanonical, splitCrew } from "@/lib/reports";
import { addAlias, removeAlias } from "../actions";

type AliasRow = { alias: string; canonical: string };

export default async function AliasesPage() {
  const aliases = db()
    .prepare("SELECT alias, canonical FROM crew_aliases ORDER BY canonical COLLATE NOCASE, alias")
    .all() as AliasRow[];

  // How each spelling actually appears on the forms, so it's obvious what needs merging.
  const map = aliasMap();
  const spellings = new Map<string, number>();
  const canonicals = new Set<string>();

  for (const report of reportsOfKind("dj")) {
    for (const raw of splitCrew(report.crew_raw)) {
      spellings.set(raw, (spellings.get(raw) ?? 0) + 1);
      canonicals.add(resolveCanonical(raw, map));
    }
  }
  for (const row of aliases) canonicals.add(row.canonical);

  const sortedSpellings = [...spellings.entries()].sort((a, b) => b[1] - a[1]);
  const sortedCanonicals = [...canonicals].sort((a, b) => a.localeCompare(b));

  return (
    <div className="grid cols-2">
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-head">
          <div>
            <h2>Aliases</h2>
            <div className="faint small">
              Names already group case-insensitively, so these are only for the harder merges —
              nicknames, misspellings, a surname on its own.
            </div>
          </div>
        </div>

        <div className="card-body">
          <form action={addAlias}>
            <div className="form-grid" style={{ gap: "0 0.6rem" }}>
              <div className="field">
                <label htmlFor="alias">Name as typed</label>
                <input id="alias" name="alias" type="text" placeholder="e.g. asson" required />
              </div>
              <div className="field">
                <label htmlFor="canonical">Counts as</label>
                <input
                  id="canonical"
                  name="canonical"
                  type="text"
                  list="known-crew"
                  placeholder="e.g. Addison"
                  required
                />
                <datalist id="known-crew">
                  {sortedCanonicals.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" type="submit">
              Add alias
            </button>
          </form>

          <div style={{ marginTop: "1.25rem" }}>
            {aliases.length === 0 ? (
              <div className="faint small">No aliases yet.</div>
            ) : (
              aliases.map((row) => (
                <div className="row-between" key={row.alias} style={{ padding: "0.4rem 0" }}>
                  <span className="mono">
                    {row.alias} <span className="faint">→</span> {row.canonical}
                  </span>
                  <form action={removeAlias} className="inline-form">
                    <input type="hidden" name="alias" value={row.alias} />
                    <button className="btn btn-icon btn-danger" type="submit" aria-label="Remove alias">
                      ✕
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-head">
          <div>
            <h2>Spellings seen</h2>
            <div className="faint small">Every name as crew have actually typed it, most used first.</div>
          </div>
        </div>
        <div className="card-body">
          {sortedSpellings.length === 0 ? (
            <div className="faint small">No crew names imported yet.</div>
          ) : (
            <div className="chiplist">
              {sortedSpellings.map(([name, count]) => (
                <span className="chip" key={name}>
                  {name} <span className="faint">×{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
