import { requireAdmin } from "@/lib/auth";
import { listVenues } from "@/lib/events";
import { listDjs } from "@/lib/team";
import EventForm from "../EventForm";

export default async function NewEventPage() {
  await requireAdmin();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>New event</h1>
          <div className="topbar-sub">Put a wedding on the books</div>
        </div>
      </header>
      <div className="content">
        <div className="card">
          <div className="card-body">
            <EventForm venues={listVenues()} djs={listDjs()} />
          </div>
        </div>
      </div>
    </>
  );
}
