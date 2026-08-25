import { requireArea } from "@/lib/auth";
import { listVenues } from "@/lib/events";
import { listDjs } from "@/lib/team";
import EventForm from "../../EventForm";
import { loadEvent } from "../guard";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("weddings", "edit");
  const { id } = await params;
  const { event } = await loadEvent(id);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>
            Edit — {event.partner_one_name}
            {event.partner_two_name ? ` & ${event.partner_two_name}` : ""}
          </h1>
          <div className="topbar-sub">Wedding details and staffing</div>
        </div>
      </header>
      <div className="content">
        <div className="card">
          <div className="card-body">
            <EventForm event={event} venues={listVenues()} djs={listDjs()} />
          </div>
        </div>
      </div>
    </>
  );
}
