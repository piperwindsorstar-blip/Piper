import { notFound } from "next/navigation";
import { byToken } from "@/lib/availability";
import { formatDateLong } from "@/lib/dates";
import AnswerForm from "./AnswerForm";

/**
 * Where a DJ answers "can you work this?" without logging in.
 *
 * No account needed by design — a DJ checking their phone on the way home from
 * another gig should be able to answer in one tap. The token in the URL is the
 * whole authorisation, and it grants exactly one thing: answering this one
 * question about this one date. It exposes no other booking and no client
 * contact details.
 */
export default async function AvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ answer?: string }>;
}) {
  const { token } = await params;
  const { answer } = await searchParams;

  const request = byToken(token);
  if (!request) notFound();

  const couple = request.partner_two_name
    ? `${request.partner_one_name} & ${request.partner_two_name}`
    : request.partner_one_name;

  const answered = request.status !== "asked";

  return (
    <main className="plan-shell">
      <div className="plan-head">
        <h1>{formatDateLong(request.event_date)}</h1>
        <p className="muted">
          {request.venue_name ?? "Venue to be confirmed"}
          {request.venue_city ? `, ${request.venue_city}` : ""} · {couple}
        </p>
      </div>

      <div className="card">
        <div className="card-body">
          {answered ? (
            <>
              <h2 style={{ marginTop: 0 }}>
                {request.status === "available"
                  ? "You said you can do it"
                  : "You said you can't make it"}
              </h2>
              <p className="muted">
                Thanks {request.dj_name.split(" ")[0]} — that&rsquo;s been passed on. You can
                close this page.
              </p>
              {request.note && (
                <p className="small muted">
                  You added: &ldquo;{request.note}&rdquo;
                </p>
              )}
              <p className="small muted">
                Changed your mind? Use the buttons below and it will update.
              </p>
              <AnswerForm token={token} preset={undefined} again />
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0 }}>
                Hi {request.dj_name.split(" ")[0]} — can you work this one?
              </h2>
              <p className="muted">
                One tap is all it takes. Add a note if there&rsquo;s anything worth knowing.
              </p>
              <AnswerForm
                token={token}
                preset={answer === "yes" ? "available" : answer === "no" ? "unavailable" : undefined}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
