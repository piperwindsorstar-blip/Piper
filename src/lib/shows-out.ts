import { callsForDay, runsBetween, weekDays } from "./dispatch";
import { formatDayHeading, formatWeekdayShort, toIso, parseIso } from "./dates";
// Type-only, so nothing from the Client Component reaches the server bundle.
import type { ShowsOutTab } from "@/components/ShowsOut";

/**
 * The three questions the office asks of the same data.
 *
 * What is going out in an hour, what to have ready tonight, and whether the
 * weekend is covered. They are different enough to deserve their own tabs and
 * cheap enough to answer all at once — a week of runs in a shop this size is a
 * few dozen rows — so all three are built here and switched in the browser.
 *
 * The week is the calendar week containing today, not the next seven days. A
 * rolling window would put Saturday in a different place on Wednesday than it
 * was on Monday, and the shop plans in weeks.
 */
export function showsOutTabs(today: string): ShowsOutTab[] {
  const tomorrowDate = parseIso(today);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toIso(tomorrowDate);

  const week = weekDays(today);
  // One query for everything on screen, rather than one per day. The span has
  // to reach whichever of the three ends latest — a Sunday's "tomorrow" falls
  // outside that Sunday's own week.
  const from = week[0] < today ? week[0] : today;
  const to = week[week.length - 1] > tomorrow ? week[week.length - 1] : tomorrow;
  const runs = runsBetween(from, to);

  return [
    {
      key: "today",
      label: "Today",
      heading: "Shows out today",
      days: [{ day: today, label: "Today", calls: callsForDay(runs, today) }],
      empty: "No vehicles out. Shop day.",
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      heading: "Shows out tomorrow",
      days: [
        {
          day: tomorrow,
          label: formatWeekdayShort(tomorrow),
          calls: callsForDay(runs, tomorrow),
        },
      ],
      empty: "Nothing out tomorrow.",
    },
    {
      key: "week",
      label: "This week",
      heading: "Shows out this week",
      days: week.map((day) => ({
        day,
        // "Today" rather than the date, in a list where every other row is a
        // date: the one row somebody is standing in should say so.
        label: day === today ? "Today" : formatDayHeading(day),
        calls: callsForDay(runs, day),
      })),
      empty: "Nothing out this week.",
    },
  ];
}
