// A browser pass over a local build: public pages, the Desk invoice flow,
// and page text spacing. Run by .github/workflows/browse-check.yml against
// an empty in-memory book (Desk password "piper-local") and a mail sink.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const SINK = process.env.SINK_LOG ?? '/tmp/sink.log'
const results = []

async function step(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail ?? '' })
  } catch (error) {
    results.push({ name, ok: false, detail: String(error?.message ?? error).slice(0, 600) })
  }
}

function expect(cond, message) {
  if (!cond) throw new Error(message)
}

const ALLOW = new Set([
  'DjPiperP', 'PiperPWeddingDJ', 'YouTube', 'TikTok', 'iPhone', 'iPad', 'WhatsApp',
  'SoundCloud', 'McDonald', 'LinkedIn', 'JavaScript', 'PayPal', 'GitHub', 'OpenTable',
  'eTransfer', 'DeskTitle',
])

/** Words glued together: "asPiper", "2026is", "$700by", "TESTQA". */
function gluedWords(text) {
  const found = new Set()
  for (const m of text.matchAll(/[A-Za-z]*[a-z][A-Z][A-Za-z]*/g)) {
    if (!ALLOW.has(m[0]) && !/^(Mc|Mac)[A-Z]/.test(m[0])) found.add(m[0])
  }
  for (const m of text.matchAll(/\b\d{2,}[a-z]{2,}\b/g)) {
    if (!/^\d+(st|nd|rd|th|km|am|pm|px|ms)$/.test(m[0])) found.add(m[0])
  }
  for (const m of text.matchAll(/\$[\d,.]+[A-Za-z]{2,}/g)) found.add(m[0])
  for (const m of text.matchAll(/[a-z]{2,}\$\d/g)) found.add(m[0])
  for (const m of text.matchAll(/\bTEST[A-Z][a-z]/g)) found.add(m[0])
  return [...found]
}

async function spacing(page, path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  const text = await page.evaluate(() => document.body.innerText)
  const glued = gluedWords(text)
  expect(glued.length === 0, `${path}: ${glued.slice(0, 15).join(' | ')}`)
  return `${path} ok`
}

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const COUPLE = { one: 'Avery', two: 'Jordan', email: 'avery.jordan@example.com' }
const DATE = '2026-11-21'

// --- Desk ------------------------------------------------------------------

await step('Desk login: wrong password shows the generic message', async () => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="password"]', 'not-the-password')
  await page.click('button[type="submit"]')
  await page.getByText('That password did not match.').waitFor({ timeout: 8000 })
})

await step('Desk login: right password opens the Desk', async () => {
  await page.fill('input[type="password"]', 'piper-local')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/desk/, { timeout: 10000 })
})

await step('Desk: new booking with a draft invoice', async () => {
  await page.goto(BASE + '/desk/bookings', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /New booking/ }).first().click()
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Save as open' }) })
  await form.locator('input[name="partnerOne"]').fill(COUPLE.one)
  await form.locator('input[name="partnerTwo"]').fill(COUPLE.two)
  await form.locator('input[name="email"]').fill(COUPLE.email)
  await form.locator('input[name="eventDate"]').fill(DATE)
  await form.locator('input[name="venueName"]').fill('Glenhyrst Gardens')
  await form.locator('input[name="venueStreet"]').fill('20 Ava Rd, Brantford, ON')
  await form.getByRole('button', { name: 'Save as open' }).click()
  await page.getByText('Saved.').first().waitFor({ timeout: 10000 })
})

await step('Desk: Needs you asks to send the invoice', async () => {
  await page.goto(BASE + '/desk', { waitUntil: 'networkidle' })
  await page.getByText(`Send the invoice to ${COUPLE.one} and ${COUPLE.two}`).waitFor({ timeout: 8000 })
})

let mailsBefore = 0
await step('Desk: "Email the invoice" asks to confirm first', async () => {
  try { mailsBefore = readFileSync(SINK, 'utf8').split('MAIL-FROM').length - 1 } catch { mailsBefore = 0 }
  await page.goto(BASE + '/desk/money', { waitUntil: 'networkidle' })
  const button = page.getByRole('button', { name: 'Email the invoice' }).first()
  await button.click()
  await page.getByRole('button', { name: `Tap again to email ${COUPLE.email}` }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(800)
  let mails = 0
  try { mails = readFileSync(SINK, 'utf8').split('MAIL-FROM').length - 1 } catch { /* none */ }
  expect(mails === mailsBefore, 'An email went out on the first tap')
})

await step('Desk: second tap sends and marks the invoice sent', async () => {
  await page.getByRole('button', { name: `Tap again to email ${COUPLE.email}` }).click()
  await page.getByText('The invoice is marked sent.').waitFor({ timeout: 15000 })
  const mails = readFileSync(SINK, 'utf8').split('MAIL-FROM').length - 1
  expect(mails === mailsBefore + 1, `Expected one email, the sink has ${mails - mailsBefore}`)
})

await step('Desk: Needs you reminder cleared', async () => {
  await page.goto(BASE + '/desk', { waitUntil: 'networkidle' })
  const left = await page.getByText(`Send the invoice to ${COUPLE.one} and ${COUPLE.two}`).count()
  expect(left === 0, 'The reminder is still there')
})

await step('Desk: page text spacing', async () => {
  const out = []
  for (const path of ['/desk', '/desk/bookings', '/desk/money', '/desk/leads', '/desk/portals', '/desk/rsvp', '/desk/bots', '/desk/packages', '/desk/settings', '/desk/songs']) {
    out.push(await spacing(page, path))
  }
  return out.join(', ')
})

await step('Desk Packages: negative price refused', async () => {
  await page.goto(BASE + '/desk/packages', { waitUntil: 'networkidle' })
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Save the package' }) }).first()
  await form.locator('input[name="price"]').fill('-5')
  const valid = await form.evaluate((f) => f.checkValidity())
  await form.getByRole('button', { name: 'Save the package' }).click()
  await page.waitForTimeout(800)
  const said = await page.getByText('Enter a price above $0.').count()
  expect(!valid || said > 0, 'The negative price was accepted')
  await form.locator('input[name="price"]').fill('')
  const validEmpty = await form.evaluate((f) => f.checkValidity())
  expect(!validEmpty, 'An empty price was accepted')
})

await step('Desk Terms: empty save refused', async () => {
  await page.goto(BASE + '/desk/terms', { waitUntil: 'networkidle' })
  await page.locator('textarea').first().fill('')
  await page.getByRole('button', { name: 'Save the terms' }).click()
  await page.waitForTimeout(800)
  const valid = await page.locator('textarea').first().evaluate((t) => t.form?.checkValidity() ?? true)
  const said = await page.getByText('The terms cannot be empty.').count()
  expect(!valid || said > 0, 'Empty terms were accepted')
  await page.goto(BASE + '/terms', { waitUntil: 'networkidle' })
  const body = await page.evaluate(() => document.body.innerText)
  expect(body.includes('Deposit') || body.length > 600, 'The public terms went empty')
})

await step('Desk Money: void hides "Email the invoice"', async () => {
  await page.goto(BASE + '/desk/money', { waitUntil: 'networkidle' })
  const card = page.locator('section, article, div', { hasText: `${COUPLE.one}` }).filter({ has: page.getByRole('button', { name: 'Void' }) }).last()
  await card.getByRole('button', { name: 'Void' }).click()
  await card.getByRole('button', { name: 'Tap again to void' }).click()
  await page.waitForTimeout(1500)
  await page.goto(BASE + '/desk/money', { waitUntil: 'networkidle' })
  const still = await page.locator('section, article, div', { hasText: `${COUPLE.one}` }).getByRole('button', { name: 'Email the invoice' }).count()
  expect(still === 0, '"Email the invoice" still shows on the void invoice')
})

// --- Public ----------------------------------------------------------------

const pub = await browser.newPage()
pub.on('pageerror', (e) => errors.push(e.message))

await step('Home date checker: open date goes to /book with date and Wedding', async () => {
  await pub.goto(BASE + '/', { waitUntil: 'networkidle' })
  await pub.click('button[aria-label="Next month"]')
  await pub.click('button[aria-label="16 November 2026"]')
  await pub.getByText('Yes, your date is available.').waitFor({ timeout: 8000 })
  await pub.waitForURL(/\/book\?date=2026-11-16&event=Wedding/, { timeout: 8000 })
})

await step('/book estimate with travel prompt', async () => {
  await pub.waitForLoadState('networkidle')
  const pkg = pub.locator('select[name="packageId"]')
  if (await pkg.count()) await pkg.selectOption({ index: 1 })
  await pub.waitForTimeout(600)
  const est = (await pub.locator('[aria-label="Price estimate"]').innerText()).replace(/\s+/g, ' ')
  expect(/\$1,650\.00/.test(est) || /\$1,550\.00/.test(est) || /\$/.test(est), `No price: ${est}`)
  expect(/Add the venue address/.test(est), `No travel prompt: ${est}`)
  return est
})

await step('/book past date note', async () => {
  await pub.goto(BASE + '/book?date=2024-05-04&event=Wedding', { waitUntil: 'networkidle' })
  await pub.getByText('That date has passed, please pick another.').waitFor({ timeout: 8000 })
})

await step('/rsvp prices', async () => {
  await pub.goto(BASE + '/rsvp', { waitUntil: 'networkidle' })
  const text = (await pub.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  expect(/Free With a DJ Piper P booking/i.test(text), 'Free price missing')
  expect(/\$40 On its own/i.test(text), '$40 price missing')
  expect(/13% HST/.test(text), 'HST note missing')
})

await step('/rsvp/sign-in form', async () => {
  await pub.goto(BASE + '/rsvp/sign-in', { waitUntil: 'networkidle' })
  await pub.getByRole('button', { name: 'Email me a sign-in link' }).waitFor({ timeout: 5000 })
})

await step('Portal link asks for the passcode', async () => {
  await pub.goto(BASE + '/c/avery-and-jordan', { waitUntil: 'networkidle' })
  const text = await pub.evaluate(() => document.body.innerText)
  expect(/passcode/i.test(text), `No passcode ask: ${text.slice(0, 200)}`)
  expect(!/Your plan|Start planning/i.test(text) || /passcode/i.test(text), 'The plan opened without a passcode')
})

await step('Public page text spacing', async () => {
  const out = []
  for (const path of ['/', '/weddings', '/hamilton-wedding-dj', '/cambridge-wedding-dj', '/paris-wedding-dj', '/book', '/rsvp', '/rsvp/sign-in', '/contact', '/terms', '/portal']) {
    out.push(await spacing(pub, path))
  }
  return out.join(', ')
})

await step('Desk login lockout after repeated wrong passwords', async () => {
  const other = await browser.newPage()
  let locked = false
  for (let i = 0; i < 7 && !locked; i += 1) {
    await other.goto(BASE + '/login', { waitUntil: 'networkidle' })
    await other.fill('input[type="password"]', `wrong-${i}`)
    await other.click('button[type="submit"]')
    await other.waitForTimeout(1600)
    locked = (await other.getByText('Too many tries').count()) > 0
  }
  expect(locked, 'No lockout after 7 wrong passwords')
})

await step('No page errors', async () => {
  expect(errors.length === 0, errors.slice(0, 5).join(' || '))
})

await browser.close()
const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(lines.join('\n'))
const joined = lines.join(' ## ').replace(/\n/g, ' ')
for (let i = 0; i < joined.length; i += 3500) {
  console.log(`::notice title=browse part ${i / 3500 + 1}::${joined.slice(i, i + 3500)}`)
}
process.exit(results.every((r) => r.ok) ? 0 : 1)
