"use client";

import { useState } from "react";
import type { Recommendation } from "@/lib/types";

/**
 * The add-a-song row for one slot, with what past couples picked underneath.
 * Tapping a suggestion fills the fields rather than submitting, so the couple
 * still chooses — and can adjust the cue before saving.
 */
export default function SlotPicker({
  single,
  hasSongs,
  recommendations,
}: {
  single: boolean;
  hasSongs: boolean;
  recommendations: Recommendation[];
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  return (
    <>
      <div className="form-grid" style={{ gap: "0 0.6rem" }}>
        <div className="field" style={{ marginBottom: "0.5rem" }}>
          <input
            name="title"
            type="text"
            placeholder="Song title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: "0.5rem" }}>
          <input
            name="artist"
            type="text"
            placeholder="Artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
      </div>

      <div className="form-grid" style={{ gap: "0 0.6rem" }}>
        <div className="field" style={{ marginBottom: "0.5rem" }}>
          <input name="cue" type="text" placeholder="Where should it start or stop? e.g. start at 1:28" />
        </div>
        <div className="field" style={{ marginBottom: "0.5rem" }}>
          <div className="btn-row" style={{ flexWrap: "nowrap" }}>
            <input name="link" type="text" placeholder="Spotify / Apple / YouTube link" />
            <button className="btn btn-sm btn-primary" type="submit">
              {single && hasSongs ? "Replace" : "Add"}
            </button>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="reco">
          <span className="reco-label">Past Pynx couples picked</span>
          <div className="chiplist">
            {recommendations.map((r) => (
              <button
                type="button"
                className="chip reco-chip"
                key={r.id}
                onClick={() => {
                  setTitle(r.title);
                  setArtist(r.artist ?? "");
                }}
                title={r.note ?? "Tap to fill this in"}
              >
                {r.title}
                {r.artist ? <span className="faint"> · {r.artist}</span> : null}
                {r.times_picked > 1 && <span className="reco-count">×{r.times_picked}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
