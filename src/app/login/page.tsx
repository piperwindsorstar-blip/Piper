import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";
import LoginBanner from "@/components/LoginBanner";
import InstallHint from "@/components/InstallHint";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const { reset } = await searchParams;

  return (
    <main className="centered">
      <div className="auth-card">
        <div className="auth-head">
          <div className="brand" style={{ justifyContent: "center", marginBottom: "0.75rem" }}>
            <span className="brand-mark">P</span>
            <span className="brand-name">Piper</span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Sign in to your wedding DJ workspace
          </p>
        </div>
        <LoginBanner />
        <InstallHint />

        <div className="card">
          <div className="card-body">
            <LoginForm justReset={reset === "1"} />
          </div>
        </div>
      </div>
    </main>
  );
}
