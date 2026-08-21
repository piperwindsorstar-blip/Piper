/**
 * Responsive checks. Loads every screen at four widths and asserts the layout
 * actually adapts — no page scrolls sideways, the calendar swaps its grid for
 * an agenda on phones, the nav collapses behind a toggle, and stacked table
 * rows keep their column labels.
 *
 *   npm run build && npm run start     # in one shell
 *   npm run responsive                 # in another
 *
 * Screenshots for the phone and desktop widths land in the directory given as
 * the first argument (default ./responsive-shots).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.PIPER_URL ?? "http://localhost:3000";

const OUT = process.argv[2] ?? "responsive-shots";
fs.mkdirSync(OUT, { recursive: true });
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
  : {};
const browser = await chromium.launch(launchOptions);

const DEVICES = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "small", width: 360, height: 780, mobile: true },
  { name: "tablet", width: 820, height: 1180, mobile: true },
  { name: "desktop", width: 1360, height: 940, mobile: false },
];

let failures = 0;
for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    isMobile: d.mobile,
    hasTouch: d.mobile,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "owner@piper.test");
  await page.fill("#password", "piper1234");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");

  const pages = [
    ["dashboard", "/dashboard"],
    ["calendar", "/calendar"],
    ["events", "/events"],
    ["event", "/events/1"],
    ["music", "/events/1/music"],
    ["timeline", "/events/1/timeline"],
    ["newevent", "/events/new"],
    ["team", "/team"],
    ["staff-member", "/team/3"],
    ["me", "/me"],
  ];

  for (const [label, path] of pages) {
    await page.goto(BASE + path);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }));
    if (r.doc > r.win + 1) {
      console.log(`OVERFLOW ${d.name}/${label}: doc=${r.doc} win=${r.win}`);
      failures++;
    }
    if (d.name === "phone" || d.name === "desktop") {
      await page.screenshot({ path: `${OUT}/${d.name}-${label}.png`, fullPage: label === "dashboard" || label === "calendar" });
    }
  }

  // The calendar must show exactly one of its two views.
  await page.goto(`${BASE}/calendar`);
  await page.waitForTimeout(300);
  const gridVisible = await page.locator(".cal-month").first().isVisible();
  const agendaVisible = await page.locator(".cal-agenda").isVisible();
  const expectAgenda = d.width <= 760;
  const ok = expectAgenda ? agendaVisible && !gridVisible : gridVisible && !agendaVisible;
  console.log(`${ok ? "ok      " : "WRONG   "} ${d.name} calendar: grid=${gridVisible} agenda=${agendaVisible} (expected ${expectAgenda ? "agenda" : "grid"})`);
  if (!ok) failures++;

  // Nav: collapsed behind a toggle on phones, always open on desktop.
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(300);
  const toggle = page.locator(".nav-toggle");
  const toggleVisible = await toggle.isVisible();
  const navVisible = await page.locator(".nav a").first().isVisible();
  if (d.width <= 760) {
    const collapsed = toggleVisible && !navVisible;
    console.log(`${collapsed ? "ok      " : "WRONG   "} ${d.name} nav collapsed by default`);
    if (!collapsed) failures++;
    await toggle.click();
    await page.waitForTimeout(250);
    const opened = await page.locator(".nav a").first().isVisible();
    console.log(`${opened ? "ok      " : "WRONG   "} ${d.name} nav opens on tap`);
    if (!opened) failures++;
    await page.screenshot({ path: `${OUT}/${d.name}-nav-open.png` });
    // Tapping a link navigates and the menu closes again.
    await page.locator(".nav a", { hasText: "Events" }).first().click();
    await page.waitForURL("**/events");
    await page.waitForTimeout(400);
    const closed = !(await page.locator(".nav a").first().isVisible());
    console.log(`${closed ? "ok      " : "WRONG   "} ${d.name} nav closes after navigating`);
    if (!closed) failures++;
  } else {
    const alwaysOpen = !toggleVisible && navVisible;
    console.log(`${alwaysOpen ? "ok      " : "WRONG   "} ${d.name} nav always visible`);
    if (!alwaysOpen) failures++;
  }

  // Stacked table cards must be labelled on phones.
  if (d.width <= 760) {
    await page.goto(`${BASE}/events`);
    await page.waitForTimeout(300);
    const label = await page.evaluate(() => {
      const td = document.querySelector("table.stacking td[data-label='Couple']");
      return td ? getComputedStyle(td, "::before").content : "none";
    });
    const labelled = label.includes("Couple");
    console.log(`${labelled ? "ok      " : "WRONG   "} ${d.name} table rows show column labels (${label})`);
    if (!labelled) failures++;
  }

  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nAll responsive checks passed" : `\n${failures} responsive problems`);
process.exit(failures ? 1 : 0);
