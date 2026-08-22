import { requireAdmin } from "@/lib/auth";
import { loginBanner } from "@/lib/settings";
import BannerForm from "./BannerForm";

export default async function SettingsPage() {
  await requireAdmin();
  const banner = loginBanner();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Settings</h1>
          <div className="topbar-sub">Things you can change without touching the server</div>
        </div>
      </header>

      <div className="content">
        <div className="card">
          <div className="card-head">
            <h2>Sign-in notice</h2>
            <span className="small muted">
              {banner.on ? "Showing now" : "Not showing"}
            </span>
          </div>
          <div className="card-body">
            <BannerForm banner={banner} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>What lives on the server</h2>
          </div>
          <div className="card-body">
            <p className="small muted">
              Mail credentials and the crew-report import token are deliberately not
              editable here. They live in <code>/etc/piper.env</code>, which only root can
              read, so they stay out of the database and out of every backup.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
