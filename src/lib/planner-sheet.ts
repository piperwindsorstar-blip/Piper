import ExcelJS from "exceljs";
import { SONG_CATEGORIES, type EventWithRefs } from "./types";
import type { QuestionnaireInput } from "./planning";

/**
 * The couple's plan as a spreadsheet, and back again.
 *
 * Some couples would rather work in a sheet than a web form — it is what the
 * Pynx planning form has always been, it works offline, and two people can
 * poke at it on a laptop together. So each booking can be downloaded as a
 * workbook laid out the same way, filled in, and uploaded back.
 *
 * Piper stays the source of truth. Uploading merges what the sheet says into
 * the booking; it never deletes anything the sheet is silent about, because a
 * couple who downloads the file, fills in three songs and uploads it has not
 * asked to wipe the rest.
 *
 * Round-tripping is why the layout is defined once, here, and used by both
 * directions. Reading keys on the Activity column matching a known slot, not
 * on row numbers — a couple who inserts a row, or sorts, or deletes the blank
 * ones must not silently scramble their own plan.
 */

/** Column positions in the timeline sheet. One definition, both directions. */
const COL = { time: 1, section: 2, activity: 3, title: 4, artist: 5, cue: 6, link: 7 } as const;

const HEADERS = [
  "Time",
  "Section",
  "Activity",
  "Song Title",
  "Artist",
  "Cue / Notes",
  "Link",
];

/** Questionnaire fields as they appear on the Details sheet, in order. */
const DETAIL_FIELDS: { key: keyof QuestionnaireInput; label: string }[] = [
  { key: "arrival_time", label: "What time can we get in?" },
  { key: "mc_name", label: "Who is your MC?" },
  { key: "last_name_taken", label: "Last name to be taken" },
  { key: "bridesmaids", label: "How many bridesmaids?" },
  { key: "groomsmen", label: "How many groomsmen?" },
  { key: "venue_phone", label: "Venue phone number" },
  { key: "coordinator_email", label: "Planner / coordinator email" },
  { key: "contact_on_day", label: "Who do we call on the day?" },
  { key: "table_reserved", label: "6ft table reserved for the DJ?" },
  { key: "space_reserved", label: "10'x10' space reserved?" },
  { key: "power_each_space", label: "Power in each space?" },
  { key: "outdoor_portions", label: "Any part of the day outside?" },
  { key: "uplight_colours", label: "Uplight colours" },
  { key: "photobooth_hours", label: "Photobooth hours" },
  { key: "preferred_genres", label: "Genres and artists you love" },
  { key: "avoid_genres", label: "Anything to avoid" },
  { key: "vibe_notes", label: "The vibe you're after" },
  { key: "request_policy", label: "How should we handle guest requests?" },
  { key: "mic_needs", label: "Who needs a microphone?" },
  { key: "dedications", label: "Dedications" },
  { key: "announcements", label: "Announcements and pronunciations" },
  { key: "wedding_party", label: "Wedding party" },
  { key: "playlist_pre_ceremony", label: "Pre-ceremony playlist" },
  { key: "playlist_cocktail", label: "Cocktail playlist" },
  { key: "playlist_dinner", label: "Dinner playlist" },
  { key: "playlist_dance", label: "Dance playlist" },
];

export type SheetSong = {
  category: string;
  title: string;
  artist: string | null;
  cue: string | null;
  link: string | null;
};

export type SheetContents = {
  songs: SheetSong[];
  questionnaire: Partial<QuestionnaireInput>;
  entrances: { role: string; names: string }[];
  speeches: { who: string; when_text: string | null; song_title: string | null }[];
};

/* ------------------------------------------------------------ producing */

const ACCENT = "FF6D4AFF";
const SOFT = "FFF3F0FF";

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
  row.height = 22;
  row.alignment = { vertical: "middle" };
}

export async function buildPlannerWorkbook(
  event: EventWithRefs,
  songs: SheetSong[],
  questionnaire: Partial<QuestionnaireInput>,
  entrances: { role: string; names: string }[],
  speeches: { who: string; when_text: string | null; song_title: string | null }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Piper — Pynx Productions";
  wb.created = new Date();

  const couple = event.partner_two_name
    ? `${event.partner_one_name} & ${event.partner_two_name}`
    : event.partner_one_name;

  /* --- Timeline: every slot, in the order of the day --- */
  const timeline = wb.addWorksheet("Timeline", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  timeline.mergeCells("A1:G1");
  timeline.getCell("A1").value = `${couple} — ${event.event_date}${event.venue_name ? ` · ${event.venue_name}` : ""}`;
  timeline.getCell("A1").font = { bold: true, size: 14 };
  timeline.getCell("A1").alignment = { vertical: "middle" };
  timeline.getRow(1).height = 28;

  timeline.mergeCells("A2:G2");
  timeline.getCell("A2").value =
    "Fill in what you know. Leave anything blank and we'll talk it through. " +
    "Don't rename the Activity column — that's how we read this back in.";
  timeline.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF6B6676" } };

  styleHeader(timeline.addRow(HEADERS));

  const byCategory = new Map<string, SheetSong[]>();
  for (const song of songs) {
    const list = byCategory.get(song.category) ?? [];
    list.push(song);
    byCategory.set(song.category, list);
  }

  let lastSection = "";
  for (const category of SONG_CATEGORIES) {
    const picks = byCategory.get(category.key) ?? [];
    const rows = picks.length > 0 ? picks : [null];

    for (const pick of rows) {
      const row = timeline.addRow([
        "",
        category.section === lastSection ? "" : category.section,
        category.label,
        pick?.title ?? "",
        pick?.artist ?? "",
        pick?.cue ?? "",
        pick?.link ?? "",
      ]);
      if (category.section !== lastSection) {
        row.getCell(COL.section).font = { bold: true };
        lastSection = category.section;
      }
      row.getCell(COL.activity).font = { color: { argb: "FF6B6676" } };
    }

    // Slots that take several songs get spare rows to fill in.
    if (!category.single) {
      for (let i = 0; i < 3; i++) {
        timeline.addRow(["", "", category.label, "", "", "", ""]).getCell(COL.activity).font = {
          color: { argb: "FFB9B4C4" },
        };
      }
    }
  }

  timeline.columns = [
    { width: 10 },
    { width: 14 },
    { width: 30 },
    { width: 34 },
    { width: 26 },
    { width: 34 },
    { width: 30 },
  ];

  /* --- Details: the questions the form asks --- */
  const details = wb.addWorksheet("Details");
  styleHeader(details.addRow(["Question", "Your answer"]));
  for (const field of DETAIL_FIELDS) {
    const row = details.addRow([field.label, questionnaire[field.key] ?? ""]);
    row.getCell(1).font = { color: { argb: "FF6B6676" } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
  details.columns = [{ width: 40 }, { width: 70 }];

  /* --- Entrances and speeches --- */
  const order = wb.addWorksheet("Entrances");
  styleHeader(order.addRow(["Order", "Who"]));
  const entranceRows = entrances.length > 0 ? entrances : [];
  for (const entry of entranceRows) order.addRow([entry.role, entry.names]);
  for (let i = 0; i < 8; i++) order.addRow(["", ""]);
  order.columns = [{ width: 28 }, { width: 50 }];

  const speech = wb.addWorksheet("Speeches");
  styleHeader(speech.addRow(["Who", "When", "Walk-up song"]));
  for (const entry of speeches) {
    speech.addRow([entry.who, entry.when_text ?? "", entry.song_title ?? ""]);
  }
  for (let i = 0; i < 6; i++) speech.addRow(["", "", ""]);
  speech.columns = [{ width: 30 }, { width: 24 }, { width: 40 }];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/* --------------------------------------------------------------- reading */

/** Cell text, whatever shape ExcelJS hands back for it. */
function text(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Hyperlinks and rich text arrive as objects.
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.hyperlink === "string") return v.hyperlink.trim();
    if (typeof v.result === "string") return v.result.trim();
    if (Array.isArray(v.richText)) {
      return (v.richText as { text: string }[]).map((r) => r.text).join("").trim();
    }
  }
  return "";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function readPlannerWorkbook(buffer: Buffer): Promise<SheetContents> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const result: SheetContents = {
    songs: [],
    questionnaire: {},
    entrances: [],
    speeches: [],
  };

  /* --- Timeline, keyed on the Activity label rather than row position --- */
  const slotByLabel = new Map(SONG_CATEGORIES.map((c) => [norm(c.label), c.key]));
  const timeline = wb.getWorksheet("Timeline");
  if (timeline) {
    timeline.eachRow((row) => {
      const activity = text(row.getCell(COL.activity));
      const title = text(row.getCell(COL.title));
      if (!activity || !title) return;

      const category = slotByLabel.get(norm(activity));
      if (!category) return;

      result.songs.push({
        category,
        title,
        artist: text(row.getCell(COL.artist)) || null,
        cue: text(row.getCell(COL.cue)) || null,
        link: text(row.getCell(COL.link)) || null,
      });
    });
  }

  /* --- Details, keyed on the question text --- */
  const fieldByLabel = new Map(DETAIL_FIELDS.map((f) => [norm(f.label), f.key]));
  const details = wb.getWorksheet("Details");
  if (details) {
    details.eachRow((row) => {
      const label = text(row.getCell(1));
      const answer = text(row.getCell(2));
      if (!label || !answer) return;
      const key = fieldByLabel.get(norm(label));
      if (key) result.questionnaire[key] = answer;
    });
  }

  const entrances = wb.getWorksheet("Entrances");
  if (entrances) {
    entrances.eachRow((row, n) => {
      if (n === 1) return;
      const role = text(row.getCell(1));
      const names = text(row.getCell(2));
      if (role || names) result.entrances.push({ role, names });
    });
  }

  const speeches = wb.getWorksheet("Speeches");
  if (speeches) {
    speeches.eachRow((row, n) => {
      if (n === 1) return;
      const who = text(row.getCell(1));
      if (!who) return;
      result.speeches.push({
        who,
        when_text: text(row.getCell(2)) || null,
        song_title: text(row.getCell(3)) || null,
      });
    });
  }

  return result;
}

/** A filename a couple will recognise in their downloads folder. */
export function sheetFilename(event: EventWithRefs): string {
  const couple = [event.partner_one_name, event.partner_two_name]
    .filter(Boolean)
    .join(" and ")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${couple || "Wedding"} — ${event.event_date} planner.xlsx`;
}
