"use client";

import { useState } from "react";
import type { Call } from "@/lib/dispatch-types";
import CallCard from "@/components/CallCard";

export type ShowsOutDay = { day: string; label: string; calls: Call[] };
export type ShowsOutTab = {
  key: string;
  /** On the tab itself: one word, because there are three of them on a phone. */
  label: string;
  /** Over the list: the sentence the tab is answering. */
  heading: string;
  days: ShowsOutDay[];
  /** What to say when the tab has nothing in it. */
  empty: string;
};

/**
 * Shows out — today, tomorrow, or the week.
 *
 * The office asks three questions of the same data and they want different
 * answers: what is going out in an hour, what to have ready tonight, and
 * whether Saturday is covered. All three are computed on the server and
 * switched here, so moving between them costs nothing and never shows a
 * loading state — there are at most a week's calls in a shop this size.
 *
 * Today is a flat list. The week is grouped by day, because "Saturday" is the
 * unit somebody is actually asking about; and a day with nothing on it still
 * gets a line, since an absent Thursday reads as an oversight rather than a
 * quiet day.
 */
export default function ShowsOut({ tabs }: { tabs: ShowsOutTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!tab) return null;

  const anything = tab.days.some((d) => d.calls.length > 0);

  return (
    <div className="shows-out">
      <div className="shows-out-head">
        <h2>{tab.heading}</h2>
        <div className="shows-out-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab.key}
              className={t.key === tab.key ? "is-on" : undefined}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!anything ? (
        <p className="today-empty">{tab.empty}</p>
      ) : tab.days.length === 1 ? (
        <div className="today-calls">
          {tab.days[0].calls.map((call) => (
            <CallCard key={call.key} call={call} onDay={tab.days[0].day} linkEvents />
          ))}
        </div>
      ) : (
        <div className="shows-out-days">
          {tab.days.map((group) => (
            <section key={group.day}>
              <h3 className="today-eyebrow">{group.label}</h3>
              {group.calls.length === 0 ? (
                <p className="shows-out-quiet">Nothing out.</p>
              ) : (
                <div className="today-calls">
                  {group.calls.map((call) => (
                    <CallCard key={call.key} call={call} onDay={group.day} compact linkEvents />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
