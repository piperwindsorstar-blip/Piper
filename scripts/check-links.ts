/**
 * Checks the music services still answer, and still answer the same way.
 *
 * Not part of the smoke suite: it reaches six companies over the internet, and
 * a test that fails because Spotify is having an afternoon is a test people
 * learn to ignore. Run it by hand — `npm run check:links` — when a lookup
 * looks wrong, or after any of them redesigns something.
 */
import { identify, resolveTrack, tidyTitle, splitArtistTitle } from "../src/lib/music-links";

const LINKS = [
  "https://open.spotify.com/track/1BxfuPKGuaTgP7aM0Bbdwr",
  "https://open.spotify.com/intl-fr/track/5CQ30WqJwcep0pYcV4AMNc",
  "https://music.apple.com/us/album/cruel-summer/1468058165?i=1468058171",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://soundcloud.com/forss/flickermood",
  "https://www.deezer.com/track/3135556",
  "https://tidal.com/browse/track/77364684",
  "https://example.com/not-a-song",
  "not a url at all",
  "https://music.apple.com/us/album/lover/1468058165",
];

(async () => {
  console.log("=== tidying ===");
  for (const t of [
    "Never Gonna Give You Up (Official Video) (4K Remaster)",
    "Marry You (Official Lyric Video)",
    "September [HD]",
  ]) console.log(`  ${JSON.stringify(t)} → ${JSON.stringify(tidyTitle(t))}`);

  console.log("\n=== splitting ===");
  for (const [v, s] of [
    ["Rick Astley - Never Gonna Give You Up", "artist-first"],
    ["Flickermood by Forss", "title-by-artist"],
    ["September", "artist-first"],
  ] as const) console.log(`  ${JSON.stringify(v)} → ${JSON.stringify(splitArtistTitle(v, s))}`);

  console.log("\n=== live lookups ===");
  for (const link of LINKS) {
    const ref = identify(link);
    const r = await resolveTrack(link);
    const label = (ref?.service ?? "—").padEnd(11);
    if (r.ok) console.log(`  ${label} ${JSON.stringify(r.title)} — ${JSON.stringify(r.artist)}`);
    else console.log(`  ${label} refused: ${r.reason}`);
  }
})();
