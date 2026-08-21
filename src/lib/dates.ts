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
