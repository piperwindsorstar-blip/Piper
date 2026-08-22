import { requireAdmin } from "@/lib/auth";
import ActivityTabs from "./ActivityTabs";

/**
 * Admin-only, and gated here rather than only on each page — a layout that
 * renders for anyone would leak the tab names and counts to a DJ who guessed
 * the URL, even if every page below refused them.
 */
export default async function ActivityLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Activity</h1>
          <div className="topbar-sub">Who changed what, and who signed in</div>
        </div>
      </header>

      <div className="content">
        <ActivityTabs />
        {children}
      </div>
    </>
  );
}
