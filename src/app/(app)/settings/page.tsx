import { requireAdmin } from "@/lib/auth";
import { loginBanner, publicBoard, shopDetails } from "@/lib/settings";
import { baseUrl } from "@/lib/urls";
import BannerForm from "./BannerForm";
import PublicBoardForm from "./PublicBoardForm";
import ShopForm from "./ShopForm";

export default async function SettingsPage() {
  await requireAdmin();
  const banner = loginBanner();
  const board = publicBoard();
  const origin = await baseUrl();
  const shop = shopDetails();

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
