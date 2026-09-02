import nodemailer from "nodemailer";
import { db, nowIso } from "./db";
import type { OutboxKind, OutboxRow, OutboxStatus } from "./mail-types";

/**
 * Outgoing mail.
 *
 * Piper writes emails but never sends them by itself. Everything lands in the
 * outbox and waits for an admin to approve it. That is deliberate: an event
 * created with a typo'd address, or a test booking, would otherwise reach a
 * real couple before anyone noticed — and an email cannot be recalled.
 *
 * Queueing works whether or not SMTP is configured, so the outbox is useful
 * from day one: you can see exactly what Piper would send before wiring up a
 * mail server. Only the send step needs credentials.
 */

// Shapes and labels live in mail-types so Client Components can use them
// without pulling nodemailer into the browser bundle.
export type { OutboxKind, OutboxStatus, OutboxRow } from "./mail-types";
export { KIND_LABELS } from "./mail-types";

import { storedMail } from "./settings";

/* ------------------------------------------------------------- transport */

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo: string | null;
};

/**
 * The environment first, then whatever an admin saved in the settings page.
 *
 * /etc/piper.env is the better home for a password: root-only, out of the
 * repository, out of every database backup. It stays authoritative. But a
 * mail server nobody can configure is a mail server that never sends
 * anything, and "ask Martin to ssh in" is not a workable answer to a locked-out
 * DJ on a Friday night — so the settings page is a real fallback rather than a
 * decoration, and the page says plainly which of the two is in force.
 */
export function mailConfig(): MailConfig | null {
  return envMail() ?? dbMail();
}

/** Where the settings are coming from, for the settings page to report. */
export function mailSource(): "environment" | "settings" | null {
  if (envMail()) return "environment";
  return dbMail() ? "settings" : null;
}

function envMail(): MailConfig | null {
  const host = process.env.PIPER_SMTP_HOST;
  const user = process.env.PIPER_SMTP_USER;
  const pass = process.env.PIPER_SMTP_PASS;
  const from = process.env.PIPER_MAIL_FROM;

  if (!host || !user || !pass || !from) return null;

  const port = Number(process.env.PIPER_SMTP_PORT ?? 587);
  return {
    host,
    port,
    // 465 is implicit TLS; 587 starts plain and upgrades with STARTTLS.
    secure: process.env.PIPER_SMTP_SECURE
      ? process.env.PIPER_SMTP_SECURE === "true"
      : port === 465,
    user,
    pass,
    from,
    replyTo: process.env.PIPER_MAIL_REPLY_TO || null,
  };
}

function dbMail(): MailConfig | null {
  const stored = storedMail();
  if (!stored || !stored.host || !stored.from) return null;

  return {
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    user: stored.user,
    pass: stored.pass,
    from: stored.from,
    replyTo: stored.replyTo || null,
  };
}

export function mailIsConfigured(): boolean {
  return mailConfig() !== null;
}

/** Escapes text for the HTML part. Bodies are plain text written by us, but
 *  they carry couple names and venue notes, which can contain anything. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A plain-text body rendered as simple, readable HTML. Links are linkified. */
function asHtml(body: string): string {
  const escaped = escapeHtml(body).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>',
  );
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1a22;white-space:pre-wrap">${escaped}</div>`;
}

/* ----------------------------------------------------------------- queue */

export type QueueInput = {
  eventId: number | null;
  kind: OutboxKind;
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
};

export function queueEmail(input: QueueInput): number {
  const result = db()
    .prepare(
      `INSERT INTO outbox (event_id, kind, to_addr, cc_addr, subject, body, status, queued_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)`,
    )
    .run(
      input.eventId,
      input.kind,
      input.to.trim(),
      input.cc?.trim() || null,
      input.subject,
      input.body,
      nowIso(),
    );
  return Number(result.lastInsertRowid);
}

/**
 * Queues only if there isn't already an unsent one of this kind for this event.
 * Saving an event twice should not put two identical invitations in the queue.
 */
export function queueOnce(input: QueueInput): number | null {
  if (input.eventId !== null) {
    const existing = db()
      .prepare(
        `SELECT id FROM outbox
         WHERE event_id = ? AND kind = ? AND status IN ('queued', 'sent')`,
      )
      .get(input.eventId, input.kind) as { id: number } | undefined;
    if (existing) return null;
  }
  return queueEmail(input);
}

export function getOutboxItem(id: number): OutboxRow | null {
  return (db().prepare("SELECT * FROM outbox WHERE id = ?").get(id) as OutboxRow) ?? null;
}

export function listOutbox(status: OutboxStatus | "all" = "all", limit = 100): OutboxRow[] {
  if (status === "all") {
    return db()
      .prepare("SELECT * FROM outbox ORDER BY queued_at DESC, id DESC LIMIT ?")
      .all(limit) as OutboxRow[];
  }
  return db()
    .prepare("SELECT * FROM outbox WHERE status = ? ORDER BY queued_at DESC, id DESC LIMIT ?")
    .all(status, limit) as OutboxRow[];
}

export function countQueued(): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM outbox WHERE status = 'queued'")
    .get() as { n: number };
  return row.n;
}

export function updateDraft(id: number, subject: string, body: string): void {
  db()
    .prepare("UPDATE outbox SET subject = ?, body = ? WHERE id = ? AND status IN ('queued', 'failed')")
    .run(subject, body, id);
}

export function cancelQueued(id: number): void {
  db()
    .prepare("UPDATE outbox SET status = 'cancelled' WHERE id = ? AND status IN ('queued', 'failed')")
    .run(id);
}

/**
 * Discards a booking's unsent mail. Called when an event is deleted: a draft
 * invitation for a booking that no longer exists should not sit in the queue
 * waiting to be sent to somebody. Mail already sent is left alone — that is
 * history, and it stays readable after the booking is gone.
 */
export function cancelQueuedForEvent(eventId: number): number {
  const result = db()
    .prepare(
      "UPDATE outbox SET status = 'cancelled' WHERE event_id = ? AND status IN ('queued', 'failed')",
    )
    .run(eventId);
  return result.changes;
}

/** Puts a cancelled or failed item back in the queue. */
export function requeue(id: number): void {
  db()
    .prepare("UPDATE outbox SET status = 'queued', error = NULL WHERE id = ? AND status IN ('cancelled', 'failed')")
    .run(id);
}

/* ------------------------------------------------------------------ send */

export type SendResult = { ok: true } | { ok: false; error: string };

function transportFor(config: MailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },

    /*
     * Give up quickly rather than hang.
     *
     * nodemailer waits two minutes to connect by default, so a host that
     * silently drops the packets — a provider blocking outbound SMTP, which
     * DigitalOcean does on new droplets — leaves the settings page spinning
     * with no clue why. A blocked port is indistinguishable from a slow one
     * for the first fifteen seconds and clearly different after; waiting the
     * other hundred and five seconds teaches nobody anything.
     */
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

/**
 * Sends an email straight out, with no trip through the approval queue.
 *
 * The queue exists so nothing client-facing leaves before Martin has read it.
 * A password reset is neither: it goes to a staff address already on file, it
 * is worthless to anyone but its recipient, and it expires in two hours. Held
 * for approval it would routinely arrive after it had already died — which
 * makes the feature useless exactly when someone needs it, at nine on a Friday
 * night.
 *
 * Nothing is written to the outbox either, because the body contains a link
 * that is a credential. The outbox is a screen an admin reads.
 */
export async function sendDirect(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const config = mailConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "No mail server is configured. Set PIPER_SMTP_HOST, PIPER_SMTP_USER, " +
        "PIPER_SMTP_PASS and PIPER_MAIL_FROM in /etc/piper.env, then restart Piper.",
    };
  }

  try {
    await transportFor(config).sendMail({
      from: config.from,
      to: input.to,
      replyTo: config.replyTo ?? undefined,
      subject: input.subject,
      text: input.body,
      html: asHtml(input.body),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message || "Sending failed." };
  }
}

/**
 * Sends one queued email. Marks it sent, or failed with the reason kept so it
 * can be read in the outbox and retried rather than disappearing.
 */
export async function sendQueued(id: number, approvedBy: number): Promise<SendResult> {
  const item = getOutboxItem(id);
  if (!item) return { ok: false, error: "That email is no longer in the outbox." };
  if (item.status === "sent") return { ok: false, error: "That email has already been sent." };

  const config = mailConfig();
  if (!config) {
    const error =
      "No mail server is configured. Set PIPER_SMTP_HOST, PIPER_SMTP_USER, " +
      "PIPER_SMTP_PASS and PIPER_MAIL_FROM in /etc/piper.env, then restart Piper.";
    db().prepare("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?").run(error, id);
    return { ok: false, error };
  }

  const transport = transportFor(config);

  try {
    await transport.sendMail({
      from: config.from,
      to: item.to_addr,
      cc: item.cc_addr ?? undefined,
      replyTo: config.replyTo ?? undefined,
      subject: item.subject,
      text: item.body,
      html: asHtml(item.body),
    });
  } catch (error) {
    const message = (error as Error).message || "Sending failed.";
    db().prepare("UPDATE outbox SET status = 'failed', error = ? WHERE id = ?").run(message, id);
    return { ok: false, error: message };
  }

  db()
    .prepare("UPDATE outbox SET status = 'sent', sent_at = ?, error = NULL, approved_by = ? WHERE id = ?")
    .run(nowIso(), approvedBy, id);
  return { ok: true };
}

/**
 * Sends a test message with settings that have not been saved yet.
 *
 * Takes the config rather than reading it, so an admin can prove a password
 * works before committing it — otherwise the only way to test a change is to
 * save it over a working one and find out afterwards.
 */
export async function sendTest(config: MailConfig, to: string): Promise<SendResult> {
  try {
    await transportFor(config).sendMail({
      from: config.from,
      to,
      subject: "Piper can send email",
      text:
        "If you are reading this, Piper's mail settings are working.\n\n" +
        "Nothing else was sent. You can close this.\n\nPiper",
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message || "Sending failed." };
  }
}

/** Confirms the mail server accepts the credentials, without sending anything. */
export async function verifyMailConnection(): Promise<SendResult> {
  const config = mailConfig();
  if (!config) return { ok: false, error: "No mail server is configured." };

  try {
    await transportFor(config).verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
