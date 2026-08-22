import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { recentFailures, recentSignIns, REASON_LABELS } from "@/lib/activity";
import { formatStoredTimestamp } from "@/lib/dates";

/**
 * Every attempt to sign in, successful or not.
 *
 * The failures are the reason this page is worth having. A handful is ordinary
 * — people mistype passwords — so they are summarised by email first, because
 * "nine failures against one address in a day" is the shape worth noticing and
 * a flat list buries it.
 */

/** How the device described itself, in the two words a person cares about. */
function device(userAgent: string | null): string {
  if (!userAgent) return "—";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone / iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Other";
}

/** Midnight is the wrong boundary for "recently"; a rolling day is not. */
function oneDayAgo(): string {
  return new Date(Date.now() - 86_400_000).toISOString().replace("T", " ").slice(0, 19);
}

export default async function SignInsPage() {
  await requireAdmin();

  const rows = recentSignIns(200);
  const failures = recentFailures(oneDayAgo());
  // One or two failures is someone fumbling a password. Repeated failures
  // against the same address is the thing worth surfacing.
  const worrying = failures.filter((f) => f.n >= 3);

  return (
    <>
      {worrying.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Repeated failures in the last day</h2>
            <span className="small muted">Three or more against one address</span>
          </div>
          <div className="card-body">
            <ul className="stack-list">
              {worrying.map((f) => (
                <li key={f.email_tried}>
                  <strong>{f.email_tried}</strong> — {f.n} failed attempts, last{" "}
                  {formatStoredTimestamp(f.last_at)}
                </li>
              ))}
            </ul>
            <p className="small muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              If that is one of your people, they probably need a password reset. If it
              isn&rsquo;t an address you recognise, someone is guessing.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Sign-ins</h2>
          <span className="small muted">Last {rows.length} attempts · newest first</span>
        </div>

        {rows.length === 0 ? (
          <div className="empty">Nobody has signed in yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Result</th>
                  <th>Device</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="nowrap">{formatStoredTimestamp(row.at)}</td>
                    <td>
                      {row.user_id ? (
                        <Link href={`/team/${row.user_id}`}>{row.actor_label}</Link>
                      ) : (
                        <span className="muted">{row.email_tried}</span>
                      )}
                    </td>
                    <td>
                      {row.outcome === "success" ? (
                        <span className="badge badge-confirmed">Signed in</span>
                      ) : (
                        <span className="badge badge-cancelled">
                          {row.reason ? (REASON_LABELS[row.reason] ?? "Failed") : "Failed"}
                        </span>
                      )}
                    </td>
                    <td className="small muted">{device(row.user_agent)}</td>
                    <td className="small muted nowrap">{row.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
