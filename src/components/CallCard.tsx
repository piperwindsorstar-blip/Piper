import Link from "next/link";
import { CLASS_SHORT, STATUS_SHORT, type Call } from "@/lib/dispatch";
import { formatDateShort, formatTime } from "@/lib/dates";
import Icon from "@/components/Icon";

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
 * `today` is passed rather than read so a card can say a run goes back later in
 * the week; a card that computed its own idea of today would disagree with the
 * page around it at midnight.
 */
export default function CallCard({
  call,
  compact = false,
  today,
  linkEvents = false,
}: {
  call: Call;
  compact?: boolean;
  today?: string;
  linkEvents?: boolean;
}) {
  const note = call.legs.find((leg) => leg.keys)?.keys ?? null;

  return (
    <article className={`call-card run-${call.status}${compact ? " call-card-compact" : ""}`}>
      <div className="call-top">
        <span className="call-time">{call.meet ? formatTime(call.meet) : "All day"}</span>
        <span className="call-tag">{STATUS_SHORT[call.status]}</span>
      </div>

      <h3 className="call-title">{call.label}</h3>

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
                {today && leg.endsOn !== today && (
                  <span className="call-leg-back">back {formatDateShort(leg.endsOn)}</span>
                )}
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
    </article>
  );
}
