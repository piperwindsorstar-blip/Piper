/**
 * A pasted link from any music service, turned into a title and an artist.
 *
 * Couples plan in Spotify, or Apple Music, or YouTube, and then retype what
 * they found into a form. That retyping is where people give up, and it is
 * where "Tiny Dancer" becomes "tiny dancer elton" and the DJ plays a cover.
 *
 * Every service is reached through a public endpoint that needs no key and no
 * account, because a planning form that stops working when somebody's API
 * token expires is worse than one that never had one.
 *
 * ## On fetching a URL somebody typed
 *
 * The link comes from a stranger — anybody with a planner token can paste one
 * — so it is never fetched as given. Each service is recognised by host, the
 * id is pulled out of the path or the query, and the request is built from a
 * fixed template against a fixed host. A link to an internal address, a file
 * URL, or a redirect chain therefore has nothing to aim at: the only thing
 * taken from the user is an id matched against a narrow pattern.
 */

export const MUSIC_SERVICES = [
  "spotify",
  "apple",
  "youtube",
  "soundcloud",
  "deezer",
  "tidal",
] as const;
export type MusicService = (typeof MUSIC_SERVICES)[number];

export const SERVICE_LABELS: Record<MusicService, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  deezer: "Deezer",
  tidal: "TIDAL",
};

export type TrackRef = { service: MusicService; id: string; url: string };

export type Resolved =
  | { ok: true; service: MusicService; title: string; artist: string | null }
  | { ok: false; service: MusicService | null; reason: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Works out which service a link belongs to and what it points at.
 *
 * Returns null rather than guessing. A link Piper does not recognise is kept
 * as a link — it is still useful to the DJ — and the couple types the title.
 */
export function identify(raw: string): TrackRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const keep = (id: string | undefined): string | null =>
    id && ID.test(id) ? id : null;

  // Spotify: /track/<id>, sometimes with a locale segment in front.
  if (host === "open.spotify.com" || host === "spotify.com") {
    const at = parts.indexOf("track");
    const id = keep(at === -1 ? undefined : parts[at + 1]);
    return id ? { service: "spotify", id, url: raw } : null;
  }

  // Apple Music: the song is the ?i= on an album URL. Without it the link is
  // an album, and an album has no one title to fill in.
  if (host === "music.apple.com" || host === "itunes.apple.com") {
    const id = keep(url.searchParams.get("i") ?? undefined);
    return id ? { service: "apple", id, url: raw } : null;
  }

  // YouTube, including YouTube Music and the short form.
  if (host === "youtube.com" || host === "music.youtube.com" || host === "m.youtube.com") {
    const id = keep(url.searchParams.get("v") ?? undefined);
    return id ? { service: "youtube", id, url: raw } : null;
  }
  if (host === "youtu.be") {
    const id = keep(parts[0]);
    return id ? { service: "youtube", id, url: raw } : null;
  }

  // SoundCloud has no ids in its URLs — the path is the identifier.
  if (host === "soundcloud.com") {
    if (parts.length < 2) return null;
    const path = parts.slice(0, 2).join("/");
    return /^[A-Za-z0-9_\-./]{1,120}$/.test(path)
      ? { service: "soundcloud", id: path, url: raw }
      : null;
  }

  if (host === "deezer.com") {
    const at = parts.indexOf("track");
    const id = keep(at === -1 ? undefined : parts[at + 1]);
    return id ? { service: "deezer", id, url: raw } : null;
  }

  if (host === "tidal.com" || host === "listen.tidal.com") {
    const at = parts.indexOf("track");
    const id = keep(at === -1 ? undefined : parts[at + 1]);
    return id ? { service: "tidal", id, url: raw } : null;
  }

  return null;
}

/* ------------------------------------------------------------- tidying up */

/**
 * Strips the decoration video titles carry.
 *
 * "Never Gonna Give You Up (Official Video) (4K Remaster)" is a video's name,
 * not a song's. What a DJ needs on a cue sheet is the song.
 */
const NOISE =
  /\s*[([]\s*(official\s*)?(music\s*)?(video|audio|lyric[s]?|visualizer|visualiser|hd|4k|remaster(ed)?(\s*\d{4})?|explicit|clean|mv|m\/v|full\s*song|with\s*lyrics?|lyric\s*video)\b[^)\]]*[)\]]/gi;

/**
 * Streaming services suffix a remaster onto the track name — Spotify returns
 * "Stairway to Heaven - Remaster". Only remaster wording is stripped: a radio
 * edit or a live cut is a different recording, and a DJ asked for the live one
 * wants the live one.
 */
const REMASTER = /\s*[-–—]\s*(\d{4}\s*)?remaster(ed)?(\s*\d{4})?\s*$/i;

export function tidyTitle(value: string): string {
  return value
    .replace(NOISE, "")
    .replace(/\s*[-–—]\s*(official\s*)?(music\s*)?video\s*$/i, "")
    .replace(REMASTER, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Splits "Artist - Song" and "Song by Artist" into their halves.
 *
 * Only where the shape is unambiguous. A title with no separator is a title,
 * and inventing an artist out of half of it would be worse than leaving the
 * box empty for somebody to fill in.
 */
export function splitArtistTitle(
  value: string,
  shape: "artist-first" | "title-by-artist",
): { title: string; artist: string | null } {
  if (shape === "title-by-artist") {
    const m = value.match(/^(.*?)\s+by\s+(.+)$/i);
    return m ? { title: m[1].trim(), artist: m[2].trim() } : { title: value, artist: null };
  }

  // Dashes only, and only the first one: "Earth, Wind & Fire - September" has
  // commas in the artist, and "Marry You - Bruno Mars" is the other way round
  // often enough that a second dash is not worth guessing at.
  const m = value.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: value, artist: null };
}

/* --------------------------------------------------------------- fetching */

const TIMEOUT_MS = 8000;
/** Enough for a metadata document; a page far larger than this is not one. */
const MAX_BYTES = 1_500_000;

async function getText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Piper/1.0 (+wedding planning)", accept: "*/*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!response.ok) return null;

    const body = await response.text();
    return body.length > MAX_BYTES ? body.slice(0, MAX_BYTES) : body;
  } catch {
    return null;
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const text = await getText(url);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Reads one `<meta>` value, whichever order the attributes happen to be in. */
function meta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${key}"`, "i"),
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const value = m[1]
        .replace(/&amp;/g, "&")
        .replace(/&#0?39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      if (value) return value;
    }
  }
  return null;
}

/* -------------------------------------------------------- one per service */

async function fromSpotify(id: string): Promise<Resolved> {
  // The oEmbed document is the official one and gives the track's own name,
  // free of the "(Official Video)" noise a YouTube title carries.
  const embed = await getJson<{ title?: string }>(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`,
  );

  // It does not name the artist, though, and there is no way to ask for one
  // without an API key. The track page says it in a meta tag, so that is a
  // second request — worth it, because a title with no artist is half a job.
  const html = await getText(`https://open.spotify.com/track/${id}`);
  const artist =
    (html && meta(html, "music:musician_description")) ||
    (html && meta(html, "og:description")?.split("·")[0]?.trim()) ||
    null;

  const title = embed?.title ?? (html ? meta(html, "og:title") : null);
  if (!title) return { ok: false, service: "spotify", reason: "Spotify didn't recognise that link." };
  return { ok: true, service: "spotify", title: tidyTitle(title), artist };
}

async function fromApple(trackId: string): Promise<Resolved> {
  const data = await getJson<{
    resultCount: number;
    results: { trackName?: string; artistName?: string; collectionName?: string }[];
  }>(`https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}`);

  const hit = data?.results?.[0];
  if (!hit) return { ok: false, service: "apple", reason: "Apple Music didn't recognise that link." };

  const title = hit.trackName ?? hit.collectionName;
  if (!title) return { ok: false, service: "apple", reason: "That Apple Music link isn't a song." };
  return { ok: true, service: "apple", title: tidyTitle(title), artist: hit.artistName ?? null };
}

async function fromYouTube(id: string): Promise<Resolved> {
  const data = await getJson<{ title?: string; author_name?: string }>(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
  );
  if (!data?.title) {
    return { ok: false, service: "youtube", reason: "YouTube didn't recognise that link." };
  }

  const cleaned = tidyTitle(data.title);
  const split = splitArtistTitle(cleaned, "artist-first");

  // The channel is the fallback artist, with the VEVO suffix taken off. It is
  // right more often than not, and it is a box somebody can correct.
  const channel = data.author_name?.replace(/VEVO$/i, "").trim() || null;
  return {
    ok: true,
    service: "youtube",
    title: split.title,
    artist: split.artist ?? channel,
  };
}

async function fromSoundCloud(path: string): Promise<Resolved> {
  const data = await getJson<{ title?: string; author_name?: string }>(
    `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(`https://soundcloud.com/${path}`)}`,
  );
  if (!data?.title) {
    return { ok: false, service: "soundcloud", reason: "SoundCloud didn't recognise that link." };
  }

  const split = splitArtistTitle(data.title, "title-by-artist");
  return {
    ok: true,
    service: "soundcloud",
    title: tidyTitle(split.title),
    artist: split.artist ?? data.author_name ?? null,
  };
}

async function fromDeezer(id: string): Promise<Resolved> {
  const data = await getJson<{ title?: string; artist?: { name?: string }; error?: unknown }>(
    `https://api.deezer.com/track/${encodeURIComponent(id)}`,
  );
  if (!data?.title || data.error) {
    return { ok: false, service: "deezer", reason: "Deezer didn't recognise that link." };
  }
  return {
    ok: true,
    service: "deezer",
    title: tidyTitle(data.title),
    artist: data.artist?.name ?? null,
  };
}

/**
 * Resolves a pasted link, when the service will say what it points at.
 *
 * TIDAL is recognised and deliberately not looked up: its embed endpoint
 * returns a player and no metadata, and everything else it offers needs an
 * account. Saying so is better than a spinner that never resolves.
 */
export async function resolveTrack(raw: string): Promise<Resolved> {
  const ref = identify(raw);
  if (!ref) {
    return {
      ok: false,
      service: null,
      reason: "That doesn't look like a link to a song. Paste one and Piper will fill in the rest.",
    };
  }

  switch (ref.service) {
    case "spotify":
      return fromSpotify(ref.id);
    case "apple":
      return fromApple(ref.id);
    case "youtube":
      return fromYouTube(ref.id);
    case "soundcloud":
      return fromSoundCloud(ref.id);
    case "deezer":
      return fromDeezer(ref.id);
    case "tidal":
      return {
        ok: false,
        service: "tidal",
        reason: "TIDAL doesn't publish song details. The link is saved — type the title and artist.",
      };
  }
}
