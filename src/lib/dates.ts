/**
 * All dates in Piper are plain 'YYYY-MM-DD' strings in the DJ's own local
 * calendar — a wedding on June 14 is on June 14 regardless of server timezone,
 * so these helpers deliberately never touch UTC conversion.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * One letter for the day of the week: M T W T F S S.
 *
 * A letter rather than a name because a month of columns leaves about
 * twenty-eight pixels each, and a quarter leaves a third of that. In a run of
 * dates the position disambiguates the two Ts and the two Ss, which is why
 * every paper calendar does it this way.
 *
 * parseIso builds a local date from the parts rather than parsing the string,
 * so this cannot slip a day the way new Date("2026-08-29").getDay() does west
 * of Greenwich — that reads as UTC midnight and comes back as the day before.
 */
/**
 * A hue for a month, so August is the same colour every time it appears.
 *
 * Spaced by the golden angle rather than 360/12. Thirty degrees apart makes
 * neighbouring months nearly the same colour, and neighbouring months are
 * exactly the ones on screen together — a quarter shows three in a row. At
 * 137.5 degrees no two consecutive months land near each other, while each
 * month still keeps one fixed hue of its own.
 */
export function monthHue(iso: string): number {
  return Math.round(parseIso(iso).getMonth() * 137.5) % 360;
}

/**
 * The months a run of days covers, as bands to lay across a grid of columns.
 *
 * `start` is a 1-based CSS grid line and `span` a column count, so a band
 * drops straight into grid-column. Days are assumed to be consecutive and in
 * order, which is what every caller builds them as.
 */
export function monthBands(
  days: string[],
): { key: string; label: string; start: number; span: number; hue: number }[] {
  const bands: { key: string; label: string; start: number; span: number; hue: number }[] = [];

  days.forEach((day, i) => {
    const key = day.slice(0, 7);
    const last = bands[bands.length - 1];
    if (last && last.key === key) {
      last.span += 1;
      return;
    }
    const date = parseIso(day);
    bands.push({
      key,
      label: MONTHS[date.getMonth()],
      start: i + 1,
      span: 1,
      hue: monthHue(day),
    });
  });

  return bands;
}

export function weekdayLetter(iso: string): string {
  return ["S", "M", "T", "W", "T", "F", "S"][parseIso(iso).getDay()];
}

export function formatDate(iso: string): string {
  const date = parseIso(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatDateLong(iso: string): string {
  const date = parseIso(iso);
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatDateShort(iso: string): string {
  const date = parseIso(iso);
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

/** '18:30' -> '6:30 PM'. Returns an em dash for empty values so tables stay aligned. */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

export function daysUntil(iso: string): number {
  const target = parseIso(iso).getTime();
  const today = parseIso(todayIso()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function countdownLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toIso(start), end: toIso(end) };
}

/**
 * Six weeks of dates covering the month, padded to whole Sunday–Saturday rows
 * so the calendar grid is always a stable shape.
 */
export function calendarGrid(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: { iso: string; inMonth: boolean }[] = [];

  for (let i = 0; i < 42; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ iso: toIso(day), inMonth: day.getMonth() === month });
  }
  return cells;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export const WEEKDAY_INITIALS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Reports carry UTC timestamps from Gmail; the office reads them in Eastern.
 * Converting by hand once produced times four hours out, so this always goes
 * through Intl with a named zone, which handles EDT/EST for the actual date.
 */
export function formatEastern(utcIso: string | null | undefined): string {
  if (!utcIso) return "—";
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return utcIso;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function easternNow(): string {
  return formatEastern(new Date().toISOString());
}

/**
 * Timestamps written by nowIso() are UTC stored as 'YYYY-MM-DD HH:MM:SS' with
 * no zone marker, which `new Date()` would read as local time. Mark it as UTC
 * before formatting, so history reads correctly whatever the server's zone.
 */
export function formatStoredTimestamp(stored: string | null | undefined): string {
  if (!stored) return "—";
  return formatEastern(`${stored.replace(" ", "T")}Z`);
}
