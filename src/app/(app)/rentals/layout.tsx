import { requireAdmin } from "@/lib/auth";

/**
 * Admin-only, gated in the layout for the same reason dispatch is: a shell that
 * renders for anyone leaks what is behind it.
 */
export default async function RentalsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Rentals</h1>
          <div className="topbar-sub">Gear hired in, and who from</div>
        </div>
      </header>

      <div className="content">{children}</div>
    </>
  );
}
