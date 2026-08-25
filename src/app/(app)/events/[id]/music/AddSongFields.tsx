"use client";

import { useState } from "react";
import TrackLink from "@/components/TrackLink";

/**
 * The add-a-song row on the office side.
 *
 * The same paste-a-link behaviour the couple gets, because the office types
 * more songs than anybody — every phone call that ends "and can we have this
 * one for the first dance" lands here.
 */
export default function AddSongFields({ submitLabel }: { submitLabel: string }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  return (
    <div className="form-grid cols-4" style={{ gap: "0 0.6rem" }}>
      <div className="field" style={{ marginBottom: "0.6rem" }}>
        <input
          name="title"
          type="text"
          placeholder="Song title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="field" style={{ marginBottom: "0.6rem" }}>
        <input
          name="artist"
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
      </div>
      <div className="field" style={{ marginBottom: "0.6rem" }}>
        <input name="cue" type="text" placeholder="Cue — e.g. start at 1:28, fade 2:20" />
      </div>
      <div className="field" style={{ marginBottom: "0.6rem" }}>
        <TrackLink
          title={title}
          artist={artist}
          setTitle={setTitle}
          setArtist={setArtist}
          placeholder="Paste a link"
        />
      </div>
      <div className="field" style={{ marginBottom: "0.6rem" }}>
        <div className="btn-row" style={{ flexWrap: "nowrap" }}>
          <input name="notes" type="text" placeholder="Note" />
          <button className="btn btn-sm" type="submit">
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
