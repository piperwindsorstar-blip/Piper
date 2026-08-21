import "server-only";
import { notFound } from "next/navigation";
import { requireUser, type User } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import type { EventWithRefs } from "@/lib/types";

/**
 * Loads an event for the signed-in user. `getEvent` already scopes DJs to their
 * own assignments, so an event they aren't on is indistinguishable from one
 * that doesn't exist.
 */
export async function loadEvent(idParam: string): Promise<{ user: User; event: EventWithRefs }> {
  const id = Number(idParam);
  if (!Number.isInteger(id)) notFound();

  const user = await requireUser();
  const event = getEvent(user, id);
  if (!event) notFound();

  return { user, event };
}
