import Link from "next/link";
// From dispatch-types, not dispatch: this renders inside a Client Component,
// and dispatch.ts reaches the database — importing it here would drag
// better-sqlite3 into the browser bundle and fail the build.
import { CLASS_SHORT, STATUS_SHORT, type Call } from "@/lib/dispatch-types";
import { formatDateShort, formatTime } from "@/lib/dates";
import Icon from "@/components/Icon";

/** Whatever the office wrote on any leg of the call, joined once. */
function runNotes(call: Call): string | null {
  const all = [...new Set(call.legs.map((leg) => leg.notes).filter(Boolean))];
  return all.length > 0 ? all.join(" · ") : null;
}

/**
 * One call, drawn the same on both boards.
 *
 * The crew board and the office board show the same thing to different people,
 * so they show it the same way: the time it starts, what it is, who is on it,
 * and a line for every vehicle going out. What differs is the colour, which
 * comes from whichever board the card lands on rather than from here — see the
 * `--call-*` properties in globals.css.
 *
 * `compact` is for the days after today. A crew plans against those rather
 * than works from them, and ten days of full cards is a page nobody scrolls to
 * the end of.
 *
 * `onDay` is the day being looked at, so a card can say a run goes back later
 * than that. Passed rather than read: a card that computed its own idea of
 * today would say "back Sep 3" about a Sep 3 run on the Tomorrow tab, and
 * would disagree with the page around it at midnight.
 */
export default function CallCard({
  call,
  compact = false,
  onDay,
  linkEvents = false,
}: {
  call: Call;
  compact?: boolean;
  onDay?: string;
  linkEvents?: boolean;
}) {
  const note = call.legs.find((leg) => leg.keys)?.keys ?? null;

  return (
    <article className={`call-card run-${call.status}${compact ? " call-card-compact" : ""}`}>
      <div className="call-top">
        <span className="call-time">
          {call.startsAt ? formatTime(call.startsAt) : "All day"}
        </span>
        <span className="call-tag">{STATUS_SHORT[call.status]}</span>
      </div>

      <h3 className="call-title">{call.label}</h3>

      {/* The keys, one warning each and one colour each. They are separate
          errands — collect from the shop, drop at the shop, drop at Pencar —
          and a crew can be given any combination of the three, so folding them
          into one sentence made somebody parse a sentence at six in the
          morning. The colours are what tells them apart at a glance. */}
      {(call.keysAtShop || call.keysBackToShop || call.keysBackToPencar) && (
        <div className="call-keys">
          {call.keysAtShop && (
            <p className="call-keys-alert keys-at-shop">
              <Icon name="key" size={13} />
              Keys are at the shop — collect them first
            </p>
          )}
          {call.keysBackToShop && (
            <p className="call-keys-alert keys-back-shop">
              <Icon name="alert" size={13} />
              Take the keys back to the shop
            </p>
          )}
          {call.keysBackToPencar && (
            <p className="call-keys-alert keys-back-pencar">
              <Icon name="alert" size={13} />
              Take the keys back to Pencar
            </p>
          )}
        </div>
      )}

      <p className="call-meta">
        {call.crew && <span className="call-crew">{call.crew}</span>}
        {call.meet && (
          <span className="call-meet">
            <Icon name="clock" size={12} />
            Meet {formatTime(call.meet)}
          </span>
        )}
        {call.site && (
          <span className="call-where">
            <Icon name="pin" size={12} />
            {call.site}
          </span>
        )}
        {call.meetingOnSite && (
          <span className="call-where">
            <Icon name="person" size={12} />
            Meeting {call.meetingOnSite}
          </span>
        )}
      </p>

      {compact ? (
        <p className="call-line">
          <Icon name="truck" size={14} />
          {call.legs.map((leg) => leg.vehicleName).join(" · ")}
          {note && <span className="call-note">{note}</span>}
        </p>
      ) : (
        <ol className="call-legs">
          {call.legs.map((leg) => (
            <li key={leg.runId}>
              <span className="call-leg-role">{CLASS_SHORT[leg.vehicleClass]}</span>
              <span>
                <span className="call-leg-name">
                  <Icon name="truck" size={14} />
                  {/* Only the office board links out; the crew board has
                      nowhere to send anybody and no session to do it with. */}
                  {linkEvents && leg.eventId ? (
                    <Link href={`/events/${leg.eventId}`}>{leg.vehicleName}</Link>
                  ) : (
                    leg.vehicleName
                  )}
                </span>
                {leg.plate && <span className="call-leg-plate">{leg.plate}</span>}
                {onDay && leg.endsOn > onDay && (
                  <span className="call-leg-back">back {formatDateShort(leg.endsOn)}</span>
                )}
                {/* Where it is collected and returned, and when — the three
                    things somebody has to leave the building knowing. */}
                {(leg.pickupFrom || leg.dropoffTo || leg.pickupTime) && (
                  <span className="call-leg-run">
                    {leg.pickupTime && <span>{formatTime(leg.pickupTime)}</span>}
                    {leg.pickupFrom && <span>from {leg.pickupFrom}</span>}
                    {leg.dropoffTo && <span>back to {leg.dropoffTo}</span>}
                  </span>
                )}
                {leg.driver && (
                  <span className="call-leg-driver">
                    <Icon name="person" size={12} />
                    {leg.driver}
                  </span>
                )}
                {leg.homeBase && <span className="call-leg-home">Kept at {leg.homeBase}</span>}
                {leg.keys && (
                  <span className="call-leg-keys">
                    <Icon name="key" size={12} />
                    {leg.keys}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!compact && runNotes(call) && <p className="call-notes">{runNotes(call)}</p>}
    </article>
  );
}
