import { db } from "./db";

export type ReportKind = "dj" | "warehouse";
export type ManifestStatus = "yes" | "no" | "na";

export type CrewReport = {
  id: number;
  kind: ReportKind;
  report_type: string | null;
  job_raw: string;
  job_norm: string;
  crew_raw: string | null;
  sent_at: string;
  vdp: string | null;
  rating_client: number | null;
  rating_crowd: number | null;
  rating_staff: number | null;
  quality: number | null;
  manifest: ManifestStatus | null;
  manifest_override: "yes" | "no" | null;
  notes: string | null;
  is_test: number;
  source_id: string | null;
  created_at: string;
};

/**
 * Normalise a Job # to a canonical two-digit year + four-digit sequence.
 *
 * DJ reports usually arrive without a dash ("260647"), warehouse reports with
 * one ("26-0647"). Comparing digit strings naively misses the case where a
 * dash-less number dropped its leading zero — "26647" must still line up with
 * "26-0647". Ported unchanged from the Crew Report Tracker; do not "simplify".
 */
export function normalizeJob(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  if (!s) return "";

  if (s.includes("-")) {
    const idx = s.indexOf("-");
    const yearDigits = s.slice(0, idx).replace(/\D/g, "");
    const seqDigits = s.slice(idx + 1).replace(/\D/g, "");
    const year = (yearDigits || "0").padStart(2, "0").slice(-2);
    const seq = (seqDigits || "0").padStart(4, "0");
    return year + seq;
  }

  const digits = s.replace(/\D/g, "");
  if (!digits) return s.toUpperCase(); // non-numeric placeholders pass through
  const year = digits.slice(0, 2).padStart(2, "0");
  const seq = digits.slice(2).padStart(4, "0");
  return year + seq;
}

/**
 * Test/practice submissions, kept out of matching, crew stats and quality.
 *
 * Detection is deliberately driven by the job number — a placeholder like
 * 00-0000, or non-numeric junk in the field. Scanning notes for the word "test"
 * was tried and rejected: a real report reading "sound test ran long" would be
 * silently dropped from a crew member's record. Free-text fields only count
 * when the *entire* value is a throwaway marker.
 */
const THROWAWAY = /^(test|testing|tester|practice|ignore|n\/a|na|asdf|xxx)$/i;

export function looksLikeTest(jobRaw: string, crewRaw?: string | null, notes?: string | null): boolean {
  const norm = normalizeJob(jobRaw);
  if (/^00/.test(norm)) return true;      // 00-0000, 00-1234 …
  if (!/^\d+$/.test(norm)) return true;   // "Im testing some shit"
  return THROWAWAY.test((notes ?? "").trim()) || THROWAWAY.test((crewRaw ?? "").trim());
}

/* -------------------------------------------------------------- crew names */

/** Crew is free text: "Piper, eric", "Juice Addison", "Desiree & Christian". */
export function splitCrew(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = raw.replace(/&/g, ",").replace(/ and /gi, ",").replace(/\//g, ",");
  const tokens: string[] = [];
  s.split(",").forEach((part) => {
    part
      .trim()
      .split(/\s+/)
      .forEach((w) => {
        if (w) tokens.push(w);
      });
  });
  return tokens;
}

export function aliasMap(): Map<string, string> {
  const rows = db().prepare("SELECT alias, canonical FROM crew_aliases").all() as {
    alias: string;
    canonical: string;
  }[];
  return new Map(rows.map((r) => [r.alias.trim().toLowerCase(), r.canonical]));
}

export function resolveCanonical(rawName: string, aliases: Map<string, string>): string {
  return aliases.get(rawName.trim().toLowerCase()) ?? rawName.trim();
}

/* ------------------------------------------------------------------ queries */

export function allReports(includeTest = false): CrewReport[] {
  return db()
    .prepare(
      `SELECT * FROM crew_reports ${includeTest ? "" : "WHERE is_test = 0"} ORDER BY sent_at DESC`,
    )
    .all() as CrewReport[];
}

export function reportsOfKind(kind: ReportKind): CrewReport[] {
  return db()
    .prepare("SELECT * FROM crew_reports WHERE kind = ? AND is_test = 0 ORDER BY sent_at DESC")
    .all(kind) as CrewReport[];
}

export function testReports(): CrewReport[] {
  return db()
    .prepare("SELECT * FROM crew_reports WHERE is_test = 1 ORDER BY sent_at DESC")
    .all() as CrewReport[];
}

/** A manual correction beats whatever the email said, or didn't say. */
export function effectiveManifest(report: CrewReport): ManifestStatus {
  return report.manifest_override ?? report.manifest ?? "na";
}

export type Groups = {
  djByJob: Map<string, CrewReport[]>;
  whByJob: Map<string, CrewReport[]>;
  matchedPairs: { dj: CrewReport; wh: CrewReport }[];
};

/** Every view derives from this, so the tabs can never disagree with each other. */
export function computeGroups(): Groups {
  const djByJob = new Map<string, CrewReport[]>();
  const whByJob = new Map<string, CrewReport[]>();

  for (const r of allReports()) {
    const target = r.kind === "dj" ? djByJob : whByJob;
    const list = target.get(r.job_norm) ?? [];
    list.push(r);
    target.set(r.job_norm, list);
  }

  const matchedPairs: { dj: CrewReport; wh: CrewReport }[] = [];
  for (const [jobNorm, djList] of djByJob) {
    const whList = whByJob.get(jobNorm);
    if (!whList) continue;
    for (const dj of djList) for (const wh of whList) matchedPairs.push({ dj, wh });
  }

  return { djByJob, whByJob, matchedPairs };
}

/* --------------------------------------------------------------- crew stats */

export type CrewStat = {
  display: string;
  shows: number;
  signed: number;
  notSigned: number;
  notAsked: number;
  noReport: number;
  jobs: string[];
  manifestPct: number | null;
  avgQuality: number | null;
};

export function computeCrewStats(): CrewStat[] {
  const { whByJob } = computeGroups();
  const aliases = aliasMap();
  const stats = new Map<string, Omit<CrewStat, "manifestPct" | "avgQuality"> & {
    qualitySum: number;
    qualityCount: number;
  }>();

  for (const report of reportsOfKind("dj")) {
    for (const rawName of splitCrew(report.crew_raw)) {
      const canonical = resolveCanonical(rawName, aliases);
      const key = canonical.toLowerCase();
      const st =
        stats.get(key) ??
        {
          display: canonical,
          shows: 0,
          signed: 0,
          notSigned: 0,
          notAsked: 0,
          noReport: 0,
          jobs: [] as string[],
          qualitySum: 0,
          qualityCount: 0,
        };

      st.display = canonical;
      st.shows += 1;
      st.jobs.push(report.job_raw);

      const matches = whByJob.get(report.job_norm);
      if (!matches) {
        st.noReport += 1;
      } else {
        const first = matches[0];
        const manifest = effectiveManifest(first);
        if (manifest === "yes") st.signed += 1;
        else if (manifest === "no") st.notSigned += 1;
        else st.notAsked += 1;

        if (first.quality != null && !Number.isNaN(first.quality)) {
          st.qualitySum += first.quality;
          st.qualityCount += 1;
        }
      }

      stats.set(key, st);
    }
  }

  return [...stats.values()]
    .map((st) => {
      // Completion is measured against manifests actually asked about — jobs
      // where the form didn't ask, or no warehouse report has come back, aren't
      // held against the crew member.
      const asked = st.signed + st.notSigned;
      return {
        display: st.display,
        shows: st.shows,
        signed: st.signed,
        notSigned: st.notSigned,
        notAsked: st.notAsked,
        noReport: st.noReport,
        jobs: st.jobs,
        manifestPct: asked ? (st.signed / asked) * 100 : null,
        avgQuality: st.qualityCount ? st.qualitySum / st.qualityCount : null,
      };
    })
    .sort((a, b) => b.shows - a.shows);
}

/* --------------------------------------------------------- warehouse quality */

export type MonthQuality = {
  key: string;
  count: number;
  avg: number;
  tiers: Record<number, number>;
  signed: number;
  notSigned: number;
  notAsked: number;
};

export function computeMonthlyQuality(): MonthQuality[] {
  const byMonth = new Map<string, MonthQuality & { sumQ: number }>();

  for (const r of reportsOfKind("warehouse")) {
    const key = r.sent_at ? r.sent_at.slice(0, 7) : "unknown";
    const bucket =
      byMonth.get(key) ??
      { key, count: 0, avg: 0, sumQ: 0, tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, signed: 0, notSigned: 0, notAsked: 0 };

    bucket.count += 1;
    if (r.quality != null) {
      bucket.sumQ += r.quality;
      bucket.tiers[r.quality] = (bucket.tiers[r.quality] ?? 0) + 1;
    }

    const manifest = effectiveManifest(r);
    if (manifest === "yes") bucket.signed += 1;
    else if (manifest === "no") bucket.notSigned += 1;
    else bucket.notAsked += 1;

    byMonth.set(key, bucket);
  }

  return [...byMonth.values()]
    .map((b) => ({ ...b, avg: b.count ? b.sumQ / b.count : 0 }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/* -------------------------------------------------------------- job ↔ event */

/** Weddings that carry a job number, so a report can link through to one. */
export function eventIdsByJobNorm(): Map<string, number> {
  const rows = db()
    .prepare("SELECT id, job_number FROM events WHERE job_number IS NOT NULL AND job_number != ''")
    .all() as { id: number; job_number: string }[];
  return new Map(rows.map((r) => [normalizeJob(r.job_number), r.id]));
}
