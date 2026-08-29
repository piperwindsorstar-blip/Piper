import { requireArea } from "@/lib/auth";
import ForwardForm from "./ForwardForm";

export default async function ForwardPage() {
  await requireArea("reports", "view");

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Forward a report</h2>
          <div className="faint small">
            For the one that came to the wrong address, or arrived while the sync was off.
            Paste it here and Piper files it exactly as the nightly import would.
          </div>
        </div>
      </div>
      <div className="card-body">
        <ForwardForm />
      </div>
    </div>
  );
}
