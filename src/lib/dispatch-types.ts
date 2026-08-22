/**
 * Vehicle kinds and their labels, kept apart from `dispatch.ts`.
 *
 * `dispatch.ts` reaches the database and better-sqlite3 is Node-only, so a
 * Client Component that imports the kind list from it drags the driver into
 * the browser bundle and the build fails. Third time this split has been
 * needed — see `mail-types.ts` and `settings-types.ts`.
 */

export const VEHICLE_KINDS = ["van", "truck", "car", "trailer", "rental"] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export const KIND_LABELS: Record<VehicleKind, string> = {
  van: "Van",
  truck: "Truck",
  car: "Car",
  trailer: "Trailer",
  rental: "Rental",
};
