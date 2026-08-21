import { STATUS_LABELS, type EventStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: EventStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}
