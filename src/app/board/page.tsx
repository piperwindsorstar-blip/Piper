import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CLASS_SHORT,
  COMMITTED,
  groupCalls,
  OWNERSHIP_LABELS,
  publicBoardRows,
  publicDays,
  type Call,
  type PublicRun,
  type PublicVehicle,
} from "@/lib/dispatch";
import { publicBoard, publicShopDetails, PUBLIC_DAYS } from "@/lib/settings";
import {
  formatDayHeading,
  formatDayRange,
  formatDayTitle,
  formatWeekdayShort,
  todayIso,
} from "@/lib/dates";
import CallCard from "@/components/CallCard";
import Icon from "@/components/Icon";
import InstallHint from "@/components/InstallHint";

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
 *
 * The shape is the one the shop already reads on PYNX Dispatch: today at the
 * top in the largest type on the page, the rest of the window under it in
 * order, and the things that never change — codes, phones, where the fleet is
 * — parked in a column down the side where they can be found without scrolling
 * past the day.
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

/**
 * The day's runs, gathered into calls.
 *
 * The mapping happens here rather than in `groupCalls` so this page keeps
 * deciding which of a run's fields it is willing to publish. A shared helper
 * that read straight off the database row would quietly publish the next
 * column somebody adds to it.
 */
function callsOn(
  day: string,
  rows: { vehicle: PublicVehicle; byDay: Map<string, PublicRun[]> }[],
): Call[] {
  return groupCalls(
    rows.flatMap(({ vehicle, byDay }) =>
      (byDay.get(day) ?? []).map((run) => ({
        runId: run.id,
        label: run.label,
        status: run.status,
        meet: run.meet_time,
        site: run.site,
        crew: run.crew,
        keys: run.keys_with,
        endsOn: run.ends_on,
        // The crew board links nowhere: it has no session to link with.
        eventId: null,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        vehicleClass: vehicle.class,
        pickupFrom: run.pickup_from,
        dropoffTo: run.dropoff_to,
        pickupTime: run.pickup_time,
        keysAtShop: run.keys_at_shop === 1,
        keysBackToShop: run.keys_back_to_shop === 1,
        driver: run.driver_first_name,
        meetingOnSite: run.meeting_on_site,
      })),
    ),
  );
}

/** Distinct vehicles actually committed on a day — 'needed' is a gap, not cover. */
function outOn(day: string, rows: { vehicle: PublicVehicle; byDay: Map<string, PublicRun[]> }[]) {
  const ids = new Set<number>();
  for (const { vehicle, byDay } of rows) {
    if ((byDay.get(day) ?? []).some((r) => COMMITTED.includes(r.status))) ids.add(vehicle.id);
  }
  return ids;
}

export default async function CrewBoardPage() {
  const settings = publicBoard();
  if (!settings.on) notFound();

  const today = todayIso();
  const days = publicDays(today, PUBLIC_DAYS);
  const rows = publicBoardRows(days);

  const byDay = days.map((day) => ({ day, calls: callsOn(day, rows) }));
  const anything = byDay.some((d) => d.calls.length > 0);

  const outToday = outOn(today, rows);
  const outWindow = new Set(days.flatMap((day) => [...outOn(day, rows)]));
  const stillNeeded = days.reduce(
    (n, day) =>
      n +
      rows.reduce(
        (m, r) => m + (r.byDay.get(day) ?? []).filter((run) => run.status === "needed").length,
        0,
      ),
    0,
  );
  // The flag, not the free-text note it used to read. Matching the word
  // "shop" in a note flagged "not at the shop" the same way, and the note is
  // no longer something the form writes.
  const keysFirst = (byDay[0]?.calls ?? []).some((call) => call.keysAtShop);

  // Already stripped of the codes unless they were deliberately published —
  // decided in publicShopDetails rather than here, so the markup never has to
  // be trusted with that.
  const shop = publicShopDetails();
  const codes = shop
    ? ([
        ["Lock box", shop.lockBox],
        ["Gate", shop.gate],
      ] as const).filter(([, v]) => v.trim())
    : [];
  const phones = shop
    ? ([
        ["PYNX phone", shop.phone],
        ["Emergency", shop.emergency],
      ] as const).filter(([, v]) => v.trim())
    : [];
  const notes = settings.note
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <main className="crew-board">
      <header className="crew-bar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <div className="brand-name">PYNX Dispatch</div>
            <div className="board-eyebrow">Crew board</div>
          </div>
        </div>
        <span className="board-range">{formatDayRange(days[0], days[days.length - 1])}</span>
      </header>

      <InstallHint />

      <div className="crew-grid">
        <div className="crew-main">
          {notes.length > 0 && (
            <section className="board-panel board-notes">
              <Icon name="megaphone" size={20} className="board-glow" />
              <div>
                <p className="board-eyebrow">From the office</p>
                <h2 className="board-panel-title">Shop notes</h2>
                <ul className="board-note-list">
                  {notes.map((note, i) => (
                    <li key={`${i}-${note}`}>
                      <span className="board-dot" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <header className="crew-head">
            <p className="board-eyebrow">View only · next {PUBLIC_DAYS} days</p>
            <h1 className="crew-date">{formatDayTitle(today)}</h1>
            <div className="board-stats">
              <Stat label="Vehicles out today" value={String(outToday.size)} />
              <Stat label={`Out over ${PUBLIC_DAYS} days`} value={String(outWindow.size)} />
              {stillNeeded > 0 && <Stat label="Still needed" value={String(stillNeeded)} flag />}
              {keysFirst && <Stat label="Keys at shop first" value="Yes" flag />}
            </div>
          </header>

          {!anything ? (
            <div className="board-panel board-empty">
              Nothing booked out in the next {PUBLIC_DAYS} days.
            </div>
          ) : (
            byDay.map(({ day, calls }, index) => (
              <section key={day} className="board-day-block">
                <h2 className="board-eyebrow board-day-name">
                  {index === 0
                    ? "Today"
                    : index === 1
                      ? `Tomorrow · ${formatWeekdayShort(day)}`
                      : formatDayHeading(day)}
                </h2>

                {calls.length === 0 ? (
                  <p className="board-panel board-empty">
                    {index === 0 ? "No vehicles out. Shop day." : "No calls."}
                  </p>
                ) : (
                  calls.map((call) => (
                    <CallCard key={`${day}-${call.key}`} call={call} compact={index !== 0} />
                  ))
                )}
              </section>
            ))
          )}
        </div>

        <aside className="crew-side">
          {shop && (
            <section className="board-panel">
              <p className="board-eyebrow">Standing rules</p>
              {shop.rules.trim() ? (
                <p className="board-rules">{shop.rules}</p>
              ) : (
                <p className="board-rules faint">Nothing standing this week.</p>
              )}

              {codes.length > 0 && (
                <dl className="board-codes">
                  {codes.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd className="board-code">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {(shop.location.trim() || shop.city.trim()) && (
                <div className="board-field">
                  <div className="board-field-label">Shop</div>
                  <div>
                    {shop.location}
                    {shop.city.trim() && <span className="board-field-sub">{shop.city}</span>}
                  </div>
                </div>
              )}

              {shop.yard.trim() && (
                <div className="board-field">
                  <div className="board-field-label">Yard</div>
                  <div>{shop.yard}</div>
                </div>
              )}

              {phones.map(([label, value]) => (
                <div key={label} className="board-field">
                  <div className="board-field-label">{label}</div>
                  <div className="board-phone">
                    <Icon name="phone" size={14} className="board-glow" />
                    {/* Read on a phone, standing next to a van, in a hurry. */}
                    <a href={`tel:${value.replace(/[^+\d]/g, "")}`}>{value}</a>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="board-panel">
            <p className="board-eyebrow">Fleet snapshot</p>
            <ul className="board-fleet">
              {rows.map(({ vehicle }) => (
                <li key={vehicle.id}>
                  <div>
                    <div className="board-fleet-name">{vehicle.name}</div>
                    <div className="board-fleet-sub">
                      {CLASS_SHORT[vehicle.class]} · {OWNERSHIP_LABELS[vehicle.ownership]}
                    </div>
                  </div>
                  <span className={outToday.has(vehicle.id) ? "board-out" : "board-yard"}>
                    {outToday.has(vehicle.id) ? "Out" : "Yard"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <footer className="crew-foot">
        Shows the next {PUBLIC_DAYS} days only. Ask the office for anything further out.
      </footer>
    </main>
  );
}

function Stat({ label, value, flag = false }: { label: string; value: string; flag?: boolean }) {
  return (
    <div className={flag ? "board-stat board-stat-flag" : "board-stat"}>
      <div className="board-stat-label">{label}</div>
      <div className="board-stat-value">{value}</div>
    </div>
  );
}
