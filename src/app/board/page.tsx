import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CLASS_SHORT,
  publicBoardRows,
  publicDays,
  STATUS_SHORT,
} from "@/lib/dispatch";
import { publicBoard, PUBLIC_DAYS } from "@/lib/settings";
import { formatDateShort, todayIso } from "@/lib/dates";

/**
 * The crew board, open to anyone with the address.
 *
 * The only page in Piper that renders without an account, so three things hold
 * regardless of what is convenient.
 *
 * The window is fixed at today plus nine days and takes no parameter. There is
 * no next, no back, and no date in the URL — a board that could be walked
 * forwards is the whole schedule published one click at a time.
 *
 * The fields come from `publicRuns`, which names every column it selects. This
 * page renders what it is handed, so what it is handed has to be decided
 * somewhere that a new database column cannot quietly join.
 *
 * And it is off until an admin turns it on. A 404 rather than a "switched off"
 * notice: a page that announces itself is still an admission that the address
 * is real.
 */
export const metadata: Metadata = {
  title: "PYNX Dispatch — crew board",
  // Public by link is not the same as public in a search engine. A crew finds
  // this because somebody sent it to them.
  robots: { index: false, follow: false, nocache: true },
};

// Always fresh: a board cached for an hour is a board that tells a crew the
// wrong thing at seven in the morning.
export const dynamic = "force-dynamic";

export default async function CrewBoardPage() {
  const settings = publicBoard();
  if (!settings.on) notFound();

  const today = todayIso();
  const days = publicDays(today, PUBLIC_DAYS);
  const rows = publicBoardRows(days);

  const anything = rows.some((r) => days.some((d) => (r.byDay.get(d)?.length ?? 0) > 0));

  return (
    <main className="board-public">
      <header className="board-public-head">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <div className="brand-name">PYNX Dispatch</div>
            <div className="small muted">The next {PUBLIC_DAYS} days</div>
          </div>
        </div>
      </header>

      {settings.note.trim() && <div className="login-banner login-banner-info">{settings.note}</div>}

      {rows.length === 0 || !anything ? (
        <div className="card">
          <div className="empty">Nothing booked out in the next {PUBLIC_DAYS} days.</div>
        </div>
      ) : (
        <div className="board-days">
          {days.map((day) => {
            const onDay = rows
              .map((r) => ({ vehicle: r.vehicle, runs: r.byDay.get(day) ?? [] }))
              .filter((r) => r.runs.length > 0);

            // A quiet day is one line. Five identical cards saying "nothing
            // out" is a lot of thumb between a crew and the day that matters.
            if (onDay.length === 0) {
              return (
                <section key={day} className="board-day-quiet">
                  <span>{day === today ? "Today" : formatDateShort(day)}</span>
                  <span className="faint">Nothing out</span>
                </section>
              );
            }

            return (
              <section key={day} className={`card board-day${day === today ? " board-day-today" : ""}`}>
                <div className="card-head">
                  <h2>{day === today ? "Today" : formatDateShort(day)}</h2>
                  {day === today && <span className="badge badge-accent">{formatDateShort(day)}</span>}
                </div>

                {onDay.length === 0 ? (
                  <div className="empty">Nothing out. Shop day.</div>
                ) : (
                  <ul className="stack-list card-body">
                    {onDay.map(({ vehicle, runs }) =>
                      runs.map((run) => (
                        <li key={`${vehicle.id}-${run.id}`} className={`board-job run-${run.status}`}>
                          <div className="board-job-head">
                            <strong>{vehicle.name}</strong>
                            <span className="small faint">{CLASS_SHORT[vehicle.class]}</span>
                            <span className="badge badge-plain">{STATUS_SHORT[run.status]}</span>
                          </div>
                          <div className="board-job-label">{run.label}</div>
                          <div className="small muted">
                            {[
                              run.meet_time ? `Meet ${run.meet_time}` : null,
                              run.site,
                              run.crew ?? run.driver_first_name,
                              run.keys_with ? `Keys: ${run.keys_with}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </li>
                      )),
                    )}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <footer className="board-public-foot small muted">
        Shows the next {PUBLIC_DAYS} days only. Ask the office for anything further out.
      </footer>
    </main>
  );
}
