import type { MetadataRoute } from "next";

/**
 * What a phone needs to keep Piper on a home screen.
 *
 * `start_url` is the crew board rather than the dashboard. The people who
 * install this are mostly crew, the board is the page they open, and it works
 * without an account — sending them to a login screen every time they tap the
 * icon would be a good way to make sure nobody installs it twice.
 *
 * Anyone who does have an account lands one tap away, and the board is the
 * right home for them too on a phone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PYNX Dispatch",
    short_name: "Dispatch",
    description: "Which vehicle is where, and who has the keys.",
    start_url: "/board",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f4f8",
    theme_color: "#6d4aff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops its own shape out of this one, so it has no rounding of
      // its own and keeps the letter well inside the safe area.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
