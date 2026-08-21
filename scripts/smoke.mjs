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

await admin.ctx.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
