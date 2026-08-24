/**
 * End-to-end smoke test. Drives a real browser against a running Piper server
 * and checks the flows that matter: auth, role scoping, event creation, music,
 * timeline, and the couple's planner link.
 *
 *   npm run build && npm run start     # in one shell
 *   npm run smoke                      # in another
 *
 * Assumes the seeded demo data (`npm run db:reset`). Override the target with
 * PIPER_URL, and the browser with PLAYWRIGHT_CHROMIUM_PATH if Playwright's own
 * download isn't available.
 */
import { chromium } from "playwright";
import ExcelJS from "exceljs";

const BASE = process.env.PIPER_URL ?? "http://localhost:3000";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
  : {};
const browser = await chromium.launch(launchOptions);

async function signIn(email, password = "piper1234") {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type=submit]');
  try {
    await page.waitForURL("**/dashboard", { timeout: 15000 });
  } catch (err) {
    console.log("   signIn stuck — url:", page.url());
    const alert = await page.locator(".alert-error").count();
    console.log("   error alert:", alert ? await page.textContent(".alert-error") : "(none)");
    throw err;
  }
  return { ctx, page };
}

/* ---------- 1. bad credentials ---------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "owner@piper.test");
  await page.fill("#password", "wrongpass");
  await page.click('button[type=submit]');
  await page.waitForSelector(".alert-error", { timeout: 10000 });
  check("bad password is rejected", page.url().includes("/login"));
  await ctx.close();
}

/* ---------- 2. admin dashboard ---------- */
const admin = await signIn("owner@piper.test");
{
  const body = await admin.page.textContent("body");
  check("admin dashboard loads", body.includes("Dashboard"));
  check("admin sees seeded couple", body.includes("Ava Nakamura"));
  check("double-booking warning shown", body.includes("more than one event booked"), "seeded clash on day 26");
}

/* ---------- 3. calendar ---------- */
{
  await admin.page.goto(`${BASE}/calendar`);
  const cells = await admin.page.locator(".cal-cell").count();
  check("calendar renders 6 full weeks", cells === 42, `${cells} cells`);

  // The seeded clash is a few weeks out; walk forward until the month holding it.
  let over = 0;
  let monthBody = "";
  const now = new Date();
  for (let ahead = 0; ahead <= 3 && over === 0; ahead++) {
    const month = new Date(now.getFullYear(), now.getMonth() + ahead, 1);
    await admin.page.goto(`${BASE}/calendar?year=${month.getFullYear()}&month=${month.getMonth()}`);
    over = await admin.page.locator(".cal-cell.overbooked").count();
    monthBody = await admin.page.textContent("body");
  }
  check("overbooked day is flagged", over >= 1, `${over} flagged`);
  check("clashing events both appear", monthBody.includes("Theo Brennan") && monthBody.includes("Priya Shah"));
}

/* ---------- 4. create an event ---------- */
let newEventUrl;
{
  await admin.page.goto(`${BASE}/events/new`);
  await admin.page.fill("#partner_one_name", "Test Partner");
  await admin.page.fill("#partner_two_name", "Second Partner");
  await admin.page.fill("#event_date", "2027-09-18");
  await admin.page.selectOption("#status", "confirmed");
  await admin.page.fill("#contact_email", "a@b");
  await admin.page.click('button:has-text("Create event")');
  await admin.page.waitForSelector(".alert-error", { timeout: 10000 });
  check("server rejects malformed email that HTML5 allows", (await admin.page.textContent(".alert-error")).includes("valid contact email"));

  const keptName = await admin.page.inputValue("#partner_one_name");
  const keptDate = await admin.page.inputValue("#event_date");
  const keptStatus = await admin.page.inputValue("#status");
  check(
    "rejected submit keeps what was typed",
    keptName === "Test Partner" && keptDate === "2027-09-18" && keptStatus === "confirmed",
    `name=${keptName} date=${keptDate} status=${keptStatus}`,
  );

  await admin.page.fill("#contact_email", "test@example.test");
  await admin.page.click('button:has-text("Create event")');
  await admin.page.waitForURL(/\/events\/\d+$/, { timeout: 15000 });
  newEventUrl = admin.page.url();
  const body = await admin.page.textContent("body");
  check("event created and shown", body.includes("Test Partner") && body.includes("Second Partner"));
}

/* ---------- 5. music ---------- */
{
  await admin.page.goto(`${newEventUrl}/music`);
  const form = admin.page.locator('form:has(input[name="category"][value="must_play"])');
  await form.locator('input[name="title"]').fill("Superstition");
  await form.locator('input[name="artist"]').fill("Stevie Wonder");
  await form.locator('button[type=submit]').click();
  await admin.page.waitForTimeout(1200);
  check("song added to must-play", (await admin.page.textContent("body")).includes("Superstition"));

  const single = admin.page.locator('form:has(input[name="category"][value="first_dance"])');
  await single.locator('input[name="title"]').fill("First Choice");
  await single.locator('button[type=submit]').click();
  await admin.page.waitForTimeout(1200);
  await admin.page.locator('form:has(input[name="category"][value="first_dance"]) input[name="title"]').fill("Second Choice");
  await admin.page.locator('form:has(input[name="category"][value="first_dance"]) button[type=submit]').click();
  await admin.page.waitForTimeout(1200);
  const body = await admin.page.textContent("body");
  check("single slot replaces rather than stacks", body.includes("Second Choice") && !body.includes("First Choice"));
}

/* ---------- 6. timeline ---------- */
{
  await admin.page.goto(`${newEventUrl}/timeline`);
  await admin.page.click('button:has-text("Start from standard order")');
  await admin.page.waitForTimeout(1500);
  const items = await admin.page.locator(".time-line").count();
  check("standard timeline seeded", items === 15, `${items} items`);
  const seedBtn = await admin.page.locator('button:has-text("Start from standard order")').count();
  check("seed button hidden once populated", seedBtn === 0);
}

/* ---------- 7. planner token ---------- */
let token;
{
  await admin.page.goto(newEventUrl);
  const link = await admin.page.locator('input[readonly]').inputValue();
  token = link.split("/plan/")[1];
  check("planner link generated", !!token && token.length === 32, token);
}

/* ---------- 8. couple's planner, no login ---------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/plan/${token}`);
  const body = await page.textContent("body");
  check("planner opens without login", body.includes("Test Partner"));
  check("planner hides internal notes", !body.includes("Internal notes"));

  const mp = page.locator('form:has(input[name="category"][value="must_play"])');
  await mp.locator('input[name="title"]').fill("Couple Request Song");
  await mp.locator('button[type=submit]').click();
  await page.waitForTimeout(1200);
  check("couple can add a song", (await page.textContent("body")).includes("Couple Request Song"));

  const djSong = page.locator('.song-line:has-text("Superstition")');
  const removable = await djSong.locator("button").count();
  check("couple cannot delete the DJ's song", removable === 0);

  await page.fill("#preferred_genres", "Motown and disco");
  await page.fill("#vibe_notes", "Big dance party");
  await page.click('button:has-text("Send this to our DJ")');
  await page.waitForTimeout(1500);
  check("planner submits", (await page.textContent("body")).includes("Sent to your DJ"));
  await ctx.close();
}

/* ---------- 9. invalid token ---------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/plan/deadbeefdeadbeefdeadbeefdeadbeef`);
  check("bad planner token 404s", res.status() === 404, `status ${res.status()}`);
  await ctx.close();
}

/* ---------- 10. DJ scoping ---------- */
{
  const dj = await signIn("jordan@piper.test");
  const body = await dj.page.textContent("body");
  check("DJ sees own event", body.includes("Ava Nakamura"));
  check("DJ does not see other DJ's event", !body.includes("Theo Brennan"));
  check("DJ has no admin nav", !body.includes("Team"));

  await dj.page.goto(`${BASE}/events/new`);
  check("DJ blocked from creating events", dj.page.url().includes("/dashboard"), dj.page.url());

  await dj.page.goto(`${BASE}/team`);
  check("DJ blocked from team page", dj.page.url().includes("/dashboard"), dj.page.url());

  // Event 2 is Mina's; a direct id must 404 for Jordan.
  const res = await dj.page.goto(`${BASE}/events/2`);
  check("DJ blocked from another DJ's event", res.status() === 404, `status ${res.status()}`);
  await dj.ctx.close();
}

/* ---------- 11. team management ---------- */
{
  // Unique per run so the suite can be re-run against the same database.
  const freshEmail = `hire.${Date.now()}@piper.test`;
  await admin.page.goto(`${BASE}/team`);
  await admin.page.fill("#name", "New Hire");
  await admin.page.fill("#email", "owner@piper.test");
  await admin.page.fill("#password", "temp12345");
  await admin.page.click('button:has-text("Add team member")');
  await admin.page.waitForSelector(".alert-error", { timeout: 10000 });
  check("duplicate email rejected", (await admin.page.textContent(".alert-error")).includes("already uses that email"));

  // The password is deliberately never echoed back, so it must be retyped.
  const echoedPassword = await admin.page.inputValue("#password");
  check("password is not echoed back after an error", echoedPassword === "");
  check("other fields survive the error", (await admin.page.inputValue("#name")) === "New Hire");

  await admin.page.fill("#email", freshEmail);
  await admin.page.fill("#password", "temp12345");
  await admin.page.click('button:has-text("Add team member")');
  await admin.page.waitForSelector(".alert-ok", { timeout: 10000 });
  check("team member added", (await admin.page.textContent(".alert-ok")).includes("New Hire"));

  const fresh = await signIn(freshEmail, "temp12345");
  check("new member can sign in", fresh.page.url().includes("/dashboard"));
  await fresh.ctx.close();
}

/* ---------- 12. sign out ---------- */
{
  await admin.page.goto(`${BASE}/dashboard`);
  await admin.page.click('button:has-text("Sign out")');
  await admin.page.waitForURL("**/login", { timeout: 10000 });
  await admin.page.goto(`${BASE}/dashboard`);
  check("sign out ends the session", admin.page.url().includes("/login"));
}


/* ---------- 13. staff area ---------- */
{
  const owner = await signIn("owner@piper.test");
  await owner.page.goto(`${BASE}/team`);
  let body = await owner.page.textContent("body");
  check("roster lists staff", ["Jordan Blake", "Mina Osei"].every((n) => body.includes(n)));

  await owner.page.locator(".staff-row", { hasText: "Jordan Blake" }).click();
  await owner.page.waitForURL(/\/team\/\d+$/, { timeout: 15000 });
  const staffUrl = owner.page.url();
  body = await owner.page.textContent("body");
  check("staff page shows their events", body.includes("Ava Nakamura"));
  check("staff page shows gear on file", body.includes("Pioneer DDJ-1000"));

  await owner.page.fill("#staff_notes", "Note set by the smoke suite.");
  await owner.page.click('button:has-text("Save staff record")');
  await owner.page.waitForSelector(".alert-ok", { timeout: 10000 });
  await owner.page.reload();
  check("staff record saves", (await owner.page.textContent("body")).includes("Note set by the smoke suite."));

  const dj = await signIn("jordan@piper.test");
  await dj.page.goto(`${BASE}/me`);
  body = await dj.page.textContent("body");
  check("DJ has a personal page", body.includes("My page") && body.includes("Ava Nakamura"));

  // Anything handed to a Client Component lands in the HTML — these must not.
  const html = await dj.page.content();
  check("admin's private staff notes never reach the DJ", !html.includes("Note set by the smoke suite."));
  check("password hashes never reach the browser", !html.includes("password_hash"));

  await dj.page.goto(staffUrl);
  check("DJ blocked from a staff record page", dj.page.url().includes("/dashboard"), dj.page.url());

  await dj.ctx.close();
  await owner.ctx.close();
}

/* ---------- 14. crew reports ---------- */
{
  const ops = await signIn("owner@piper.test");

await ops.page.goto(`${BASE}/reports`);
let body = await ops.page.textContent("body");
check("matched tab loads", body.includes("Matched"));

// The rest of this section asserts against real reports imported from the
// report mailbox, which the seed deliberately does not carry — they hold
// client details and stay out of the repository. On a database that has only
// been seeded there is nothing here to check, and pressing on turns every
// assertion into a failure and then a crash on a button that was never
// rendered. Say so once and move to the next section.
await ops.page.goto(`${BASE}/reports/dj`);
const haveReports = (await ops.page.locator("tbody tr").count()) > 0;
await ops.page.goto(`${BASE}/reports`);
if (!haveReports) {
  console.log("SKIP  crew report checks — no reports imported (run npm run import:reports)");
} else {
check("shows the real matched job", body.includes("26-0224"));
check("dash-less job matched to dashed one", body.includes("26647"));
check("test entries counted separately", body.includes("Test entries"));

// Timezone: 2026-08-19T03:30:27Z is Aug 18, 11:30 PM Eastern.
check("timestamps shown in Eastern", body.includes("Aug 18") && body.includes("11:30"), "03:30Z -> 11:30 p.m. Aug 18");

await ops.page.goto(`${BASE}/reports/dj`);
body = await ops.page.textContent("body");
check("show reports listed", body.includes("Juice") && body.includes("Desiree"));
check("test entries excluded from show reports", !body.includes("00-3333"));

await ops.page.goto(`${BASE}/reports/warehouse`);
body = await ops.page.textContent("body");
check("warehouse returns listed", body.includes("Viper sub snake"));

await ops.page.goto(`${BASE}/reports/crew`);
body = await ops.page.textContent("body");
check("crew stats computed", body.includes("Juice") && body.includes("Addison"));
check("crew names split from free text", body.includes("eric"), '"Piper, eric" split');

await ops.page.goto(`${BASE}/reports/quality`);
body = await ops.page.textContent("body");
check("monthly quality computed", body.includes("August 2026") && body.includes("3.91"));

await ops.page.goto(`${BASE}/reports/test`);
body = await ops.page.textContent("body");
check("test entries quarantined", body.includes("00-0000") && body.includes("Im testing some shit"));

/* ---- manifest override, now stored server-side ---- */
// Corrections are real edits to real reports, so this sets one, checks it, and
// puts it back. Toggling whichever badge is first — rather than hunting for a
// "Not signed" one — keeps the check working whatever state the data is in.
await ops.page.goto(`${BASE}/reports/warehouse`);
const overridesBefore = await ops.page.locator('text="Manually set"').count();
const firstManifest = ops.page.locator('form:has(input[name="value"]) button.badge').first();
await firstManifest.click();
await ops.page.waitForTimeout(1500);
body = await ops.page.textContent("body");
check(
  "manifest can be corrected",
  (await ops.page.locator('text="Manually set"').count()) === overridesBefore + 1,
);

// The correction must be visible to a different admin, not just this browser.
const office = await signIn("office@piper.test");
await office.page.goto(`${BASE}/reports/warehouse`);
check("correction is shared, not per-browser", (await office.page.textContent("body")).includes("Manually set"));
await office.ctx.close();

// Put the report back the way it was found.
await ops.page.reload();
await ops.page.locator('button:has-text("reset")').first().click();
await ops.page.waitForTimeout(1200);
check(
  "a correction can be reset",
  (await ops.page.locator('text="Manually set"').count()) === overridesBefore,
);

/* ---- aliases ---- */
await ops.page.goto(`${BASE}/reports/aliases`);
await ops.page.fill("#alias", "eric");
await ops.page.fill("#canonical", "Eric Tremblay");
await ops.page.click('button:has-text("Add alias")');
await ops.page.waitForTimeout(1500);
check("alias saved", (await ops.page.textContent("body")).includes("Eric Tremblay"));

await ops.page.goto(`${BASE}/reports/crew`);
// Assert on the rendered rows: page text also carries the raw "Piper, eric"
// inside React's serialised payload, which is not what the office sees.
const crewNames = await ops.page.$$eval("tbody tr td:first-child", (tds) =>
  tds.map((td) => td.innerText.trim()),
);
check(
  "alias folds the name in crew stats",
  crewNames.includes("Eric Tremblay") && !crewNames.includes("eric"),
  crewNames.join(", "),
);

/* ---- access control ---- */
const reportDj = await signIn("jordan@piper.test");
await reportDj.page.goto(`${BASE}/reports`);
check("DJ blocked from crew reports", reportDj.page.url().includes("/dashboard"), reportDj.page.url());
await reportDj.page.goto(`${BASE}/reports/crew`);
check("DJ blocked from crew stats", reportDj.page.url().includes("/dashboard"), reportDj.page.url());
await reportDj.ctx.close();
}
  await ops.ctx.close();
}


/* ---------- 15. couple's planner, realigned to the Pynx form ---------- */
{
  const plannerCtx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const planner = await plannerCtx.newPage();
  const planEvent = await (async () => {
    const admin2 = await signIn("owner@piper.test");
    await admin2.page.goto(`${BASE}/events/1`);
    const link = await admin2.page.locator("input[readonly]").inputValue();
    await admin2.ctx.close();
    return link.split("/plan/")[1];
  })();
  await planner.goto(`${BASE}/plan/${planEvent}`);
  let body = await planner.textContent("body");

  check("planner uses the form's own sections", ["Ceremony", "Cocktail Time", "Reception"].every((s) => body.includes(s)));
  check("planner has the slots the form has", ["Signing of the registry", "Grand entrance — wedding party", "Father / daughter dance"].every((s) => body.includes(s)));
  check("planner asks for cue points", (await planner.locator('input[name="cue"]').count()) > 15);
  check("planner asks for song links", (await planner.locator('input[name="link"]').count()) > 15);
  check("planner asks the setup questions", ["6ft table reserved", "Power in each space"].every((s) => body.includes(s)));

  const chips = await planner.locator(".reco-chip").count();
  check("recommendations offered from past forms", chips > 10, `${chips} suggestions`);

  const slot = planner.locator('form:has(input[name="category"][value="first_dance"])');
  await slot.locator(".reco-chip").first().click();
  await planner.waitForTimeout(250);
  const filled = await slot.locator('input[name="title"]').inputValue();
  check("tapping a suggestion fills the slot", filled.length > 0, filled);

  await slot.locator('input[name="cue"]').fill("fade out at 2:20");
  await slot.locator('button[type="submit"]').click();
  await planner.waitForTimeout(1200);
  check("cue point saved with the song", (await planner.textContent("body")).includes("fade out at 2:20"));

  await planner.locator('input[name="speech_who[]"]').first().fill("Best man — Jacob");
  await planner.locator('input[name="speech_song[]"]').first().fill("Bad Girlfriend — Theory of a Deadman");
  await planner.fill("#request_policy", "Requests fine, but don't hand anyone the mic");
  await planner.locator('button:has-text("Send this to our DJ"), button:has-text("Save changes")').first().click();
  await planner.waitForTimeout(1500);
  await planner.reload();
  await planner.waitForTimeout(400);
  check("walk-up song saved", (await planner.locator('input[name="speech_song[]"]').first().inputValue()).includes("Bad Girlfriend"));
  check("request policy kept as written", (await planner.locator("#request_policy").inputValue()).includes("don't hand anyone the mic"));
  await plannerCtx.close();

  const djView = await signIn("owner@piper.test");
  await djView.page.goto(`${BASE}/events/1/music`);
  body = await djView.page.textContent("body");
  check("DJ sees the cue point and walk-up songs", body.includes("fade out at 2:20") && body.includes("Bad Girlfriend"));
  await djView.ctx.close();
}

/* ---------- 16. audit trail ---------- */
{
  const owner = await signIn("owner@piper.test");

  // Make a booking, edit two fields, and read its history back.
  await owner.page.goto(`${BASE}/events/new`);
  await owner.page.fill('input[name="partner_one_name"]', "Audit Test");
  await owner.page.fill('input[name="partner_two_name"]', "Second Partner");
  await owner.page.fill('input[name="event_date"]', "2027-11-13");
  await owner.page.fill('input[name="ceremony_time"]', "16:00");
  // Scope to the event form: a bare form button[type=submit] also matches the
  // sidebar's Sign out, which silently ends the session instead of saving.
  const eventForm = 'form:has(input[name="partner_one_name"])';
  await owner.page.click(`${eventForm} button[type="submit"]`);
  await owner.page.waitForURL(/\/events\/\d+$/);
  const auditEventId = Number(owner.page.url().split("/").pop());

  let body = await owner.page.textContent("body");
  check("new booking is recorded", body.includes("Created the booking") && body.includes("Sam Rivera"));

  await owner.page.goto(`${BASE}/events/${auditEventId}/edit`);
  await owner.page.fill('input[name="ceremony_time"]', "16:30");
  await owner.page.selectOption('select[name="assigned_dj_id"]', { label: "Jordan Blake" });
  await owner.page.click(`${eventForm} button[type="submit"]`);
  await owner.page.waitForURL(/\/events\/\d+$/);

  // Read the history list itself: textContent("body") also pulls in the RSC
  // payload from <script> tags, where column names legitimately appear.
  const historyText = await owner.page.locator(".history").innerText();
  check("edit is recorded", historyText.includes("Edited the booking"));
  check("history names the fields", historyText.includes("Ceremony time") && historyText.includes("DJ"));
  check("history shows times the way the app does", historyText.includes("4:00 PM") && historyText.includes("4:30 PM"));
  check("ids are resolved to names", historyText.includes("Jordan Blake"));
  check("no raw column names in the history", !/assigned_dj_id|venue_id/.test(historyText));
  body = historyText;

  // A save that changes nothing must not write an entry.
  const before = (body.match(/Edited the booking/g) ?? []).length;
  await owner.page.goto(`${BASE}/events/${auditEventId}/edit`);
  await owner.page.click(`${eventForm} button[type="submit"]`);
  await owner.page.waitForURL(/\/events\/\d+$/);
  const after = ((await owner.page.textContent("body")).match(/Edited the booking/g) ?? []).length;
  check("a no-op save writes no history", after === before, `${before} -> ${after}`);

  // The activity page collects it all.
  await owner.page.goto(`${BASE}/activity`);
  body = await owner.page.textContent("body");
  check("activity page lists the change", body.includes("Audit Test") && body.includes("Edited the booking"));

  // Deleting keeps the history rather than cascading it away.
  await owner.page.goto(`${BASE}/events/${auditEventId}`);
  await owner.page.click('form:has(button:has-text("Delete event")) button[type="submit"]');
  await owner.page.waitForURL(`${BASE}/events`);
  await owner.page.goto(`${BASE}/activity`);
  body = await owner.page.textContent("body");
  check("deletion is recorded", body.includes("Deleted the booking"));
  check("deleted booking's history survives", body.includes("Audit Test"));
  check("deleted booking is marked as gone", body.includes("(deleted)"));
  await owner.ctx.close();

  // A DJ must not reach any of it.
  const dj = await signIn("jordan@piper.test");
  await dj.page.goto(`${BASE}/activity`);
  check("DJ blocked from activity", dj.page.url().endsWith("/dashboard"), dj.page.url());

  await dj.page.goto(`${BASE}/events/1`);
  const djHtml = await dj.page.content();
  check("DJ sees no history section", !(await dj.page.textContent("body")).includes("Who changed what"));
  check("history never reaches the DJ's page source", !djHtml.includes("Edited the booking"));
  await dj.ctx.close();
}

/* ---------- 17. the crew-report import endpoint ---------- */
{
  const url = `${BASE}/api/reports/import`;
  const post = (body, token) =>
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  const token = process.env.PIPER_IMPORT_TOKEN;

  // Fails closed however the server is configured: 401 when a token is set,
  // 503 when one isn't. Never 200. The runner's env says nothing about the
  // server's, so assert the property rather than a specific status.
  const anonymous = await post({ reports: [] });
  check(
    "import refuses an unauthenticated post",
    anonymous.status === 401 || anonymous.status === 503,
    `${anonymous.status}`,
  );
  const wrong = await post({ reports: [] }, "definitely-not-the-token");
  check(
    "import refuses a wrong token",
    wrong.status === 401 || wrong.status === 503,
    `${wrong.status}`,
  );

  if (!token) {
    console.log("      (set PIPER_IMPORT_TOKEN to also run the round trip)");
  } else {
    // Reports dedupe on (kind, job, sent time), so a fixed job number would make
    // every run after the first a duplicate. Vary the time instead, and keep it
    // out of the months the seeded quality figures are asserted against.
    const stamp = Date.now();
    const when = new Date(Date.UTC(2029, 0, 1) + (stamp % 86_400_000)).toISOString();
    const later = new Date(Date.UTC(2029, 0, 2) + (stamp % 86_400_000)).toISOString();
    const reports = [
      { kind: "dj", job: "26999", crew: "Smoke Crew", sentAt: when,
        client: "5 - Amazing", crowd: 4, staff: "5", notes: "Endpoint test",
        sourceId: `smoke-${stamp}-1` },
      { kind: "warehouse", job: "26-0999", crew: "Smoke Crew", sentAt: later,
        manifest: "Yes", sourceId: `smoke-${stamp}-2` },
      { kind: "dj", job: "00-0001", crew: "martin", sentAt: when,
        notes: "test", sourceId: `smoke-${stamp}-3` },
      { kind: "dj", job: "26-0998", crew: "X", sentAt: "yesterday", sourceId: `smoke-${stamp}-4` },
    ];

    check("import rejects a body that isn't JSON", (await post("not json", token)).status === 400);
    check(
      "import rejects an unknown report kind",
      (await post({ reports: [{ kind: "nope" }] }, token)).status === 422,
    );

    const first = await (await post({ reports }, token)).json();
    check("import accepts a batch", first.inserted === 3, JSON.stringify(first));
    check("a placeholder job number is quarantined", first.tests === 1);
    check("an unparseable timestamp is named, not fatal",
      first.rejected.length === 1 && first.rejected[0].index === 3);

    const again = await (await post({ reports }, token)).json();
    check("re-posting the same batch changes nothing", again.inserted === 0 && again.duplicates === 3);

    // The reason normalisation exists: a dash-less number missing its leading
    // zero still has to pair with the dashed one.
    const owner2 = await signIn("owner@piper.test");
    await owner2.page.goto(`${BASE}/reports`);
    const matched = await owner2.page.textContent("body");
    check("dash-less and dashed job numbers matched into one job", matched.includes("Smoke Crew"));
    await owner2.ctx.close();
  }
}

/* ---------- 18. email drafts, the outbox, and availability ---------- */
{
  const owner = await signIn("owner@piper.test");
  const eventForm2 = 'form:has(input[name="partner_one_name"])';

  // A new booking with a contact email should draft a planner invitation.
  await owner.page.goto(`${BASE}/events/new`);
  await owner.page.fill('input[name="partner_one_name"]', "Mail Test");
  await owner.page.fill('input[name="partner_two_name"]', "Second Partner");
  await owner.page.fill('input[name="contact_email"]', "couple@example.test");
  await owner.page.fill('input[name="event_date"]', "2027-12-04");
  await owner.page.click(`${eventForm2} button[type="submit"]`);
  await owner.page.waitForURL(/\/events\/\d+$/);
  const mailEventId = Number(owner.page.url().split("/").pop());

  await owner.page.goto(`${BASE}/outbox`);
  let outbox = await owner.page.locator(".mail-list").first().innerText();
  check("a new booking drafts a planner invitation", outbox.includes("Planner invitation"));
  check("the invitation goes to the couple", outbox.includes("couple@example.test"));
  check("the invitation carries their planner link", /\/plan\/[0-9a-f]{32}/.test(outbox));

  // Nothing is sent without a mail server, and it says so rather than pretending.
  const queuedBefore = await owner.page.locator(".mail-queued").count();
  check("drafts wait rather than sending themselves", queuedBefore > 0, `${queuedBefore} waiting`);
  check("it explains that sending isn't set up", (await owner.page.textContent("body")).includes("No mail server is set up yet"));

  // Saving the same event again must not stack duplicates.
  await owner.page.goto(`${BASE}/events/${mailEventId}/edit`);
  await owner.page.click(`${eventForm2} button[type="submit"]`);
  await owner.page.waitForURL(/\/events\/\d+$/);
  await owner.page.goto(`${BASE}/outbox`);
  // Count only this booking's invitations — other sections of this suite create
  // events with contact emails, which legitimately draft invitations of their own.
  const invites = await owner.page.locator('.mail-queued:has-text("couple@example.test"):has-text("Planner invitation")').count();
  check("saving twice doesn't duplicate the invitation", invites === 1, `${invites} found`);

  // Assigning a DJ drafts an introduction with the DJ copied in.
  await owner.page.goto(`${BASE}/events/${mailEventId}/edit`);
  await owner.page.selectOption('select[name="assigned_dj_id"]', { label: "Jordan Blake" });
  await owner.page.click(`${eventForm2} button[type="submit"]`);
  await owner.page.waitForURL(/\/events\/\d+$/);
  await owner.page.goto(`${BASE}/outbox`);
  outbox = await owner.page.locator(".mail-list").first().innerText();
  check("assigning a DJ drafts an introduction", outbox.includes("DJ introduction"));
  check("the DJ is copied in", outbox.includes("jordan@piper.test"));

  // A draft can be edited before it goes anywhere.
  const intro = owner.page.locator('.mail:has-text("DJ introduction")').first();
  await intro.locator('button:has-text("Edit")').click();
  await intro.locator('textarea[name="body"]').fill("Rewritten before sending.");
  await intro.locator('button:has-text("Save changes")').click();
  await owner.page.waitForTimeout(1200);
  check("a draft can be reworded first", (await owner.page.textContent("body")).includes("Rewritten before sending."));

  /* ---- availability ---- */
  await owner.page.goto(`${BASE}/events/${mailEventId}`);
  await owner.page.selectOption('select[name="dj_id"]', { label: "Mina Osei" });
  await owner.page.click('button:has-text("Ask if they\'re free")');
  await owner.page.waitForTimeout(1200);
  let eventBody = await owner.page.textContent("body");
  check("asking a DJ is recorded on the event", eventBody.includes("Mina Osei") && eventBody.includes("Waiting"));

  await owner.page.goto(`${BASE}/outbox`);
  outbox = await owner.page.locator(".mail-list").first().innerText();
  check("the availability question is drafted", outbox.includes("Availability request"));
  check("it goes to the DJ, not the couple", outbox.includes("mina@piper.test"));

  const link = outbox.match(/\/available\/[0-9a-f]{32}/);
  check("the email carries an answer link", link !== null);
  await owner.ctx.close();

  /* ---- the DJ answers without logging in ---- */
  if (link) {
    const guestCtx = await browser.newContext();
    const guest = await guestCtx.newPage();
    await guest.goto(`${BASE}${link[0]}?answer=yes`);
    let page = await guest.textContent("body");
    check("the answer page opens with no login", page.includes("can you work this one?"));
    check("it doesn't leak the couple's contact details", !page.includes("couple@example.test"));

    // Merely opening the link must not answer — mail scanners fetch URLs.
    check("opening the link alone doesn't answer", !page.includes("You said you can do it"));

    await guest.fill("#note", "free after 3pm");
    await guest.click('button:has-text("Yes, I can do it")');
    await guest.waitForTimeout(1200);
    page = await guest.textContent("body");
    check("the DJ can answer in one tap", page.includes("You said you can do it"));
    check("their note is kept", page.includes("free after 3pm"));
    await guestCtx.close();

    const owner2 = await signIn("owner@piper.test");
    await owner2.page.goto(`${BASE}/events/${mailEventId}`);
    eventBody = await owner2.page.textContent("body");
    check("the answer reaches the event", eventBody.includes("Can do it") && eventBody.includes("free after 3pm"));
    await owner2.ctx.close();
  }

  /* ---- a DJ answers from inside the app ---- */
  {
    const owner3 = await signIn("owner@piper.test");
    await owner3.page.goto(`${BASE}/events/${mailEventId}`);
    await owner3.page.selectOption('select[name="dj_id"]', { label: "Jordan Blake" });
    await owner3.page.click('button:has-text("Ask if they\'re free")');
    await owner3.page.waitForTimeout(1000);
    await owner3.ctx.close();

    const dj = await signIn("jordan@piper.test");
    let djBody = await dj.page.textContent("body");
    check("a DJ sees the question on their dashboard", djBody.includes("Can you work these?"));
    await dj.page.click('button:has-text("I can do it")');
    await dj.page.waitForTimeout(1200);
    djBody = await dj.page.textContent("body");
    check("answering clears it from their dashboard", !djBody.includes("Can you work these?"));
    await dj.ctx.close();
  }

  // Deleting the booking should take its unsent mail with it.
  const cleanup = await signIn("owner@piper.test");
  await cleanup.page.goto(`${BASE}/events/${mailEventId}`);
  await cleanup.page.click('form:has(button:has-text("Delete event")) button[type="submit"]');
  await cleanup.page.waitForURL(`${BASE}/events`);
  await cleanup.page.goto(`${BASE}/outbox`);
  const stillWaiting = await cleanup.page
    .locator('.mail-queued:has-text("couple@example.test")')
    .count();
  check("deleting a booking discards its unsent mail", stillWaiting === 0, `${stillWaiting} left waiting`);
  await cleanup.ctx.close();
}

/* ---------- 19. venue notes gathered from crew reports ---------- */
{
  const token = process.env.PIPER_IMPORT_TOKEN;
  const owner = await signIn("owner@piper.test");

  if (!token) {
    // Without a token we can still prove the page copes with no data.
    await owner.page.goto(`${BASE}/venues`);
    check(
      "venues explain where crew notes come from",
      (await owner.page.textContent("body")).includes("once your report form asks which"),
    );
  } else {
    const stamp = Date.now();
    const post = (reports) =>
      fetch(`${BASE}/api/reports/import`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ reports }),
      }).then((r) => r.json());

    // "the grand oak barn" must match the venue named "The Grand Oak Barn":
    // crews type it however they type it.
    // Dated well clear of the seeded months, and with no quality rating, so the
    // crew and quality figures other checks assert on are left alone.
    const when = new Date(Date.UTC(2029, 5, 1) + (stamp % 86_400_000)).toISOString();
    await post([
      { kind: "dj", job: "26-9101", crew: "Smoke Venue Crew", sentAt: when,
        venue: "the grand oak barn ", notes: "Generator only until 4pm, bring the long runs.",
        sourceId: `venue-${stamp}-1` },
      { kind: "warehouse", job: "26-9202", crew: "Smoke Venue Crew", sentAt: when,
        venue: "Tanaka's place", notes: "Loading door is round the back, not the front.",
        sourceId: `venue-${stamp}-2` },
    ]);

    await owner.page.goto(`${BASE}/venues`);
    let body = await owner.page.textContent("body");
    check("a differently-typed venue name still matches", body.includes("Generator only until 4pm"));
    check("the venue shows a crew-note count", /crew note/.test(body));

    // The one it couldn't place is offered for mapping rather than dropped.
    check("an unrecognised venue name is surfaced", body.includes("Tanaka's place"));
    check("its note is not yet on any venue", !body.includes("Loading door is round the back"));

    // Map it, and the past report should catch up.
    const mapForm = owner.page.locator('form.venue-map:has-text("Tanaka")');
    await mapForm.locator("select").selectOption({ label: "The Grand Oak Barn" });
    await mapForm.locator('button:has-text("Match")').click();
    await owner.page.waitForTimeout(1200);
    body = await owner.page.textContent("body");
    check("mapping a name back-fills old reports", body.includes("Loading door is round the back"));
    check("the mapping is listed so it can be undone", body.includes("is The Grand Oak Barn"));

    // Undo, so re-running the suite starts from the same place.
    await owner.page.locator('.venue-alias-list li:has-text("Tanaka") button').click();
    await owner.page.waitForTimeout(1000);
  }
  await owner.ctx.close();

  // A DJ has no business in venue records.
  const dj = await signIn("jordan@piper.test");
  await dj.page.goto(`${BASE}/venues`);
  check("DJ blocked from venues", dj.page.url().endsWith("/dashboard"), dj.page.url());
  await dj.ctx.close();
}

/* ---------- 20. the planner spreadsheet, both directions ---------- */
{
  const owner = await signIn("owner@piper.test");

  // Download the workbook for a booking that already has songs.
  const res = await owner.ctx.request.get(`${BASE}/api/events/1/sheet`);
  check("the planner downloads as a spreadsheet", res.status() === 200, `status ${res.status()}`);
  check(
    "it is served as an xlsx",
    (res.headers()["content-type"] ?? "").includes("spreadsheetml.sheet"),
  );
  check(
    "the filename names the couple",
    decodeURIComponent(res.headers()["content-disposition"] ?? "").includes("Ava Nakamura"),
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.body()));
  check(
    "it has a tab per part of the plan",
    ["Timeline", "Details", "Entrances", "Speeches"].every((n) => wb.getWorksheet(n)),
    wb.worksheets.map((w) => w.name).join(", "),
  );

  // Fill it in the way a couple would, then rearrange it the way Excel users do.
  const stamp = Date.now();
  const newTitle = `Smoke Anthem ${stamp}`;
  const timeline = wb.getWorksheet("Timeline");
  let placedFirst = false;
  let placedMust = false;
  let duplicatedExisting = false;

  timeline.eachRow((row) => {
    const activity = String(row.getCell(3).value ?? "");
    if (activity === "First dance" && !placedFirst) {
      row.getCell(4).value = newTitle;
      row.getCell(5).value = "The Smoke Test Band";
      row.getCell(6).value = "fade at 2:40";
      placedFirst = true;
    }
    // Type a song the booking already has, to prove importing cannot duplicate it.
    if (activity === "Must play" && !duplicatedExisting && !row.getCell(4).value) {
      row.getCell(4).value = "September";
      row.getCell(5).value = "Earth, Wind & Fire";
      duplicatedExisting = true;
    } else if (activity === "Must play" && !placedMust && !row.getCell(4).value) {
      row.getCell(4).value = `Extra Track ${stamp}`;
      placedMust = true;
    }
  });

  timeline.spliceRows(6, 0, ["", "", "", "", "", "", ""]); // insert a row mid-sheet
  timeline.spliceRows(12, 1); // delete one

  const details = wb.getWorksheet("Details");
  details.eachRow((row) => {
    if (String(row.getCell(1).value ?? "").startsWith("Who is your MC")) {
      row.getCell(2).value = `Uncle Jimmy ${stamp}`;
    }
  });

  const filled = Buffer.from(await wb.xlsx.writeBuffer());

  // Upload it through the form, the way Martin actually would.
  await owner.page.goto(`${BASE}/events/1`);
  await owner.page.setInputFiles("#sheet", {
    name: "planner.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: filled,
  });
  await owner.page.click('form.sheet-upload button[type="submit"]');
  await owner.page.waitForTimeout(2500);

  const result = await owner.page.textContent("body");
  check("importing reports what it did", /Imported:/.test(result), (result.match(/Imported:[^.]*\./) ?? [""])[0]);

  await owner.page.goto(`${BASE}/events/1/music`);
  const music = await owner.page.textContent("body");
  check("a song typed into the sheet lands on the booking", music.includes(newTitle));
  check("its cue point comes across too", music.includes("fade at 2:40"));

  // Count the artist, not the title: "September" also matches the booking's
  // own date, which is printed at the top of the page.
  const ewf = (music.match(/Earth, Wind &(amp;)? Fire/g) ?? []).length;
  check("a song already there is not duplicated", ewf === 1, `${ewf} mentions`);

  // Importing the identical file again must change nothing.
  await owner.page.goto(`${BASE}/events/1`);
  await owner.page.setInputFiles("#sheet", {
    name: "planner.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: filled,
  });
  await owner.page.click('form.sheet-upload button[type="submit"]');
  await owner.page.waitForTimeout(2500);
  const second = await owner.page.textContent("body");
  check(
    "re-importing the same sheet adds nothing",
    !/\d+ songs? added/.test(second),
    (second.match(/Imported:[^.]*\./) ?? [""])[0],
  );

  // A file that isn't a planner is refused with an explanation, not a stack trace.
  await owner.page.setInputFiles("#sheet", {
    name: "notes.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("this is definitely not a spreadsheet"),
  });
  await owner.page.click('form.sheet-upload button[type="submit"]');
  await owner.page.waitForTimeout(2000);
  check(
    "a file that isn't a planner is refused kindly",
    (await owner.page.textContent("body")).includes("couldn't read that file"),
  );

  // Take the imported songs back off the shared booking, so the next run
  // starts where this one did.
  await owner.page.goto(`${BASE}/events/1/music`);
  for (const title of [newTitle, `Extra Track ${stamp}`]) {
    const row = owner.page.locator(`.song-line:has-text("${title}")`).first();
    if ((await row.count()) > 0) {
      await row.locator('button[aria-label="Remove song"]').click();
      await owner.page.waitForTimeout(900);
    }
  }
  const leftBehind = await owner.page.locator(`.song-line:has-text("Smoke Anthem")`).count();
  check("the suite puts the shared booking back as it found it", leftBehind === 0, `${leftBehind} left`);
  await owner.ctx.close();

  // A DJ can take the sheet away but cannot rewrite the booking with one.
  const dj = await signIn("jordan@piper.test");
  const djRes = await dj.ctx.request.get(`${BASE}/api/events/1/sheet`);
  check("a DJ on the event can download it", djRes.status() === 200, `status ${djRes.status()}`);
  const otherRes = await dj.ctx.request.get(`${BASE}/api/events/2/sheet`);
  check("a DJ cannot download another DJ's booking", otherRes.status() === 404, `status ${otherRes.status()}`);
  await dj.page.goto(`${BASE}/events/1`);
  check("a DJ gets no import form", (await dj.page.locator("#sheet").count()) === 0);
  await dj.ctx.close();
}

/* ---------- 20. sign-in log and staff activity ---------- */
{
  const stamp = Date.now();
  const ops = await signIn("owner@piper.test");

  // The failed attempt from check 1 and every sign-in since should be here.
  await ops.page.goto(`${BASE}/activity/sign-ins`);
  let body = await ops.page.textContent("body");
  check("sign-ins page lists attempts", body.includes("Signed in"));
  check("a failed attempt is recorded", body.includes("Wrong password"));
  check(
    "the failure names the account it was aimed at",
    body.includes("owner@piper.test") || body.includes("Sam Rivera"),
  );
  check("the password itself is never shown", !body.includes("wrongpass"), "'wrongpass' absent");

  // Changes to things that aren't bookings are attributed too.
  const venueName = `Smoke Hall ${stamp}`;
  await ops.page.goto(`${BASE}/venues`);
  await ops.page.fill("#name", venueName);
  await ops.page.click('button:has-text("Add venue")');
  await ops.page.waitForTimeout(900);

  await ops.page.goto(`${BASE}/activity`);
  body = await ops.page.textContent("body");
  check("a new venue lands in the activity feed", body.includes(venueName));
  check("the venue change is attributed", body.includes("Sam Rivera"));

  // And one person's own page shows both halves.
  await ops.page.goto(`${BASE}/team/1`);
  body = await ops.page.textContent("body");
  check("a staff page shows their sign-ins", body.includes("Sign-ins"));
  check("a staff page shows what they changed", body.includes("What they changed"));
  check("their venue edit appears on their page", body.includes(venueName));

  // Put the venue back so the suite is repeatable.
  await ops.page.goto(`${BASE}/venues`);
  const card = ops.page.locator(`details.card:has-text("${venueName}")`).first();
  if ((await card.count()) > 0) {
    await card.locator("summary").click();
    await card.locator('button:has-text("Delete venue")').first().click();
    await ops.page.waitForTimeout(900);
  }
  const stillThere = await ops.page
    .locator(`details.card:has-text("${venueName}")`)
    .count();
  check("the suite removes the venue it added", stillThere === 0, `${stillThere} left`);
  await ops.ctx.close();

  // A DJ must not reach any of it.
  const dj = await signIn("jordan@piper.test");
  for (const path of ["/activity", "/activity/sign-ins"]) {
    await dj.page.goto(`${BASE}${path}`);
    check(`a DJ is bounced off ${path}`, !dj.page.url().includes(path), dj.page.url());
  }
  await dj.ctx.close();
}

/* ---------- 21. forgotten password ---------- */
{
  const stamp = Date.now();
  // Deliberately a throwaway account rather than the seeded admin. A reset
  // test that changes a real password leaves the whole suite locked out if it
  // fails part way through — which is exactly what happened while writing it.
  const email = `reset.${stamp}@piper.test`;
  const startingPassword = "piper1234";

  const ops = await signIn("owner@piper.test");
  await ops.page.goto(`${BASE}/team`);
  await ops.page.fill("#name", "Reset Test");
  await ops.page.fill("#email", email);
  await ops.page.fill("#password", startingPassword);
  await ops.page.click('button:has-text("Add team member")');
  await ops.page.waitForTimeout(900);

  const memberLink = ops.page.locator(`a.staff-row:has-text("Reset Test")`).first();
  const memberHref = await memberLink.getAttribute("href");
  check("throwaway account created", Boolean(memberHref), String(memberHref));
  await ops.ctx.close();

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`);
  check("login offers a way out", (await page.locator('a[href="/forgot"]').count()) === 1);

  // The reply must not differ between a real address and an invented one, or
  // the form becomes a way to test which emails exist.
  const replies = [];
  for (const who of [email, `nobody-${stamp}@piper.test`]) {
    await page.goto(`${BASE}/forgot`);
    await page.fill("#email", who);
    await page.click("button[type=submit]");
    await page.waitForTimeout(800);
    replies.push((await page.textContent(".card")).replace(/\s+/g, " ").trim());
  }
  check(
    "a real and an unknown address get the same answer",
    replies[0] === replies[1],
    replies[0] === replies[1] ? "" : `"${replies[0]}" vs "${replies[1]}"`,
  );
  check("no reset link is ever shown on screen", !replies[0].includes("/reset/"));

  // With no mail server configured nothing is issued at all — which is the
  // point, but it means there is no link to walk. Everything above still
  // holds; the rest of the walk needs a token to exist.
  const mailOff = replies[0].includes("can't send email yet");

  // A junk token gets the expired page, not a crash and not a form.
  await page.goto(`${BASE}/reset/${"0".repeat(64)}`);
  const junk = await page.textContent("body");
  check("an unknown reset token is refused", junk.includes("expired"));
  check("an unknown token offers no password form", (await page.locator("#password").count()) === 0);
  await ctx.close();

  if (mailOff) {
    console.log(
      "SKIP  reset-link walk — no mail server configured " +
        "(set PIPER_SMTP_* to exercise it; 127.0.0.1:1 is enough)",
    );
  } else {
  // The link an admin can read out is the one the reset actually issued.
  const ops2 = await signIn("owner@piper.test");
  await ops2.page.goto(`${BASE}${memberHref}`);
  const shown = await ops2.page.textContent("body");
  check("an admin can see the pending reset", shown.includes("Password reset in progress"));
  const link = await ops2.page.locator('input[readonly][value*="/reset/"]').first().inputValue();
  check("the reset link carries a real token", /\/reset\/[0-9a-f]{64}$/.test(link), link.slice(-12));
  await ops2.ctx.close();

  // Walking that link sets a new password.
  const user = await browser.newContext();
  const rp = await user.newPage();
  await rp.goto(link);
  check("the issued link opens the reset form", (await rp.locator("#password").count()) === 1);

  await rp.fill("#password", "smoke-newpass-1");
  await rp.fill("#confirm", "smoke-different");
  await rp.click("button[type=submit]");
  await rp.waitForTimeout(800);
  check("mismatched passwords are refused", (await rp.locator(".alert-error").count()) === 1);

  await rp.fill("#password", "smoke-newpass-1");
  await rp.fill("#confirm", "smoke-newpass-1");
  await rp.click("button[type=submit]");
  await rp.waitForURL("**/login**", { timeout: 15000 });
  check("a completed reset lands back on sign in", rp.url().includes("/login"));
  await user.close();

  // The token is spent.
  const again = await browser.newContext();
  const ap = await again.newPage();
  await ap.goto(link);
  check("the link cannot be used twice", (await ap.locator("#password").count()) === 0);
  await again.close();

  // The new password works and the old one does not.
  const fresh = await signIn(email, "smoke-newpass-1");
  check("the new password signs in", fresh.page.url().includes("/dashboard"));
  await fresh.ctx.close();

  const stale = await browser.newContext();
  const sp = await stale.newPage();
  await sp.goto(`${BASE}/login`);
  await sp.fill("#email", email);
  await sp.fill("#password", startingPassword);
  await sp.click("button[type=submit]");
  await sp.waitForTimeout(1200);
  check("the old password no longer works", !sp.url().includes("/dashboard"), sp.url());
  await stale.close();
  }

  // Deactivate the throwaway so a rerun doesn't accumulate accounts.
  const cleanup = await signIn("owner@piper.test");
  await cleanup.page.goto(`${BASE}${memberHref}`);
  await cleanup.page.click('button:has-text("Deactivate")');
  await cleanup.page.waitForTimeout(900);
  check(
    "the suite deactivates the account it made",
    (await cleanup.page.textContent("body")).includes("Reactivate"),
  );
  await cleanup.ctx.close();
}

/* ---------- 22. login banner ---------- */
{
  const stamp = Date.now();
  const message = `Smoke notice ${stamp}`;
  const ops = await signIn("owner@piper.test");

  await ops.page.goto(`${BASE}/settings`);
  await ops.page.fill("#message", message);
  await ops.page.selectOption("#tone", "warning");
  await ops.page.check("#on");
  await ops.page.click('button:has-text("Save banner")');
  await ops.page.waitForTimeout(900);
  check("banner saves", (await ops.page.textContent("body")).includes("showing on the sign-in"));

  // The point of the feature: visible to someone with no account at all.
  const stranger = await browser.newContext();
  const sp = await stranger.newPage();
  await sp.goto(`${BASE}/login`);
  let shown = await sp.textContent("body");
  check("a signed-out visitor sees the banner", shown.includes(message));
  check("the banner carries its tone", (await sp.locator(".login-banner-warning").count()) === 1);
  await sp.goto(`${BASE}/forgot`);
  check("it shows on the forgotten-password page too", (await sp.textContent("body")).includes(message));
  await stranger.close();

  // Stored text is rendered as text. An admin typing a tag must not get markup
  // on the one page everybody reaches without signing in.
  await ops.page.goto(`${BASE}/settings`);
  await ops.page.fill("#message", `<img src=x onerror=alert(1)>${stamp}`);
  await ops.page.click('button:has-text("Save banner")');
  await ops.page.waitForTimeout(900);

  const probe = await browser.newContext();
  const pp = await probe.newPage();
  await pp.goto(`${BASE}/login`);
  check("markup in the banner is not rendered", (await pp.locator("img").count()) === 0);
  check(
    "it is shown as the text it is",
    (await pp.textContent(".login-banner")).includes("<img"),
  );
  await probe.close();

  // Switching it off takes it away.
  await ops.page.goto(`${BASE}/settings`);
  await ops.page.uncheck("#on");
  await ops.page.click('button:has-text("Save banner")');
  await ops.page.waitForTimeout(900);

  const after = await browser.newContext();
  const ap = await after.newPage();
  await ap.goto(`${BASE}/login`);
  check("switching it off hides it", (await ap.locator(".login-banner").count()) === 0);
  await after.close();

  // And the change is attributed like any other.
  await ops.page.goto(`${BASE}/activity`);
  check(
    "banner changes land in the activity feed",
    (await ops.page.textContent("body")).includes("Login banner"),
  );

  // Leave it blank and off, as found.
  await ops.page.goto(`${BASE}/settings`);
  await ops.page.fill("#message", "");
  await ops.page.click('button:has-text("Save banner")');
  await ops.page.waitForTimeout(800);
  await ops.ctx.close();

  const dj = await signIn("jordan@piper.test");
  await dj.page.goto(`${BASE}/settings`);
  check("a DJ cannot reach settings", !dj.page.url().includes("/settings"), dj.page.url());
  await dj.ctx.close();
}

/* ---------- 23. dispatch ---------- */
{
  const stamp = Date.now();
  const van = `Smoke Van ${stamp}`;
  const ops = await signIn("owner@piper.test");

  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  const addForm = 'form:has(button:has-text("Add vehicle"))';
  await ops.page.fill(`${addForm} input[name="name"]`, van);
  await ops.page.selectOption(`${addForm} select[name="class"]`, "cube_van");
  await ops.page.selectOption(`${addForm} select[name="ownership"]`, "pencar");
  // One at a time, so the overlap checks below measure a refusal rather than
  // the second of three slots quietly being free.
  await ops.page.fill(`${addForm} input[name="slots"]`, "1");
  await ops.page.fill(`${addForm} input[name="weight_capacity"]`, "1 ton");
  await ops.page.fill(`${addForm} input[name="passenger_capacity"]`, "3");
  await ops.page.fill(`${addForm} input[name="home_base"]`, "Shop");
  await ops.page.click('button:has-text("Add vehicle")');
  await ops.page.waitForTimeout(900);
  const fleet = await ops.page.textContent("body");
  check("a vehicle can be added", fleet.includes(van));
  check("the fleet records what it is", fleet.includes("Cube van"));
  check("and who it is hired from", fleet.includes("Pencar hire"));
  check("and records what it carries", fleet.includes("1 ton") && fleet.includes("3 seats"));

  // Anything hired is asked when it goes back — Pencar included, since that is
  // where most of them come from. A crew member's own car is not.
  for (const [ownership, expected] of [
    ["pencar", 1],
    ["rental", 1],
    ["personal", 0],
  ]) {
    await ops.page.selectOption(`${addForm} select[name="ownership"]`, ownership);
    await ops.page.waitForTimeout(300);
    check(
      `${ownership} ${expected ? "is" : "is not"} asked when it is due back`,
      (await ops.page.locator(`${addForm} input[name="rental_due"]`).count()) === expected,
    );
  }

  // Book it out across three days and check every day is drawn, not just the
  // first — a run shown only on its start date is the bug this board exists
  // to avoid.
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  await ops.page.goto(`${BASE}/dispatch?view=week`);
  await ops.page.selectOption("#vehicle_id", { label: van });
  await ops.page.fill("#label", `Smoke run ${stamp}`);
  await ops.page.fill("#starts_on", day(0));
  await ops.page.fill("#ends_on", day(2));
  await ops.page.fill("#keys_with", "Front desk");
  await ops.page.click('button:has-text("Send it out")');
  await ops.page.waitForTimeout(1200);

  // One bar, spanning the days it covers, rather than a box per day.
  const bar = ops.page.locator(`.run-bar:has-text("Smoke run ${stamp}")`);
  check("a multi-day run is drawn once", (await bar.count()) === 1, `${await bar.count()} bars`);
  const span = await bar.first().evaluate((el) => getComputedStyle(el).gridColumnEnd);
  check("and spans more than one day", span.includes("span") && span !== "span 1", span);
  check("the board shows who has the keys", (await ops.page.textContent("body")).includes("Front desk"));

  // A van cannot be in two places. A second booking overlapping the first is
  // refused outright, naming what is already there.
  await ops.page.selectOption("#vehicle_id", { label: van });
  await ops.page.fill("#label", `Clashing run ${stamp}`);
  await ops.page.fill("#starts_on", day(1));
  await ops.page.click('button:has-text("Send it out")');
  await ops.page.waitForTimeout(1200);
  const refusal = (await ops.page.locator(".alert-error").count())
    ? await ops.page.locator(".alert-error").first().textContent()
    : "";
  check("an overlapping booking is refused", (refusal ?? "").includes("already out for"), refusal ?? "none");
  check("the refusal names the clash", (refusal ?? "").includes(`Smoke run ${stamp}`));
  check(
    "and nothing was saved",
    (await ops.page.locator(`.run-bar:has-text("Clashing run ${stamp}")`).count()) === 0,
  );
  // A day flagged as needed is not a booking, so it is allowed to sit on top
  // of one — the whole point is to record a want that is not yet arranged.
  await ops.page.selectOption("#vehicle_id", { label: van });
  await ops.page.selectOption("#status", "needed");
  await ops.page.fill("#label", `Needed ${stamp}`);
  await ops.page.fill("#starts_on", day(0));
  await ops.page.click('button:has-text("Send it out")');
  await ops.page.waitForTimeout(1200);
  let body = await ops.page.textContent("body");
  check("a needed day is flagged at the top of the board", body.includes("Needed in view, not booked"));
  check(
    "a needed day is drawn in its own colour",
    (await ops.page.locator(".run-bar.run-needed").count()) > 0,
  );
  check(
    "the board counts what is needed today",
    (await ops.page.textContent("body")).includes("Vehicles needed today"),
  );

  // An idle day is a statement about the vehicle, so it needs no label.
  await ops.page.selectOption("#vehicle_id", { label: van });
  await ops.page.selectOption("#status", "idle");
  await ops.page.fill("#label", "");
  await ops.page.fill("#starts_on", day(1));
  await ops.page.click('button:has-text("Mark the day")');
  await ops.page.waitForTimeout(1200);
  check(
    "an idle day saves without a label",
    (await ops.page.locator(".run-bar.run-idle").count()) > 0,
  );

  // Dragging a bar's edge moves that end's date, and saves it.
  {
    await ops.page.goto(`${BASE}/dispatch?view=week`);
    const bar = ops.page.locator(`.run-bar:has-text("Smoke run ${stamp}")`).first();
    await bar.scrollIntoViewIfNeeded();
    const track = await ops.page.locator(".board-grid-track").first().boundingBox();
    const colWidth = track.width / 7;
    const handle = bar.locator(".run-handle-start");
    const hb = await handle.boundingBox();

    // One column to the right: the run should start a day later.
    await ops.page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await ops.page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await ops.page.mouse.move(hb.x + hb.width / 2 + (colWidth * i) / 8, hb.y + hb.height / 2);
    }
    await ops.page.mouse.up();
    await ops.page.waitForTimeout(1600);

    // Read the dates back off the title rather than the rendered span, which
    // is clipped to whatever the window happens to show.
    await ops.page.reload();
    await ops.page.waitForTimeout(600);
    const title = await ops.page
      .locator(`.run-bar:has-text("Smoke run ${stamp}")`)
      .first()
      .getAttribute("title");
    check("dragging an edge moves that date", (title ?? "").includes(day(1)), title ?? "none");
    check("and leaves the other end alone", (title ?? "").includes(day(2)), title ?? "none");
  }

  // A hired class with three slots takes three bookings on one day, and
  // refuses the fourth.
  {
    const dayOne = day(3);
    for (let i = 1; i <= 3; i++) {
      await ops.page.goto(`${BASE}/dispatch?view=week`);
      await ops.page.selectOption("#vehicle_id", { label: "Cube van" });
      await ops.page.fill("#label", `Hire ${i} ${stamp}`);
      await ops.page.fill("#starts_on", dayOne);
      await ops.page.click('button:has-text("Send it out")');
      await ops.page.waitForTimeout(1100);
    }
    const three = await ops.page.locator(`.run-bar:has-text("Hire 3 ${stamp}")`).count();
    check("three of a hired class can be out at once", three === 1, `${three} found`);

    await ops.page.selectOption("#vehicle_id", { label: "Cube van" });
    await ops.page.fill("#label", `Hire 4 ${stamp}`);
    await ops.page.fill("#starts_on", dayOne);
    await ops.page.click('button:has-text("Send it out")');
    await ops.page.waitForTimeout(1100);
    const fourth = (await ops.page.locator(".alert-error").count())
      ? await ops.page.locator(".alert-error").first().textContent()
      : "";
    check(
      "but a fourth is refused, naming the row",
      (fourth ?? "").includes("Cube van: all 3 are already out"),
      fourth ?? "none",
    );

    // Clean up the three.
    await ops.page.goto(`${BASE}/dispatch?week=${dayOne}`);
    const cubeRow = ops.page.locator(`.board-grid-row:has(.board-grid-name:has-text("Cube van"))`);
    for (let i = 0; i < 6; i++) {
      // Anchored on "Remove": the drag handles carry the label too, and
      // clicking one of those does nothing while the loop cheerfully counts
      // down — which is how three vans were left on the board for the next
      // run of the suite to trip over.
      const remove = cubeRow.locator(
        `button[aria-label^="Remove "][aria-label*="${stamp}"]`,
      );
      if ((await remove.count()) === 0) break;
      await cubeRow.locator(".run-bar").first().hover();
      await remove.first().click();
      await ops.page.waitForTimeout(700);
    }
  }

  // Dates that make no sense are refused.
  await ops.page.selectOption("#vehicle_id", { label: van });
  await ops.page.selectOption("#status", "booked");
  await ops.page.fill("#label", "Backwards");
  await ops.page.fill("#starts_on", day(5));
  await ops.page.fill("#ends_on", day(3));
  await ops.page.click('button:has-text("Send it out")');
  await ops.page.waitForTimeout(1000);
  check(
    "coming back before going out is refused",
    (await ops.page.textContent(".alert-error")) !== null,
  );

  // The board defaults to a month and can step through them.
  await ops.page.goto(`${BASE}/dispatch`);
  const thisMonth = await ops.page.textContent("h2");
  check("the board opens on a month", /\d{4}/.test(thisMonth) && !thisMonth.includes("–"), thisMonth);
  await ops.page.getByRole("link", { name: "Next", exact: true }).click();
  await ops.page.waitForTimeout(900);
  check("the board steps a month at a time", (await ops.page.textContent("h2")) !== thisMonth);

  // And a week view is one click away.
  await ops.page.goto(`${BASE}/dispatch`);
  await ops.page.click('a:has-text("Week view")');
  await ops.page.waitForTimeout(900);
  check("a week view is available", (await ops.page.textContent("h2")).includes("–"));

  // And it reaches the dashboard.
  await ops.page.goto(`${BASE}/dashboard`);
  check(
    "today's runs reach the dashboard",
    (await ops.page.textContent("body")).includes("On the road today"),
  );

  // Clean up: remove the runs, then retire the vehicle.
  // Scoped to this test's own vehicle row. A blanket "remove every chip on the
  // board" would take the seeded runs with it and quietly hollow out the demo
  // data for every later run of the suite.
  let leftOver = 0;
  for (const url of [`${BASE}/dispatch`, `${BASE}/dispatch?week=${day(32)}`]) {
    await ops.page.goto(url);
    const row = ops.page.locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`);
    for (let i = 0; i < 10; i++) {
      const remove = row.locator('button[aria-label^="Remove "]');
      if ((await remove.count()) === 0) break;
      // The button only shows on hover, so hover the bar it belongs to first.
      await row.locator(".run-bar").first().hover();
      await remove.first().click();
      await ops.page.waitForTimeout(700);
    }
    leftOver += await row.locator(".run-bar").count();
  }
  check("the suite takes its runs back off the board", leftOver === 0, `${leftOver} left`);

  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  const card = ops.page.locator(`details.card:has-text("${van}")`).first();
  await card.locator("summary").click();
  await card.locator('button:has-text("Retire")').click();
  await ops.page.waitForTimeout(900);
  check(
    "the suite retires the vehicle it made",
    (await ops.page.textContent("body")).includes("Retired"),
  );
  await ops.ctx.close();

  const dj = await signIn("jordan@piper.test");
  await dj.page.goto(`${BASE}/dispatch`);
  check("a DJ cannot reach dispatch", !dj.page.url().includes("/dispatch"), dj.page.url());
  await dj.ctx.close();
}

/* ---------- 24. public crew board ---------- */
{
  const stamp = Date.now();
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  // Off until somebody turns it on, and a 404 rather than a notice — a page
  // that says "switched off" has still confirmed the address is real.
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  let res = await ap.goto(`${BASE}/board`);
  check("the board is not published by default", res.status() === 404, `status ${res.status()}`);
  await anon.close();

  const ops = await signIn("owner@piper.test");

  // A vehicle with a run inside the window and one well outside it.
  const van = `Public Van ${stamp}`;
  const addForm = 'form:has(button:has-text("Add vehicle"))';
  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  await ops.page.fill(`${addForm} input[name="name"]`, van);
  await ops.page.click('button:has-text("Add vehicle")');
  await ops.page.waitForTimeout(900);

  const inside = `Inside window ${stamp}`;
  const outside = `Outside window ${stamp}`;
  for (const [label, when] of [[inside, day(2)], [outside, day(20)]]) {
    await ops.page.goto(`${BASE}/dispatch?view=week`);
    await ops.page.selectOption("#vehicle_id", { label: van });
    await ops.page.fill("#label", label);
    await ops.page.fill("#starts_on", when);
    await ops.page.fill("#site", "Port Colborne");
    await ops.page.fill("#crew", "Eric");
    await ops.page.fill("#notes", `SECRET-${stamp}`);
    await ops.page.click('button:has-text("Send it out")');
    await ops.page.waitForTimeout(1100);
  }

  // Publish it.
  await ops.page.goto(`${BASE}/settings`);
  await ops.page.check("#board_on");
  await ops.page.fill("#note", `Lock box ${stamp}`);
  await ops.page.locator("form:has(#board_on) button[type=submit]").click();
  await ops.page.waitForTimeout(900);
  check("publishing reports back", (await ops.page.textContent("body")).includes("board is live"));
  await ops.ctx.close();

  // Now read it as a stranger.
  const crew = await browser.newContext();
  const cp = await crew.newPage();
  res = await cp.goto(`${BASE}/board`);
  check("a stranger can read the published board", res.status() === 200, `status ${res.status()}`);
  const body = await cp.textContent("body");

  check("it shows a run inside the window", body.includes(inside));
  check("it does NOT show one beyond ten days", !body.includes(outside));
  check("it carries the note", body.includes(`Lock box ${stamp}`));
  check("it shows the detail a crew needs", body.includes("Port Colborne") && body.includes("Eric"));
  check("internal notes never reach it", !body.includes(`SECRET-${stamp}`), "notes withheld");

  // Nothing on it leads back into Piper, and no date can be asked for.
  const hrefs = await cp.$$eval("a", (as) => as.map((a) => a.getAttribute("href") ?? ""));
  check(
    "nothing on it links into the app",
    hrefs.every((h) => !/^\/(events|dispatch|team|dashboard|outbox|activity|settings)/.test(h)),
    hrefs.join(",") || "no links",
  );

  // The window is fixed server-side: a date parameter must not move it.
  await cp.goto(`${BASE}/board?week=${day(20)}&view=week&days=60`);
  const forced = await cp.textContent("body");
  check("a date in the URL cannot widen the window", !forced.includes(outside));

  // It is noindex, and the whole site is disallowed to crawlers.
  const robotsRes = await cp.goto(`${BASE}/robots.txt`);
  check("robots.txt disallows crawling", (await robotsRes.text()).includes("Disallow: /"));
  await cp.goto(`${BASE}/board`);
  const meta = await cp.locator('meta[name="robots"]').getAttribute("content");
  check("the board is noindex", (meta ?? "").includes("noindex"), meta ?? "none");
  await crew.close();

  // Unpublishing takes it away again.
  const ops2 = await signIn("owner@piper.test");
  await ops2.page.goto(`${BASE}/settings`);
  // Scoped to the board's own form: the banner form on the same page has a
  // "Save banner" button, and a substring match happily clicks that instead.
  const boardForm = ops2.page.locator("form:has(#board_on)");
  await ops2.page.uncheck("#board_on");
  await ops2.page.fill("#note", "");
  await boardForm.locator('button[type=submit]').click();
  await ops2.page.waitForTimeout(900);
  check(
    "unpublishing reports back",
    (await ops2.page.textContent("body")).includes("no longer published"),
  );

  const gone = await browser.newContext();
  const gp = await gone.newPage();
  res = await gp.goto(`${BASE}/board`);
  check("unpublishing takes it down", res.status() === 404, `status ${res.status()}`);
  await gone.close();

  // Clean up: remove the runs from this test's own vehicle, then retire it.
  for (const url of [`${BASE}/dispatch`, `${BASE}/dispatch?week=${day(20)}`]) {
    await ops2.page.goto(url);
    const row = ops2.page.locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`);
    for (let i = 0; i < 6; i++) {
      const remove = row.locator('button[aria-label^="Remove "]');
      if ((await remove.count()) === 0) break;
      await remove.first().click();
      await ops2.page.waitForTimeout(700);
    }
  }
  await ops2.page.goto(`${BASE}/dispatch/vehicles`);
  const card = ops2.page.locator(`details.card:has-text("${van}")`).first();
  await card.locator("summary").click();
  await card.locator('button:has-text("Retire")').click();
  await ops2.page.waitForTimeout(900);
  check(
    "the suite retires the vehicle it made",
    (await ops2.page.textContent("body")).includes("Retired"),
  );
  await ops2.ctx.close();
}

/* ---------- 25. who drove, shop details, and install ---------- */
{
  const stamp = Date.now();
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const ops = await signIn("owner@piper.test");

  // Who drove: a date goes in, the trip comes out.
  const van = `History Van ${stamp}`;
  const addForm = 'form:has(button:has-text("Add vehicle"))';
  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  await ops.page.fill(`${addForm} input[name="name"]`, van);
  await ops.page.click('button:has-text("Add vehicle")');
  await ops.page.waitForTimeout(900);

  await ops.page.goto(`${BASE}/dispatch?view=week`);
  await ops.page.selectOption("#vehicle_id", { label: van });
  await ops.page.fill("#label", `Trip ${stamp}`);
  await ops.page.fill("#starts_on", day(0));
  await ops.page.fill("#crew", `Wilhelmina ${stamp}`);
  await ops.page.click('button:has-text("Send it out")');
  await ops.page.waitForTimeout(1100);

  await ops.page.goto(`${BASE}/dispatch/history`);
  let body = await ops.page.textContent("body");
  check("who drove defaults to today", body.includes(`Trip ${stamp}`));
  check("and names the crew", body.includes(`Wilhelmina ${stamp}`));

  await ops.page.goto(`${BASE}/dispatch/history?from=${day(0)}&to=${day(0)}&who=Wilhelmina`);
  check(
    "it can be filtered to one person",
    (await ops.page.textContent("body")).includes(`Trip ${stamp}`),
  );
  await ops.page.goto(`${BASE}/dispatch/history?from=${day(0)}&to=${day(0)}&who=nobody-${stamp}`);
  check(
    "a person with no trips comes back empty",
    (await ops.page.textContent("body")).includes("Nothing recorded"),
  );

  // Shop details: contact goes out, codes stay behind unless asked for.
  await ops.page.goto(`${BASE}/settings`);
  const shopForm = ops.page.locator('form:has(#rules)');
  await ops.page.fill("#phone", `519-555-${String(stamp).slice(-4)}`);
  await ops.page.fill("#gate", `GATE-${stamp}`);
  await ops.page.fill("#rules", `Fuel it before you bring it back ${stamp}`);
  await ops.page.check('input[name="showOnBoard"]');
  await shopForm.locator('button[type=submit]').click();
  await ops.page.waitForTimeout(900);

  await ops.page.locator("form:has(#board_on) input#board_on").check();
  await ops.page.locator("form:has(#board_on) button[type=submit]").click();
  await ops.page.waitForTimeout(900);
  await ops.ctx.close();

  const crew = await browser.newContext();
  const cp = await crew.newPage();
  await cp.goto(`${BASE}/board`);
  body = await cp.textContent("body");
  check("the crew board carries the shop phone", body.includes(`519-555-${String(stamp).slice(-4)}`));
  check("and the standing rules", body.includes(`Fuel it before you bring it back ${stamp}`));
  check("but withholds the gate code", !body.includes(`GATE-${stamp}`), "codes withheld");
  check(
    "the phone number is tappable",
    (await cp.locator('a[href^="tel:"]').count()) > 0,
  );

  // The manifest and icons a phone needs to install it.
  const manifest = await cp.goto(`${BASE}/manifest.webmanifest`);
  const parsed = JSON.parse(await manifest.text());
  check("a web app manifest is served", parsed.name === "PYNX Dispatch", parsed.name);
  check("it opens on the crew board", parsed.start_url === "/board", parsed.start_url);
  check("it declares a maskable icon", parsed.icons.some((i) => i.purpose === "maskable"));
  for (const icon of parsed.icons) {
    const res = await cp.goto(`${BASE}${icon.src}`);
    check(`${icon.src} is a real file`, res.status() === 200, `status ${res.status()}`);
  }
  const apple = await cp.goto(`${BASE}/apple-touch-icon.png`);
  check("an apple touch icon is served", apple.status() === 200, `status ${apple.status()}`);
  await crew.close();

  // Now switch the codes on and confirm they do appear.
  const ops2 = await signIn("owner@piper.test");
  await ops2.page.goto(`${BASE}/settings`);
  await ops2.page.check('input[name="showCodes"]');
  await ops2.page.locator('form:has(#rules) button[type=submit]').click();
  await ops2.page.waitForTimeout(900);

  const crew2 = await browser.newContext();
  const cp2 = await crew2.newPage();
  await cp2.goto(`${BASE}/board`);
  check(
    "codes appear once deliberately published",
    (await cp2.textContent("body")).includes(`GATE-${stamp}`),
  );
  await crew2.close();

  // Put everything back.
  await ops2.page.goto(`${BASE}/settings`);
  await ops2.page.uncheck('input[name="showOnBoard"]');
  await ops2.page.fill("#phone", "");
  await ops2.page.fill("#gate", "");
  await ops2.page.fill("#rules", "");
  await ops2.page.locator('form:has(#rules) button[type=submit]').click();
  await ops2.page.waitForTimeout(900);
  await ops2.page.locator("form:has(#board_on) input#board_on").uncheck();
  await ops2.page.locator("form:has(#board_on) button[type=submit]").click();
  await ops2.page.waitForTimeout(900);

  await ops2.page.goto(`${BASE}/dispatch`);
  const row = ops2.page.locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`);
  for (let i = 0; i < 6; i++) {
    const remove = row.locator('button[aria-label^="Remove "]');
    if ((await remove.count()) === 0) break;
    await row.locator(".run-bar").first().hover();
    await remove.first().click();
    await ops2.page.waitForTimeout(700);
  }
  await ops2.page.goto(`${BASE}/dispatch/vehicles`);
  const card = ops2.page.locator(`details.card:has-text("${van}")`).first();
  await card.locator("summary").click();
  await card.locator('button:has-text("Retire")').click();
  await ops2.page.waitForTimeout(900);
  check(
    "the suite puts the shop and the fleet back",
    (await ops2.page.textContent("body")).includes("Retired"),
  );
  await ops2.ctx.close();

  // And a DJ still cannot reach any of it.
  const dj = await signIn("jordan@piper.test");
  await dj.page.goto(`${BASE}/dispatch/history`);
  check("a DJ cannot see who drove", !dj.page.url().includes("/history"), dj.page.url());
  await dj.ctx.close();
}

/* ---------- 26. the Gantt, and that it stays out of the board ---------- */
{
  const stamp = Date.now();
  const ops = await signIn("owner@piper.test");

  const van = `Gantt Van ${stamp}`;
  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  await ops.page.fill('form:has(button:has-text("Add vehicle")) input[name="name"]', van);
  await ops.page.click('button:has-text("Add vehicle")');
  await ops.page.waitForTimeout(900);

  await ops.page.goto(`${BASE}/dispatch/gantt`);
  check("the Gantt says what it is not", (await ops.page.textContent("body")).includes("not the schedule"));

  const row = ops.page.locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`);
  const cell = row.locator(".gantt-cell").nth(8);

  // One click cycles: empty -> needed -> booked -> empty.
  await cell.click();
  await ops.page.waitForTimeout(900);
  check("a click plans a needed day", ((await cell.getAttribute("class")) ?? "").includes("run-needed"));
  await cell.click();
  await ops.page.waitForTimeout(900);
  check("a second click books it", ((await cell.getAttribute("class")) ?? "").includes("run-booked"));

  await ops.page.reload();
  await ops.page.waitForTimeout(700);
  const after = ops.page
    .locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`)
    .locator(".gantt-cell")
    .nth(8);
  check("and it survives a reload", ((await after.getAttribute("class")) ?? "").includes("run-booked"));

  await after.click();
  await ops.page.waitForTimeout(900);
  check("a third click clears it", !((await after.getAttribute("class")) ?? "").includes("run-"));

  // Right-click opens the dialog for the states a single click cannot reach.
  const dialogCell = ops.page
    .locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`)
    .locator(".gantt-cell")
    .nth(10);
  await dialogCell.click({ button: "right" });
  await ops.page.waitForTimeout(500);
  check("right-click opens the editor", (await ops.page.locator(".gantt-dialog").count()) === 1);

  await ops.page.selectOption("#state", "pynx");
  await ops.page.fill("#note", `Plan ${stamp}`);
  await ops.page.click('.gantt-dialog button:has-text("Save")');
  await ops.page.waitForTimeout(1400);
  check(
    "the dialog can set a state a click cannot",
    (await ops.page.locator(".gantt-cell.run-pynx").count()) > 0,
  );
  check("and its note shows on the chart", (await ops.page.textContent("body")).includes(`Plan ${stamp}`));

  // Slots: a hired class gets three rows, an owned vehicle one, and they are
  // independent of each other.
  {
    const cube = ops.page.locator(`.board-grid-row:has(.board-grid-name:has-text("Cube van"))`);
    const owned = ops.page.locator(`.board-grid-row:has(.board-grid-name:has-text("Pynx Cargo"))`);
    await ops.page.goto(`${BASE}/dispatch/gantt`);
    check("a hired class gets three slots", (await cube.locator(".gantt-track").count()) === 3);
    check("a vehicle Pynx owns gets one", (await owned.locator(".gantt-track").count()) === 1);

    const first = cube.locator(".gantt-track").nth(0).locator(".gantt-cell").nth(6);
    const second = cube.locator(".gantt-track").nth(1).locator(".gantt-cell").nth(6);
    const third = cube.locator(".gantt-track").nth(2).locator(".gantt-cell").nth(6);
    await first.click();
    await ops.page.waitForTimeout(900);
    check(
      "planning one slot leaves the others alone",
      !((await second.getAttribute("class")) ?? "").includes("run-") &&
        !((await third.getAttribute("class")) ?? "").includes("run-"),
    );

    await second.click();
    await ops.page.waitForTimeout(900);
    await ops.page.reload();
    await ops.page.waitForTimeout(800);
    const cube2 = ops.page.locator(`.board-grid-row:has(.board-grid-name:has-text("Cube van"))`);
    check(
      "each slot keeps its own plan across a reload",
      ((await cube2.locator(".gantt-track").nth(0).locator(".gantt-cell").nth(6).getAttribute("class")) ?? "").includes("run-needed") &&
        ((await cube2.locator(".gantt-track").nth(1).locator(".gantt-cell").nth(6).getAttribute("class")) ?? "").includes("run-needed"),
    );

    // Put them back. Clicking a fixed number of times assumes every click
    // lands, and a click that does not leaves a block on the shared fleet for
    // the next run of the suite to measure. Cycle until the square is bare.
    for (const cell of [
      cube2.locator(".gantt-track").nth(0).locator(".gantt-cell").nth(6),
      cube2.locator(".gantt-track").nth(1).locator(".gantt-cell").nth(6),
    ]) {
      for (let i = 0; i < 5; i++) {
        if (!((await cell.getAttribute("class")) ?? "").includes("run-")) break;
        await cell.click();
        await ops.page.waitForTimeout(800);
      }
    }
    await ops.page.reload();
    await ops.page.waitForTimeout(800);
    check(
      "the suite leaves the shared fleet's plan as it found it",
      (await ops.page
        .locator(`.board-grid-row:has(.board-grid-name:has-text("Cube van"))`)
        .locator(".gantt-cell.run-needed, .gantt-cell.run-booked")
        .count()) === 0,
    );
  }

  // The whole point: none of that reached the weekly board.
  await ops.page.goto(`${BASE}/dispatch?view=week`);
  check(
    "planning never books a vehicle",
    (await ops.page.locator(`.run-bar:has-text("Plan ${stamp}")`).count()) === 0,
  );

  // The recommender reads both surfaces.
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const suggestion = `li:has(strong:text-is("${van}"))`;
  await ops.page.goto(`${BASE}/dispatch/gantt?from=${day(60)}&to=${day(60)}`);
  let offered = await ops.page.textContent(suggestion);
  check("it can suggest a free vehicle", (offered ?? "").includes("3 of 3 free"), offered ?? "none");

  // Book it on the board and the count comes down rather than the vehicle
  // vanishing from the list: three of a hired kind can be out at once, so
  // answering "spoken for" after the first would send somebody phoning round
  // for a van that is sitting on the lot.
  for (let i = 1; i <= 3; i++) {
    await ops.page.goto(`${BASE}/dispatch?view=week&week=${day(60)}`);
    await ops.page.selectOption("#vehicle_id", { label: van });
    await ops.page.fill("#label", `Taken ${i} ${stamp}`);
    await ops.page.fill("#starts_on", day(60));
    await ops.page.click('button:has-text("Send it out")');
    await ops.page.waitForTimeout(1200);

    await ops.page.goto(`${BASE}/dispatch/gantt?from=${day(60)}&to=${day(60)}`);
    offered = await ops.page.textContent(suggestion);
    if (i < 3) {
      check(
        `booking one takes a slot off the count (${i} of 3)`,
        (offered ?? "").includes(`${3 - i} of 3 free`),
        offered ?? "none",
      );
    }
  }
  check(
    "and once every slot is out it stops being offered",
    (offered ?? "").includes("Spoken for"),
    offered ?? "none",
  );
  check(
    "and says what is in the way",
    (offered ?? "").includes(`booked: Taken 1 ${stamp}`),
    offered ?? "none",
  );

  // Clear the row, then undo it.
  await ops.page.goto(`${BASE}/dispatch/gantt`);
  await ops.page.selectOption("#clear_vehicle", { label: van });
  await ops.page.click('button:has-text("Clear")');
  await ops.page.waitForTimeout(1200);
  check("clearing a row reports back", (await ops.page.textContent("body")).includes(`Cleared ${van}`));
  check(
    "and the row is empty",
    (await ops.page
      .locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`)
      .locator(".gantt-cell.run-pynx")
      .count()) === 0,
  );

  await ops.page.click('button:has-text("Undo")');
  await ops.page.waitForTimeout(1200);
  check(
    "undo puts it back",
    (await ops.page
      .locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`)
      .locator(".gantt-cell.run-pynx")
      .count()) > 0,
  );

  // Clean up: the board run, then the vehicle (its cells go with it).
  await ops.page.goto(`${BASE}/dispatch?week=${day(60)}`);
  const boardRow = ops.page.locator(`.board-grid-row:has(.board-grid-name:has-text("${van}"))`);
  for (let i = 0; i < 4; i++) {
    const remove = boardRow.locator('button[aria-label^="Remove "]');
    if ((await remove.count()) === 0) break;
    await boardRow.locator(".run-bar").first().hover();
    await remove.first().click();
    await ops.page.waitForTimeout(700);
  }
  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  const card = ops.page.locator(`details.card:has-text("${van}")`).first();
  await card.locator("summary").click();
  await card.locator('button:has-text("Retire")').click();
  await ops.page.waitForTimeout(900);
  check("the suite retires its vehicle", (await ops.page.textContent("body")).includes("Retired"));
  await ops.ctx.close();

  const dj = await signIn("jordan@piper.test");
  await dj.page.goto(`${BASE}/dispatch/gantt`);
  check("a DJ cannot reach the Gantt", !dj.page.url().includes("/gantt"), dj.page.url());
  await dj.ctx.close();
}

/* ---------- 27. mail configured from inside the app ---------- */
{
  const stamp = Date.now();
  const ops = await signIn("owner@piper.test");

  // Start from a known state rather than assuming one. A previous run that
  // died mid-section would otherwise leave mail configured and every
  // assertion here would be measuring that instead of this run.
  await ops.page.goto(`${BASE}/settings`);
  const stop = ops.page.locator('form#mail-form button:has-text("Stop sending email")');
  if ((await stop.count()) > 0) {
    await stop.click();
    await ops.page.waitForTimeout(1200);
  }

  await ops.page.goto(`${BASE}/settings`);
  const before = await ops.page.textContent("body");
  check("mail reports itself unconfigured to begin with", before.includes("Not configured"));

  // Saving needs the parts that actually matter.
  await ops.page.fill("#host", "127.0.0.1");
  await ops.page.fill("#from", `Pynx <office+${stamp}@pynxpro.ca>`);
  await ops.page.locator('form#mail-form button:has-text("Save mail settings")').click();
  await ops.page.waitForTimeout(1000);
  const noPass = (await ops.page.locator(".alert-error").count())
    ? await ops.page.locator(".alert-error").first().textContent()
    : "";
  check("a save without a password is refused", (noPass ?? "").includes("password"), noPass ?? "none");

  await ops.page.fill("#pass", `secret-${stamp}`);
  await ops.page.locator('form#mail-form button:has-text("Save mail settings")').click();
  await ops.page.waitForTimeout(1200);
  check("with one, it saves", (await ops.page.textContent("body")).includes("Mail settings saved"));

  await ops.page.reload();
  await ops.page.waitForTimeout(600);
  check("and reports where it came from", (await ops.page.textContent("body")).includes("Configured here"));
  check(
    "the password never reaches the browser",
    !(await ops.page.content()).includes(`secret-${stamp}`),
    "not in page source",
  );
  check(
    "the form says one is stored",
    ((await ops.page.getAttribute("#pass", "placeholder")) ?? "").includes("Stored"),
  );

  // A blank password on a later save keeps the stored one rather than wiping it.
  await ops.page.fill("#replyTo", `replies+${stamp}@pynxpro.ca`);
  await ops.page.locator('form#mail-form button:has-text("Save mail settings")').click();
  await ops.page.waitForTimeout(1200);
  check(
    "editing another field keeps the password",
    (await ops.page.textContent("body")).includes("Mail settings saved"),
  );
  await ops.page.reload();
  await ops.page.waitForTimeout(600);
  check("still configured after that", (await ops.page.textContent("body")).includes("Configured here"));

  // The outbox stops complaining once mail exists.
  await ops.page.goto(`${BASE}/outbox`);
  check(
    "the outbox no longer says mail is unset",
    !(await ops.page.textContent("body")).includes("No mail server is configured"),
  );

  // A test send against a server that is not there fails honestly rather than
  // claiming success.
  await ops.page.goto(`${BASE}/settings`);
  await ops.page.fill("#host", "127.0.0.1");
  await ops.page.fill("#pass", "whatever");
  await ops.page.fill("#to", "someone@pynxpro.ca");
  await ops.page.locator('form#mail-form button:has-text("Send a test")').click();
  await ops.page.waitForTimeout(4000);
  check(
    "a failing test reports the refusal",
    ((await ops.page.textContent("body")) ?? "").includes("refused it"),
  );

  // Emptying the boxes is not a way out — saving refuses a blank server — so
  // there is a button for it.
  await ops.page.goto(`${BASE}/settings`);
  await ops.page.fill("#host", "");
  await ops.page.locator('form#mail-form button:has-text("Save mail settings")').click();
  await ops.page.waitForTimeout(1200);
  // Either the browser's own required-check or the server refuses it; what
  // matters is that emptying the box does not quietly unconfigure mail.
  await ops.page.reload();
  await ops.page.waitForTimeout(700);
  check(
    "a blank server is refused rather than half-saved",
    (await ops.page.textContent("body")).includes("Configured here"),
  );
  await ops.page.locator('form#mail-form button:has-text("Stop sending email")').click();
  await ops.page.waitForTimeout(1200);
  await ops.page.reload();
  await ops.page.waitForTimeout(600);
  check(
    "the suite leaves mail unconfigured again",
    (await ops.page.textContent("body")).includes("Not configured"),
  );
  await ops.ctx.close();
}

/* ---------- 28. the standing fleet is a fixture ---------- */
{
  const ops = await signIn("owner@piper.test");

  // The vehicle column is the fleet, in the shop's own order — hires by size,
  // then the van Pynx owns. Not alphabetical, which opens the sheet with the
  // 26 ft truck, and not a list of whatever happens to have been booked.
  const STANDING = [
    "Cargo van",
    "Cube van",
    "26 ft truck",
    "Passenger vehicle",
    "Mini van",
    "Pynx Cargo",
  ];

  for (const [page_, where] of [
    [`${BASE}/dispatch/gantt`, "the Gantt"],
    [`${BASE}/dispatch`, "the board"],
  ]) {
    await ops.page.goto(page_);
    await ops.page.waitForTimeout(1200);
    const column = await ops.page.locator(".board-grid-name > div:first-child").allTextContents();
    const standingOnly = column.filter((n) => STANDING.includes(n));
    check(
      `${where} lists the whole standing fleet`,
      STANDING.every((n) => column.includes(n)),
      column.join(", "),
    );
    check(
      `${where} lists it in the shop's order`,
      standingOnly.join("|") === STANDING.join("|"),
      standingOnly.join(", "),
    );
  }

  // Rows are a fixture, not a product of the data: an empty month still has
  // every vehicle in it.
  await ops.page.goto(`${BASE}/dispatch/gantt?at=2029-11-01`);
  await ops.page.waitForTimeout(1200);
  const empty = await ops.page.locator(".board-grid-name > div:first-child").allTextContents();
  check(
    "a month with nothing planned still shows every vehicle",
    STANDING.every((n) => empty.includes(n)),
    empty.join(", "),
  );

  // Retiring one takes it off the chart and it does not come back — the fleet
  // is established, not enforced.
  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  const card = ops.page.locator('details.card:has-text("Mini van")').first();
  await card.locator("summary").click();
  await card.locator('button:has-text("Retire")').click();
  await ops.page.waitForTimeout(1000);
  await ops.page.goto(`${BASE}/dispatch/gantt`);
  await ops.page.waitForTimeout(1000);
  const retired = await ops.page.locator(".board-grid-name > div:first-child").allTextContents();
  check("a retired vehicle leaves the chart", !retired.includes("Mini van"), retired.join(", "));

  // Put it back the way the fleet page does, so the suite leaves no mark. The
  // retired list sits at the foot of the same page.
  await ops.page.goto(`${BASE}/dispatch/vehicles`);
  await ops.page
    .locator('li:has-text("Mini van"):has(button:has-text("Put it back"))')
    .first()
    .locator('button:has-text("Put it back")')
    .click();
  await ops.page.waitForTimeout(1000);
  await ops.page.goto(`${BASE}/dispatch/gantt`);
  await ops.page.waitForTimeout(1000);
  const restored = await ops.page.locator(".board-grid-name > div:first-child").allTextContents();
  check("and the suite puts it back", restored.includes("Mini van"), restored.join(", "));

  await ops.ctx.close();
}

await admin.ctx.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
