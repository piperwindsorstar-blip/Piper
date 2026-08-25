import { redirect } from "next/navigation";

/**
 * Rentals used to live under Dispatch. The link is in people's bookmarks and in
 * the "hire booked" emails already sent, so it keeps working rather than
 * becoming a 404 the week after it moved.
 */
export default function MovedRentals() {
  redirect("/rentals");
}
