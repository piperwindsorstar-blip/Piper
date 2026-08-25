"use client";

import { useState, useTransition } from "react";
import { SERVICE_LABELS } from "@/lib/music-links";
import { lookupTrack } from "@/app/plan/[token]/lookup-action";

/**
 * The link box, which fills in the song for you.
 *
 * Paste from Spotify, Apple Music, YouTube, SoundCloud or Deezer and the title
 * and artist arrive on their own. That retyping is where couples give up on a
 * planning form, and it is where "Tiny Dancer" becomes "tiny dancer elton" and
 * the DJ ends up playing a cover.
 *
 * It only ever fills boxes that are empty, and it never clears one. Somebody
 * who typed a title and then pasted a link to a particular recording of it
 * has not asked for their typing to be replaced.
 */
export default function TrackLink({
  title,
  artist,
  setTitle,
  setArtist,
  name = "link",
  placeholder = "Paste a Spotify, Apple Music, YouTube, SoundCloud or Deezer link",
  children,
}: {
  title: string;
  artist: string;
  setTitle: (value: string) => void;
  setArtist: (value: string) => void;
  name?: string;
  placeholder?: string;
  /** The submit button, so the link box and it stay on one row. */
  children?: React.ReactNode;
}) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [looking, startLookup] = useTransition();

  function look(value: string) {
    const url = value.trim();
    if (!url) {
      setNote(null);
      return;
    }

    startLookup(async () => {
      const found = await lookupTrack(url);
      if (!found.ok) {
        setNote({ kind: "warn", text: found.reason });
        return;
      }

      const filled: string[] = [];
      if (!title.trim() && found.title) {
        setTitle(found.title);
        filled.push("title");
      }
      if (!artist.trim() && found.artist) {
        setArtist(found.artist);
        filled.push("artist");
      }

      const from = SERVICE_LABELS[found.service];
      setNote(
        filled.length > 0
          ? { kind: "ok", text: `Filled the ${filled.join(" and ")} in from ${from}.` }
          : found.artist
            ? { kind: "ok", text: `${from}: ${found.title} — ${found.artist}` }
            : { kind: "warn", text: `${from} gave the title but not the artist.` },
      );
    });
  }

  return (
    <>
      <div className="btn-row" style={{ flexWrap: "nowrap" }}>
        <input
          name={name}
          type="text"
          placeholder={placeholder}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPaste={(e) => {
            // Straight off the paste, rather than waiting for a blur that may
            // never come — most people paste and then reach for Add.
            const pasted = e.clipboardData.getData("text");
            if (pasted) setTimeout(() => look(pasted), 0);
          }}
          onBlur={(e) => look(e.target.value)}
        />
        {children}
      </div>
      {(looking || note) && (
        <div className={`small ${note?.kind === "warn" ? "muted" : "faint"}`}>
          {looking ? "Looking it up…" : note?.text}
        </div>
      )}
    </>
  );
}
