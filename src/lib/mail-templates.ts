import { formatDateLong, formatTime } from "./dates";
import type { EventWithRefs } from "./types";

/**
 * What Piper writes.
 *
 * These are drafts, not final copy — every one lands in the outbox where it can
 * be edited before sending. So they aim to be a good starting point in Martin's
 * voice rather than something nobody would ever want to change.
 *
 * Deliberately plain text. Couples read these on a phone between other things,
 * and a designed HTML email from a wedding supplier reads like marketing.
 */

const SIGN_OFF = "Martin\nPynx Productions";

function couple(event: EventWithRefs): string {
  return event.partner_two_name
    ? `${event.partner_one_name} and ${event.partner_two_name}`
    : event.partner_one_name;
}

function firstNames(event: EventWithRefs): string {
  const first = (full: string) => full.trim().split(/\s+/)[0];
  return event.partner_two_name
    ? `${first(event.partner_one_name)} and ${first(event.partner_two_name)}`
    : first(event.partner_one_name);
}

function atVenue(event: EventWithRefs): string {
  return event.venue_name ? ` at ${event.venue_name}` : "";
}

/* --------------------------------------------------- planner invitation */

export function plannerInvite(event: EventWithRefs, link: string) {
  return {
    subject: `Your wedding music planner — ${formatDateLong(event.event_date)}`,
    body: `Hi ${firstNames(event)},

Thanks again for booking us for ${formatDateLong(event.event_date)}${atVenue(event)}.

When you're ready, here's your music and timeline planner:

${link}

It's your own private link — no password, nothing to sign up for. It saves as
you go, so you can fill in a bit at a time and come back whenever you like.

It walks through the day in order: the ceremony, cocktail hour, entrances,
first dance, the parent dances, and what gets the floor going later on. Under
most sections you'll see suggestions from what other couples have chosen —
handy if you're staring at a blank box, and easy to ignore if you already know
exactly what you want.

There's no rush. Anything you haven't decided yet, leave blank and we'll talk
it through closer to the day. If there's a song that matters and you're not
sure where it fits, put it in the must-play box and we'll find the moment.

Any questions at all, just reply to this email.

${SIGN_OFF}`,
  };
}

/* ------------------------------------------------------ DJ introduction */

export function djIntroduction(event: EventWithRefs, djName: string) {
  return {
    subject: `Meet ${djName}, your DJ for ${formatDateLong(event.event_date)}`,
    body: `Hi ${firstNames(event)},

Good news — ${djName} will be your DJ for ${formatDateLong(event.event_date)}${atVenue(event)}.
I've put them on this email so you have each other directly.

${djName} has your planner and will go through everything you've filled in.
Closer to the day they'll be in touch to confirm the running order and talk
through anything that needs a decision — entrances, cue points, how you want
the evening to build.

From here, anything about the music or the timeline can go straight to
${djName}. Anything about the booking itself, come to me.

Looking forward to it.

${SIGN_OFF}`,
  };
}

/* --------------------------------------------------- availability request */

export function availabilityRequest(
  event: EventWithRefs,
  djName: string,
  yesLink: string,
  noLink: string,
) {
  const times = [
    event.load_in_time ? `Load-in ${formatTime(event.load_in_time)}` : null,
    event.ceremony_time ? `Ceremony ${formatTime(event.ceremony_time)}` : null,
    event.reception_time ? `Reception ${formatTime(event.reception_time)}` : null,
    event.end_time ? `Finish ${formatTime(event.end_time)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Are you free on ${formatDateLong(event.event_date)}?`,
    body: `Hi ${djName.trim().split(/\s+/)[0]},

Can you work this one?

${formatDateLong(event.event_date)}
${event.venue_name ?? "Venue to be confirmed"}${event.venue_city ? `, ${event.venue_city}` : ""}
${couple(event)}
${event.guest_count ? `${event.guest_count} guests` : ""}
${event.package_name ?? ""}
${times}

Yes, I can do it:
${yesLink}

Sorry, I can't:
${noLink}

Either link answers it — no need to log in or reply. If you're not sure yet,
just leave it and let me know when you know.

${SIGN_OFF}`,
  };
}

/* ------------------------------------------------------- password reset */

/**
 * Unlike the others this one is never edited before sending — it goes straight
 * out, so it has to read correctly as written. It is addressed to staff rather
 * than to a couple, and it says how long the link lasts because a person who
 * finds it the next morning needs to know why it no longer works.
 */
export function passwordReset(name: string, link: string, hours: number) {
  const first = name.trim().split(/\s+/)[0];
  return {
    subject: "Reset your Piper password",
    body: `Hi ${first},

Someone asked to reset the password on your Piper account. Open this link and
choose a new one:

${link}

The link works once and expires in ${hours} hours. Setting a new password signs
you out everywhere, so you'll need to sign back in on your phone as well.

If this wasn't you, you can ignore this — nothing has changed, and whoever
asked can't see this email.

${SIGN_OFF}`,
  };
}
