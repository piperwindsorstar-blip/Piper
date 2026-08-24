/**
 * Creates the database and fills it with a realistic sample season so the app
 * is explorable the moment it starts. Safe to re-run: it skips if users exist.
 *
 *   npm run db:seed     # create + seed if empty
 *   npm run db:reset    # wipe the file and seed fresh
 */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { createEvent, createVenue } from "../src/lib/events";
import { addSong, saveQuestionnaire, seedDefaultTimeline } from "../src/lib/planning";

const conn = db();

const existing = conn.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
if (existing.n > 0) {
  console.log("Database already has users — nothing to seed. Use `npm run db:reset` to start over.");
  process.exit(0);
}

function addUser(email: string, name: string, role: "admin" | "dj", phone: string, password: string) {
  const result = conn
    .prepare("INSERT INTO users (email, name, phone, role, password_hash) VALUES (?, ?, ?, ?, ?)")
    .run(email, name, phone, role, hashPassword(password));
  return Number(result.lastInsertRowid);
}

const owner = addUser("owner@piper.test", "Sam Rivera", "admin", "555-0100", "piper1234");
const office = addUser("office@piper.test", "Dana Cole", "admin", "555-0101", "piper1234");
const djJordan = addUser("jordan@piper.test", "Jordan Blake", "dj", "555-0102", "piper1234");
const djMina = addUser("mina@piper.test", "Mina Osei", "dj", "555-0103", "piper1234");

// Staff records, so the staff pages have something to show.
conn
  .prepare(
    "UPDATE users SET emergency_contact = ?, start_date = ?, gear = ?, staff_notes = ? WHERE id = ?",
  )
  .run(
    "Priya Blake (partner) — 555-0190",
    "2021-04-12",
    "Pioneer DDJ-1000, 2x QSC K12.2, 4x uplights, 2x wireless handheld",
    "Strongest on big dance floors. Prefers reception-only bookings. Has his own van.",
    djJordan,
  );

conn
  .prepare(
    "UPDATE users SET emergency_contact = ?, start_date = ?, gear = ?, staff_notes = ? WHERE id = ?",
  )
  .run(
    "Kwame Osei (brother) — 555-0191",
    "2023-08-01",
    "Denon Prime 4, 2x RCF ART 912, ceremony PA and lav kit",
    "Excellent with ceremonies and bilingual events. Happy to take short-notice work.",
    djMina,
  );

conn
  .prepare("UPDATE users SET start_date = ?, staff_notes = ? WHERE id = ?")
  .run("2019-01-15", "Runs the books and answers the inbox.", office);

const lakeside = createVenue({
  name: "Lakeside Pavilion",
  address: "18 Shoreline Dr",
  city: "Kingston",
  contact_name: "Priya Raman",
  contact_email: "events@lakesidepavilion.test",
  contact_phone: "555-0140",
  load_in_notes: "Load in through the north service door. Two 20A circuits on the stage wall.\nHard music curfew at 1:00 AM.",
});

const grandOak = createVenue({
  name: "The Grand Oak Barn",
  address: "4420 County Rd 9",
  city: "Perth",
  contact_name: "Will Tanaka",
  contact_email: "hello@grandoakbarn.test",
  contact_phone: "555-0141",
  load_in_notes: "Gravel lot — bring the cart with big wheels. Generator power only until 4 PM.",
});

const harbourHall = createVenue({
  name: "Harbour Hall",
  address: "77 Dockside Ave",
  city: "Kingston",
  contact_name: "Elise Fournier",
  contact_email: "bookings@harbourhall.test",
  contact_phone: "555-0142",
  load_in_notes: "Freight elevator to the 3rd floor. Sound limiter on the house system — bring your own PA.",
});

/**
 * Weddings land on Saturdays, so the demo season is built from the coming
 * Saturday rather than raw day offsets — and it stays current whenever you seed.
 */
function saturdayIn(weeks: number): string {
  const date = new Date();
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7) + weeks * 7);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const events = [
  {
    status: "confirmed" as const,
    partner_one_name: "Ava Nakamura",
    partner_two_name: "Rosa Delgado",
    contact_email: "ava.and.rosa@example.test",
    contact_phone: "555-0170",
    event_date: saturdayIn(2),
    load_in_time: "14:00",
    ceremony_time: "16:00",
    cocktail_time: "17:00",
    reception_time: "18:30",
    end_time: "01:00",
    venue_id: lakeside,
    venue_room: "Waterfront Terrace",
    guest_count: 140,
    package_name: "Ceremony + Reception, uplighting, dance floor wash",
    assigned_dj_id: djJordan,
    internal_notes: "Rosa's father is giving a long toast — keep a wireless handheld charged.",
  },
  {
    status: "confirmed" as const,
    partner_one_name: "Theo Brennan",
    partner_two_name: "Maya Brennan-Ross",
    contact_email: "theo.maya@example.test",
    contact_phone: "555-0171",
    event_date: saturdayIn(4),
    load_in_time: "13:00",
    ceremony_time: "15:30",
    cocktail_time: "16:30",
    reception_time: "18:00",
    end_time: "00:30",
    venue_id: grandOak,
    venue_room: null,
    guest_count: 95,
    package_name: "Reception only",
    assigned_dj_id: djMina,
    internal_notes: "Outdoor ceremony with a rain call by noon. Barn has no cell service — use the radio.",
  },
  {
    status: "tentative" as const,
    partner_one_name: "Priya Shah",
    partner_two_name: "Daniel Okonkwo",
    contact_email: "shah.okonkwo@example.test",
    contact_phone: "555-0172",
    event_date: saturdayIn(4),
    load_in_time: "15:00",
    ceremony_time: null,
    cocktail_time: "17:30",
    reception_time: "19:00",
    end_time: "01:00",
    venue_id: harbourHall,
    venue_room: "Third floor ballroom",
    guest_count: 210,
    package_name: "Reception + late-night set",
    assigned_dj_id: null,
    internal_notes: "Same date as the Brennan wedding — needs a second DJ before we confirm.",
  },
  {
    status: "confirmed" as const,
    partner_one_name: "Grace Whitfield",
    partner_two_name: "Owen Whitfield",
    contact_email: "gw.ow@example.test",
    contact_phone: "555-0173",
    event_date: saturdayIn(8),
    load_in_time: "12:30",
    ceremony_time: "14:00",
    cocktail_time: "15:00",
    reception_time: "17:00",
    end_time: "23:30",
    venue_id: lakeside,
    venue_room: "Great Room",
    guest_count: 80,
    package_name: "Ceremony + Reception",
    assigned_dj_id: djJordan,
    internal_notes: null,
  },
  {
    status: "completed" as const,
    partner_one_name: "Lena Kowalski",
    partner_two_name: "Ines Marchetti",
    contact_email: "lena.ines@example.test",
    contact_phone: "555-0174",
    event_date: saturdayIn(-3),
    load_in_time: "14:30",
    ceremony_time: "16:30",
    cocktail_time: "17:30",
    reception_time: "19:00",
    end_time: "01:00",
    venue_id: harbourHall,
    venue_room: "Third floor ballroom",
    guest_count: 160,
    package_name: "Ceremony + Reception, photo booth",
    assigned_dj_id: djMina,
    internal_notes: "Great night. Venue wants us back — Elise asked for our card.",
  },
];

const ids = events.map((event) => createEvent(event));

// Flesh out the first wedding so the planning pages have something to show.
const [first] = ids;
seedDefaultTimeline(first);

const picks: [string, string, string | null, "team" | "client"][] = [
  ["bridal_party_processional", "Canon in D", "Pachelbel", "client"],
  ["recessional", "Signed, Sealed, Delivered", "Stevie Wonder", "client"],
  ["grand_entrance_couple", "Feel It Still", "Portugal. The Man", "client"],
  ["first_dance", "Lover", "Taylor Swift", "client"],
  ["father_daughter", "Landslide", "Fleetwood Mac", "client"],
  ["cake_cutting", "Sugar, Sugar", "The Archies", "team"],
  ["must_play", "September", "Earth, Wind & Fire", "client"],
  ["must_play", "Dancing Queen", "ABBA", "client"],
  ["must_play", "Cupid Shuffle", "Cupid", "client"],
  ["do_not_play", "Chicken Dance", null, "client"],
  ["do_not_play", "Macarena", "Los del Río", "client"],
  ["last_dance", "Closing Time", "Semisonic", "team"],
  ["cocktail", "Golden Hour", "Kacey Musgraves", "team"],
  ["dinner", "Fly Me to the Moon", "Frank Sinatra", "team"],
];

for (const [category, title, artist, source] of picks) {
  addSong({ event_id: first, category, title, artist, cue: null, link: null, notes: null, source });
}

saveQuestionnaire(first, {
  preferred_genres: "Motown, 90s hip hop, current pop, a little disco",
  avoid_genres: "No country, no heavy EDM",
  vibe_notes:
    "We want people dancing from the first song after dinner. Keep it fun, not cheesy — skip the line dances except the Cupid Shuffle.",
  announcements: "Rosa's grandmother is Abuela Delgado (deh-GAH-do). Shuttle leaves at 12:45 AM sharp.",
  wedding_party: "Kai & Priya\nMarcus & Jen\nSofia & Andre",
  mic_needs: "Officiant, two toasts, one reading during the ceremony",
  request_policy: "Requests are welcome — read the room",
  contact_on_day: "Kai Nakamura (maid of honour) — 555-0180",
  dedications: "Grandma Delgado — 'At Last' by Etta James, during dinner",
  last_name_taken: "Nakamura-Delgado",
  arrival_time: "2:00 PM",
  mc_name: "Kai Nakamura (maid of honour)",
  bridesmaids: "4",
  groomsmen: "4",
  venue_phone: "555-0140",
  coordinator_email: "events@lakesidepavilion.test",
  table_reserved: "Yes",
  space_reserved: "Yes",
  power_each_space: "Yes — two 20A circuits on the stage wall",
  outdoor_portions: "Ceremony on the terrace, reception inside",
  uplight_colours: "Warm amber",
  photobooth_hours: "N/A",
  playlist_pre_ceremony: null,
  playlist_cocktail: null,
  playlist_dinner: null,
  playlist_dance: null,
});

conn.prepare("UPDATE events SET plan_submitted_at = datetime('now') WHERE id = ?").run(first);

/* ------------------------------------------------------------ dispatch */

// A small fleet, so the dispatch board shows something on a fresh install
// rather than an empty grid that gives no sense of what it is for.
const vehicles = [
  // The classes Pynx hires from Pencar, and the one van it owns. Three of each
  // hired class can be out at once; there is only one Pynx Cargo.
  {
    name: "Cargo van",
    class: "cargo_van",
    ownership: "pencar",
    slots: 3,
    weight_capacity: "3500 lb",
    passenger_capacity: 2,
    capacity_note: "Ceremony kit and speakers",
  },
  {
    name: "Cube van",
    class: "cube_van",
    ownership: "pencar",
    slots: 3,
    weight_capacity: "1 ton",
    passenger_capacity: 3,
    capacity_note: "Full rig plus booth",
  },
  {
    name: "26 ft truck",
    class: "truck_26",
    ownership: "pencar",
    slots: 3,
    weight_capacity: "5 ton",
    passenger_capacity: 3,
    capacity_note: "Big loads, busy weekends",
  },
  {
    name: "Passenger vehicle",
    class: "passenger",
    ownership: "pencar",
    slots: 3,
    weight_capacity: null,
    passenger_capacity: 5,
    capacity_note: "Crew only",
  },
  {
    name: "Mini van",
    class: "mini_van",
    ownership: "pencar",
    slots: 3,
    weight_capacity: null,
    passenger_capacity: 7,
    capacity_note: "Crew and small kit",
  },
  {
    name: "Pynx Cargo",
    class: "cargo_van",
    ownership: "other",
    slots: 1,
    weight_capacity: "3500 lb",
    passenger_capacity: 2,
    capacity_note: "Ours — always available",
  },
].map((v) =>
  Number(
    conn
      .prepare(
        `INSERT INTO vehicles
           (name, class, ownership, plate, home_base, weight_capacity, passenger_capacity,
            rental_from, rental_due, capacity_note, notes, slots)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        v.name,
        v.class,
        v.ownership,
        null,
        "Shop",
        v.weight_capacity,
        v.passenger_capacity,
        null,
        null,
        v.capacity_note,
        null,
        v.slots,
      )
      .lastInsertRowid,
  ),
);

const addRun = conn.prepare(
  `INSERT INTO dispatch_runs
     (vehicle_id, event_id, label, status, starts_on, ends_on, meet_time, crew, site,
      driver_id, keys_with)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

// Two weddings covered, one hire held over the weekend, and one Saturday
// flagged as needing a vehicle nobody has booked — so a fresh install shows
// what the board is actually for.
addRun.run(vehicles[0], ids[0], "Nakamura & Delgado", "booked", saturdayIn(2), saturdayIn(2),
  "13:00", "Jordan, Eric", "Lakeside", djJordan, "Jordan");
addRun.run(vehicles[1], ids[1], "Brennan & Brennan-Ross", "booked", saturdayIn(4), saturdayIn(4),
  "12:30", "Mina", "Grand Oak", djMina, "Mina");
addRun.run(vehicles[2], null, "Held for the weekend", "booked", saturdayIn(2), saturdayIn(3),
  null, null, null, null, "Shop");
addRun.run(vehicles[1], null, "Second show, no van yet", "needed", saturdayIn(2), saturdayIn(2),
  null, null, "Harbour Hall", null, null);

// A little of the plan too, so the Gantt shows what it is for rather than an
// empty grid. Deliberately not the same days as the runs above: the point of
// the Gantt is that it is a separate surface.
const addCell = conn.prepare(
  `INSERT INTO gantt_cells (vehicle_id, state, starts_on, ends_on, note) VALUES (?, ?, ?, ?, ?)`,
);
addCell.run(vehicles[1], "booked", saturdayIn(6), saturdayIn(6), "Festival weekend");
addCell.run(vehicles[2], "needed", saturdayIn(6), saturdayIn(6), "Three shows");
addCell.run(vehicles[0], "idle", saturdayIn(8), saturdayIn(8), null);

console.log(`Seeded ${ids.length} events, 3 venues, 6 vehicles and 4 users.`);
console.log("");
console.log("  Sign in with any of these (password: piper1234)");
console.log("    owner@piper.test    Sam Rivera    admin");
console.log("    office@piper.test   Dana Cole     admin");
console.log("    jordan@piper.test   Jordan Blake  DJ");
console.log("    mina@piper.test     Mina Osei     DJ");
