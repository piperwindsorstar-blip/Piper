"use client";

import { useActionState } from "react";
import { uploadSheet, type UploadState } from "./sheet-actions";

/**
 * The spreadsheet route into and out of a booking, for couples who would
 * rather work in a sheet than a web form.
 *
 * Download, fill in, send back, upload. Uploading merges — a sheet with three
 * songs in it adds three songs, it does not wipe everything else — so this is
 * safe to do as many times as a couple sends a new version.
 */
export default function PlannerSheet({
  eventId,
  canUpload,
}: {
  eventId: number;
  canUpload: boolean;
}) {
  const [state, upload, uploading] = useActionState(uploadSheet, {} as UploadState);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Spreadsheet</h2>
        <span className="small muted">For couples who prefer one</span>
      </div>

      <div className="card-body">
        <p className="small muted">
          The same plan as a workbook, laid out like the planning form. Send it to a
          couple who would rather fill in a sheet, then upload their copy back here.
        </p>

        <div className="btn-row">
          <a className="btn btn-sm" href={`/api/events/${eventId}/sheet`}>
            Download the planner
          </a>
        </div>

        {canUpload && (
          <form action={upload} className="sheet-upload">
            <div className="field">
              <label htmlFor="sheet">Import a filled-in copy</label>
              <input
                id="sheet"
                name="sheet"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
              />
            </div>
            <input type="hidden" name="event_id" value={eventId} />
            <button className="btn btn-sm btn-primary" type="submit" disabled={uploading}>
              {uploading ? "Reading…" : "Import"}
            </button>
          </form>
        )}

        {state.error && <p className="alert-error">{state.error}</p>}
        {state.ok && <p className="alert-ok">{state.ok}</p>}

        {canUpload && (
          <p className="small faint sheet-note">
            Importing adds and updates — it never deletes anything the sheet leaves
            blank, so a partly-filled copy is safe to import.
          </p>
        )}
      </div>
    </div>
  );
}
