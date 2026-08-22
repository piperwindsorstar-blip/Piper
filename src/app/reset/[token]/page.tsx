import Link from "next/link";
import { resetTarget } from "@/lib/password-reset";
import ResetForm from "./ResetForm";
import LoginBanner from "@/components/LoginBanner";

/**
 * The page a reset link opens.
 *
 * A dead token gets a page that explains itself and offers the way forward,
 * rather than a 404 — the most common reason to land here with a spent link is
 * clicking the older of two emails, and "not found" would send a person looking
 * for a problem that isn't there.
 */
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = resetTarget(token);

  return (
    <main className="centered">
      <div className="auth-card">
        <div className="auth-head">
          <div className="brand" style={{ justifyContent: "center", marginBottom: "0.75rem" }}>
            <span className="brand-mark">P</span>
            <span className="brand-name">Piper</span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {target ? "Choose a new password" : "That link has expired"}
          </p>
        </div>

        <LoginBanner />

        <div className="card">
          <div className="card-body">
            {target ? (
              <ResetForm token={token} name={target.user.name} />
            ) : (
              <>
                <p className="small muted">
                  Reset links work once and last two hours. If you asked more than once,
                  only the newest email works.
                </p>
                <Link
                  className="btn btn-primary"
                  href="/forgot"
                  style={{ width: "100%", textAlign: "center" }}
                >
                  Send me a new link
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
