import { requireAdmin } from "@/lib/auth";
import DispatchTabs from "./DispatchTabs";

/**
 * Admin-only, gated in the layout for the same reason the activity pages are:
 * a shell that renders for anyone leaks what is behind it.
 */
export default async function DispatchLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Dispatch</h1>
          <div className="topbar-sub">Which vehicle is where, and who has the keys</div>
        </div>
      </header>

      <div className="content">
        <DispatchTabs />
        {children}
      </div>
    </>
  );
}
