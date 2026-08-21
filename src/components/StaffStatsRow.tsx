import { countdownLabel, formatDate } from "@/lib/dates";
import type { StaffStats } from "@/lib/team";

/** The same four workload numbers, used on the roster, staff page and /me. */
export default function StaffStatsRow({ stats }: { stats: StaffStats }) {
  return (
    <div className="meta-list">
      <div className="meta-item">
        <div className="meta-label">Upcoming</div>
        <div className="meta-value">{stats.upcoming}</div>
      </div>
      <div className="meta-item">
        <div className="meta-label">Played</div>
        <div className="meta-value">{stats.completed}</div>
      </div>
      <div className="meta-item">
        <div className="meta-label">Next gig</div>
        <div className="meta-value">
          {stats.nextDate ? (
            <>
              {formatDate(stats.nextDate)}
              <div className="faint small">{countdownLabel(stats.nextDate)}</div>
            </>
          ) : (
            <span className="faint">Nothing booked</span>
          )}
        </div>
      </div>
      <div className="meta-item">
        <div className="meta-label">Last gig</div>
        <div className="meta-value">
          {stats.lastDate ? formatDate(stats.lastDate) : <span className="faint">—</span>}
        </div>
      </div>
    </div>
  );
}
