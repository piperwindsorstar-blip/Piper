/**
 * Outbox shapes and labels, kept apart from `mail.ts` on purpose.
 *
 * `mail.ts` imports nodemailer, which is Node-only. A Client Component that
 * needs so much as the row type would otherwise drag the whole mail transport
 * — and its dns and child_process dependencies — into the browser bundle, and
 * the build fails. Types and display strings live here where both sides can
 * safely reach them.
 */

export type OutboxKind = "planner_invite" | "dj_intro" | "availability_request";
export type OutboxStatus = "queued" | "sent" | "failed" | "cancelled";

export type OutboxRow = {
  id: number;
  event_id: number | null;
  kind: OutboxKind;
  to_addr: string;
  cc_addr: string | null;
  subject: string;
  body: string;
  status: OutboxStatus;
  queued_at: string;
  sent_at: string | null;
  error: string | null;
  approved_by: number | null;
};

export const KIND_LABELS: Record<OutboxKind, string> = {
  planner_invite: "Planner invitation",
  dj_intro: "DJ introduction",
  availability_request: "Availability request",
};
