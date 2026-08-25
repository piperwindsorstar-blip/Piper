import { requireArea } from "@/lib/auth";
import { loginBanner, publicBoard, rentalNotify, shopDetails, storedMail } from "@/lib/settings";
import { mailSource } from "@/lib/mail";
import { baseUrl } from "@/lib/urls";
import BannerForm from "./BannerForm";
import PublicBoardForm from "./PublicBoardForm";
import ShopForm from "./ShopForm";
import MailForm from "./MailForm";
import RentalNotifyForm from "./RentalNotifyForm";

export default async function SettingsPage() {
  await requireArea("settings", "view");
  const banner = loginBanner();
  const board = publicBoard();
  const origin = await baseUrl();
  const shop = shopDetails();
  const notify = rentalNotify();

  // The password never leaves the server — the form is told only whether one
  // exists.
  const stored = storedMail();
  const source = mailSource();
  const mail = {
    host: stored?.host ?? "",
    port: stored?.port ?? 587,
    secure: stored?.secure ?? false,
    user: stored?.user ?? "",
    from: stored?.from ?? "",
    replyTo: stored?.replyTo ?? "",
    hasPassword: Boolean(stored?.pass),
    fromEnvironment: source === "environment",
  };

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
            <h2>Public crew board</h2>
            <span className="small muted">{board.on ? "Published" : "Not published"}</span>
          </div>
          <div className="card-body">
            <PublicBoardForm board={board} origin={origin} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Email</h2>
            <span className="small muted">
              {source === "environment"
                ? "Configured on the server"
                : source === "settings"
                  ? "Configured here"
                  : "Not configured"}
            </span>
          </div>
          <div className="card-body">
            <MailForm mail={mail} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Rental bookings</h2>
            <span className="small muted">Told when somebody hires gear in</span>
          </div>
          <div className="card-body">
            <RentalNotifyForm notify={notify} mailReady={source !== null} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Shop details</h2>
            <span className="small muted">
              {shop.showOnBoard ? (shop.showCodes ? "Shown, with codes" : "Shown") : "Not shown"}
            </span>
          </div>
          <div className="card-body">
            <ShopForm shop={shop} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>What lives on the server</h2>
          </div>
          <div className="card-body">
            <p className="small muted">
              The crew-report import token lives in <code>/etc/piper.env</code>, which
              only root can read, so it stays out of the database and out of every
              backup. Mail settings can live there too, and when they do they win over
              anything set on this page — a password in that file is not in your backups.
              Setting them here is the pragmatic alternative when nobody wants an ssh
              session to fix email.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
