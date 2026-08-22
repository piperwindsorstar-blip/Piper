import { formatDateLong } from "@/lib/dates";
import { answerOwnRequest } from "@/app/(app)/events/[id]/availability-actions";

type Ask = {
  id: number;
  event_date: string;
  partner_one_name: string;
  partner_two_name: string | null;
  venue_name: string | null;
};

/**
 * Dates a DJ has been asked about but not answered, on their own dashboard.
 *
 * The emailed link is the main route — most DJs will answer from their phone
 * without ever signing in — but a question sitting unanswered should also be
 * impossible to miss the next time they open Piper.
 */
export default function AvailabilityAsks({ asks }: { asks: Ask[] }) {
  if (asks.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Can you work these?</h2>
        <span className="small muted">
          {asks.length} waiting on you
        </span>
      </div>
      <ul className="ask-list">
        {asks.map((ask) => {
          const couple = ask.partner_two_name
            ? `${ask.partner_one_name} & ${ask.partner_two_name}`
            : ask.partner_one_name;
          return (
            <li key={ask.id}>
              <div>
                <strong>{formatDateLong(ask.event_date)}</strong>
                <div className="small muted">
                  {couple}
                  {ask.venue_name ? ` · ${ask.venue_name}` : ""}
                </div>
              </div>
              <div className="btn-row">
                <form action={answerOwnRequest}>
                  <input type="hidden" name="request_id" value={ask.id} />
                  <input type="hidden" name="answer" value="available" />
                  <button className="btn btn-sm btn-primary" type="submit">
                    I can do it
                  </button>
                </form>
                <form action={answerOwnRequest}>
                  <input type="hidden" name="request_id" value={ask.id} />
                  <input type="hidden" name="answer" value="unavailable" />
                  <button className="btn btn-sm" type="submit">
                    Can&rsquo;t make it
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
