"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

function refresh(): void {
  for (const path of ["", "/dj", "/warehouse", "/crew", "/quality", "/aliases", "/test"]) {
    revalidatePath(`/reports${path}`);
  }
}

/**
 * Records what you actually confirmed, overriding whatever the email said.
 * Stored in the database rather than the browser, so a correction is visible to
 * everyone and survives a new device — the tracker kept these in localStorage,
 * where they were only ever yours.
 */
export async function setManifest(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  const value = String(formData.get("value") ?? "");
  const next = value === "yes" || value === "no" ? value : null;

  db().prepare("UPDATE crew_reports SET manifest_override = ? WHERE id = ?").run(next, id);
  refresh();
}

export async function addAlias(formData: FormData): Promise<void> {
  await requireAdmin();

  const alias = String(formData.get("alias") ?? "").trim();
  const canonical = String(formData.get("canonical") ?? "").trim();
  if (!alias || !canonical) return;
  // Pointing a name at itself would just be noise in the list.
  if (alias.toLowerCase() === canonical.toLowerCase()) return;

  db()
    .prepare(
      `INSERT INTO crew_aliases (alias, canonical) VALUES (?, ?)
       ON CONFLICT(alias) DO UPDATE SET canonical = excluded.canonical`,
    )
    .run(alias, canonical);
  refresh();
}

export async function removeAlias(formData: FormData): Promise<void> {
  await requireAdmin();
  db().prepare("DELETE FROM crew_aliases WHERE alias = ?").run(String(formData.get("alias") ?? ""));
  refresh();
}
