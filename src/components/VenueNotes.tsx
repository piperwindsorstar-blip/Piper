import { formatEastern } from "@/lib/dates";
import { splitCrew } from "@/lib/reports";
import type { VenueNote } from "@/lib/venue-reports";

/**
 * What crews have actually said about this room.
 *
 * The load-in notes above this are what you decided once. These are what the
 * people who carried the gear in found — dated, attributed, and accumulating
 * on their own from the report emails.
 */
export default function VenueNotes({ notes }: { notes: VenueNote[] }) {
  if (notes.length === 0) {
    return (
      <div className="empty">
        Nothing from crews yet. Notes land here once your report form asks which
        venue the job was at.
      </div>
    );
  }

  return (
    <ul className="venue-notes">
      {notes.map((note) => (
        <li key={note.id}>
          <div className="venue-note-head">
            <span className="badge badge-plain">{note.kind === "dj" ? "Show" : "Warehouse"}</span>
            <span className="small">{splitCrew(note.crew_raw).join(", ") || "Crew not named"}</span>
            {note.quality !== null && (
              <span className="small faint">return quality {note.quality}/5</span>
            )}
            <span className="small faint venue-note-when">
              {formatEastern(note.sent_at)} · job {note.job_raw}
            </span>
          </div>
          <p className="venue-note-body">{note.notes}</p>
        </li>
      ))}
    </ul>
  );
}
