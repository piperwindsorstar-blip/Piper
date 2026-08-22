import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ForgotForm from "./ForgotForm";

export default async function ForgotPage() {
  // Somebody already signed in doesn't need this, and landing here from a stale
  // bookmark shouldn't look like their account is in trouble.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="centered">
      <div className="auth-card">
        <div className="auth-head">
          <div className="brand" style={{ justifyContent: "center", marginBottom: "0.75rem" }}>
            <span className="brand-mark">P</span>
            <span className="brand-name">Piper</span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Forgotten your password
          </p>
        </div>
        <div className="card">
          <div className="card-body">
            <ForgotForm />
          </div>
        </div>
      </div>
    </main>
  );
}
