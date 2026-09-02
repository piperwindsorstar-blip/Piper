/**
 * The icon set.
 *
 * Inline SVG rather than an icon font or a package: the whole set is about a
 * kilobyte, it inherits `currentColor` so it works in both themes without a
 * second definition, and there is no network request that can fail and leave
 * the nav as a column of empty boxes.
 *
 * One geometry throughout — a 24-unit box, 1.75 stroke, round caps and joins,
 * no fills. Icons drawn to different weights read as a set of stickers rather
 * than a system, and the difference is obvious the moment two sit side by side.
 *
 * Icons here are decoration beside text, so they are `aria-hidden` and a screen
 * reader hears the label alone. An icon that is the *only* content of a control
 * needs its own label on the control — see the remove buttons on the dispatch
 * board.
 */

export type IconName =
  | "dashboard"
  | "calendar"
  | "events"
  | "person"
  | "people"
  | "clipboard"
  | "pin"
  | "truck"
  | "mail"
  | "activity"
  | "settings"
  | "plus"
  | "download"
  | "upload"
  | "copy"
  | "check"
  | "close"
  | "left"
  | "right"
  | "alert"
  | "key"
  | "clock"
  | "link"
  | "music"
  | "megaphone"
  | "phone"
  | "sparkle";

/**
 * Path data only. Every icon is drawn inside the same 24-unit box, so a caller
 * can size the whole set with one number.
 */
const PATHS: Record<IconName, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  events: "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3 3.1-4.8 7-4.8s7 1.8 7 4.8M16.5 11.5a3 3 0 0 0 0-6M18 15.4c2.4.5 4 1.9 4 4.6",
  clipboard: "M9 4h6v3H9zM7 5.5H5.5A1.5 1.5 0 0 0 4 7v12.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H17M8 12h8M8 16h5",
  pin: "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  truck: "M2 6h11v10H2zM13 9h4l3 3.2V16h-7M6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  mail: "M3 5.5h18v13H3zM3 6.5l9 6.5 9-6.5",
  activity: "M3 12h4l2.5-7 4 14 2.5-7h5",
  settings: "M4 7h10M18 7h2M4 12h2M10 12h10M4 17h7M15 17h5M16 5v4M8 10v4M13 15v4",
  plus: "M12 5v14M5 12h14",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19h16",
  upload: "M12 15V4M7.5 8.5 12 4l4.5 4.5M4 19h16",
  copy: "M9 9h11v11H9zM15 9V5H4v11h4",
  check: "M4.5 12.5 9.5 17.5 19.5 6.5",
  close: "M6 6l12 12M18 6 6 18",
  left: "M14.5 5 7.5 12l7 7",
  right: "M9.5 5l7 7-7 7",
  alert: "M12 4.5 21 19.5H3zM12 10v4M12 17h.01",
  key: "M15.5 4a4.5 4.5 0 1 0-4.2 6.1L4 17.4V21h3.6l1-1v-2h2v-2h2l1.7-1.7A4.5 4.5 0 0 0 15.5 4zM16.5 8h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.2l3.2 2",
  link: "M10 13.5 14 9.5M9 7.5l1.8-1.8a3.8 3.8 0 0 1 5.4 5.4L14.4 13M9.6 11 7.8 12.8a3.8 3.8 0 0 0 5.4 5.4L15 16.4",
  music: "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  megaphone: "M3 11 21 6v12L3 14zM11.6 16.8a3 3 0 1 1-5.8-1.6",
  phone: "M7 3H4a1.5 1.5 0 0 0-1.5 1.5C2.5 13.6 10.4 21.5 19.5 21.5A1.5 1.5 0 0 0 21 20v-3l-4-1.5-2 2a15 15 0 0 1-6.5-6.5l2-2z",
  sparkle: "M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9zM18.5 4v3M17 5.5h3",
};

export default function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
