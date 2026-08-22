import type { MetadataRoute } from "next";

/**
 * Piper is a private workspace, and the one page that renders without an
 * account — the crew board — is public by link rather than public to the
 * world. Nothing here should be crawled.
 *
 * The page carries its own noindex tag as well. This file is the coarser
 * instrument: a crawler that never fetches the page cannot index it whatever
 * the page says.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
