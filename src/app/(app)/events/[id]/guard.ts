import "server-only";
import { notFound } from "next/navigation";
import { requireArea, type User } from "@/lib/auth";
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

  // The section as well as the row. `getEvent` already hides a wedding a DJ is
  // not on, but somebody with no access to weddings at all should not reach one
  // by pasting its address either.
  const user = await requireArea("weddings", "view");
  const event = getEvent(user, id);
  if (!event) notFound();

  return { user, event };
}
