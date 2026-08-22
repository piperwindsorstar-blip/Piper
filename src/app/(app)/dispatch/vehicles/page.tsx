import { requireAdmin } from "@/lib/auth";
import { KIND_LABELS, listVehicles } from "@/lib/dispatch";
import { formatDate, todayIso } from "@/lib/dates";
import VehicleForm from "../VehicleForm";
import { toggleVehicle } from "../actions";

export default async function FleetPage() {
  await requireAdmin();

  const vehicles = listVehicles(true);
  const active = vehicles.filter((v) => v.active);
  const retired = vehicles.filter((v) => !v.active);
  const today = todayIso();

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Add a vehicle</h2>
        </div>
        <VehicleForm />
      </div>

      {active.map((vehicle) => (
        <details className="card" key={vehicle.id}>
          <summary className="card-head" style={{ listStyle: "none", cursor: "pointer" }}>
            <div>
              <h2>{vehicle.name}</h2>
              <div className="faint small">
                {[
                  KIND_LABELS[vehicle.kind],
                  vehicle.plate,
                  vehicle.capacity_note,
                  vehicle.rental_due ? `back by ${formatDate(vehicle.rental_due)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="venue-badges">
              {vehicle.kind === "rental" && <span className="badge badge-accent">Hired</span>}
              {vehicle.rental_due && vehicle.rental_due < today && (
                <span className="badge badge-cancelled">Overdue</span>
              )}
              <span className="badge badge-plain">Edit</span>
            </div>
          </summary>

          <VehicleForm
            vehicle={{
              id: vehicle.id,
              name: vehicle.name,
              kind: vehicle.kind,
              plate: vehicle.plate,
              rental_from: vehicle.rental_from,
              rental_due: vehicle.rental_due,
              capacity_note: vehicle.capacity_note,
              notes: vehicle.notes,
            }}
          />

          <div className="card-body row-between">
            <div className="small muted">
              Retiring keeps it on every run it has already made — it just stops appearing
              on the board.
            </div>
            <form action={toggleVehicle}>
              <input type="hidden" name="id" value={vehicle.id} />
              <input type="hidden" name="activate" value="0" />
              <button className="btn btn-sm btn-danger" type="submit">
                Retire
              </button>
            </form>
          </div>
        </details>
      ))}

      {active.length === 0 && (
        <div className="card">
          <div className="empty">No vehicles yet.</div>
        </div>
      )}

      {retired.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Retired</h2>
            <span className="badge badge-plain">{retired.length}</span>
          </div>
          <div className="card-body">
            <ul className="stack-list">
              {retired.map((vehicle) => (
                <li key={vehicle.id} className="row-between">
                  <span>
                    {vehicle.name}{" "}
                    <span className="faint small">{KIND_LABELS[vehicle.kind]}</span>
                  </span>
                  <form action={toggleVehicle}>
                    <input type="hidden" name="id" value={vehicle.id} />
                    <input type="hidden" name="activate" value="1" />
                    <button className="btn btn-sm" type="submit">
                      Put it back
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
