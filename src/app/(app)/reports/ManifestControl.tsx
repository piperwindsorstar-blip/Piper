import { setManifest } from "./actions";
import type { CrewReport } from "@/lib/reports";
import { effectiveManifest } from "@/lib/reports";

/**
 * Shows the effective manifest status and lets an admin correct it. The label
 * says where the value came from, so a manual correction is never mistaken for
 * something the crew actually reported.
 */
export default function ManifestControl({ report }: { report: CrewReport }) {
  const effective = effectiveManifest(report);
  const overridden = report.manifest_override !== null;
  const source = overridden
    ? "Manually set"
    : report.manifest === "na" || report.manifest === null
      ? "Not asked in email"
      : "From email";

  return (
    <div>
      <form action={setManifest} className="inline-form">
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="value" value={effective === "yes" ? "no" : "yes"} />
        <button
          type="submit"
          className={`badge ${effective === "yes" ? "badge-confirmed" : "badge-cancelled"}`}
          style={{ border: "none", cursor: "pointer", font: "inherit" }}
        >
          {effective === "yes" ? "Signed" : "Not signed"}
        </button>
      </form>
      <div className="faint small">
        {source}
        {overridden && (
          <form action={setManifest} className="inline-form">
            <input type="hidden" name="id" value={report.id} />
            <input type="hidden" name="value" value="" />
            <button
              type="submit"
              className="linklike"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                marginLeft: "0.4rem",
                color: "var(--accent-text)",
                textDecoration: "underline",
                cursor: "pointer",
                font: "inherit",
                fontSize: "0.78rem",
              }}
            >
              reset
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
