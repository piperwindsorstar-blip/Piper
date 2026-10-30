// A browser pass over a local build: public pages, the Desk invoice flow,
// and page text spacing. Run by .github/workflows/browse-check.yml against
// an empty in-memory book (Desk password "piper-local") and a mail sink.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createHmac } from 'node:crypto'

/** Authenticator codes for the 2FA steps (RFC 6238, SHA-1, 6 digits). */
function base32(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const out = []
  for (const char of text.replace(/[^A-Z2-7]/gi, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}
function totp(secret, step) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', base32(secret)).update(counter).digest()
  const offset = mac[19] & 15
  const n = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]
  return String(n % 1000000).padStart(6, '0')
}
const nowStep = () => Math.floor(Date.now() / 30000)
let usedStep = 0
/** A code whose time step has not been used yet (waits if both nearby steps are). */
async function freshCode(secret) {
  let step = Math.max(nowStep(), usedStep + 1)
  while (step > nowStep() + 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    step = Math.max(nowStep(), usedStep + 1)
  }
  usedStep = step
  return totp(secret, step)
}
const TWO_FA = { secret: '', backup: [] }

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const SINK = process.env.SINK_LOG ?? '/tmp/sink.log'
const results = []

async function step(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail ?? '' })
  } catch (error) {
    results.push({ name, ok: false, detail: String(error?.message ?? error).split('Call log')[0].slice(0, 400) })
  }
  const last = results.at(-1)
  console.log(`${last.ok ? 'PASS' : 'FAIL'} ${last.name} ${last.detail}`)
}

function expect(cond, message) {
  if (!cond) throw new Error(message)
}

const ALLOW = new Set([
  'DjPiperP', 'PiperPWeddingDJ', 'YouTube', 'TikTok', 'iPhone', 'iPad', 'WhatsApp',
  'SoundCloud', 'McDonald', 'LinkedIn', 'JavaScript', 'PayPal', 'GitHub', 'OpenTable',
  'eTransfer', 'DeskTitle', 'GigBAR', 'EliteBook', 'AmazonBasics', 'DJControl', 'HUANCHAIN', 'BnD',
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
  await page.waitForTimeout(1500)
  const text = await page.evaluate(() => document.body.innerText)
  const glued = gluedWords(text)
  expect(glued.length === 0, `${path}: ${glued.slice(0, 15).join(' | ')}`)
  return `${path} ok`
}

const browser = await chromium.launch()
const page = await browser.newPage()
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(25000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const COUPLE = { one: 'Avery', two: 'Jordan', email: 'avery.jordan@example.com' }
const DATE = '2026-11-21'

// --- Desk ------------------------------------------------------------------

await step('Desk login: wrong password shows the generic message', async () => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="password"]', 'not-the-password')
  await page.click('button[type="submit"]')
  await page.getByText('That did not match. Check it and try again.').waitFor({ timeout: 8000 })
})

await step('2FA: the first sign-in sets it up (QR, typed key, confirm code, backup codes)', async () => {
  await page.fill('input[type="password"]', 'piper-local')
  await page.click('button[type="submit"]')
  await page.getByText('Set up two-step sign-in').waitFor({ timeout: 15000 })
  const qr = await page.locator('[aria-label="QR code for your authenticator app"] svg').count()
  TWO_FA.secret = (await page.locator('[data-2fa-secret]').innerText()).replace(/\s/g, '')
  expect(qr === 1, 'No QR code')
  expect(/^[A-Z2-7]{32}$/.test(TWO_FA.secret), `Secret looks wrong: ${TWO_FA.secret}`)
  // A wrong code does not turn it on.
  await page.fill('input[name="code"]', '000000')
  await page.click('button[type="submit"]')
  await page.getByText('That did not match. Check it and try again.').waitFor({ timeout: 8000 })
  expect(page.url().includes('/login'), 'A wrong code let the Desk open')
  await page.fill('input[name="code"]', await freshCode(TWO_FA.secret))
  await page.click('button[type="submit"]')
  await page.getByText('Save your backup codes').waitFor({ timeout: 15000 })
  TWO_FA.backup = (await page.locator('[data-2fa-backup] li').allInnerTexts()).map((t) => t.trim())
  expect(TWO_FA.backup.length === 10, `${TWO_FA.backup.length} backup codes`)
  await page.getByRole('button', { name: 'I saved them. Open the desk' }).click()
  await page.waitForURL(/\/desk/, { timeout: 30000 })
  return `secret ${TWO_FA.secret.slice(0, 4)}…, ${TWO_FA.backup.length} backup codes`
})

await step('Desk: new booking with a draft invoice', async () => {
  await page.goto(BASE + '/desk/bookings', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /New booking/ }).first().click()
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Save as open' }) })
  await form.locator('input[name="partnerOne"]').fill(COUPLE.one)
  await form.locator('input[name="partnerTwo"]').fill(COUPLE.two)
  await form.locator('input[name="email"]').fill(COUPLE.email)
  await form.locator('input[name="emailTwo"]').fill('jordan.second@example.com')
  await form.locator('input[name="eventDate"]').fill(DATE)
  await form.locator('input[name="venueName"]').fill('Glenhyrst Gardens')
  await form.locator('input[name="venueStreet"]').fill('20 Ava Rd, Brantford, ON')
  await form.getByRole('button', { name: 'Save as open' }).click()
  await page.waitForTimeout(2500)
})

await step('Desk: Needs you asks to send the invoice', async () => {
  await page.goto(BASE + '/desk', { waitUntil: 'networkidle' })
  const item = page.locator('li', { hasText: new RegExp(`Send the \\$[\\d,]+ invoice to ${COUPLE.one} and ${COUPLE.two}`) }).first()
  await item.waitFor({ timeout: 8000 })
  const text = (await item.innerText()).replace(/\s+/g, ' ')
  expect(text.includes('21 November 2026'), `Alert has no wedding date: ${text}`)
  return text
})

let mailsBefore = 0
await step('Desk: "Email the invoice" asks to confirm first', async () => {
  try { mailsBefore = readFileSync(SINK, 'utf8').split('MAIL-FROM').length - 1 } catch { mailsBefore = 0 }
  await page.goto(BASE + '/desk/money?tab=invoices', { waitUntil: 'networkidle' })
  const button = page.getByRole('button', { name: 'Email the invoice' }).first()
  await button.click()
  await page.getByRole('button', { name: `Tap again to email ${COUPLE.email}` }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(800)
  let mails = 0
  try { mails = readFileSync(SINK, 'utf8').split('MAIL-FROM').length - 1 } catch { /* none */ }
  expect(mails === mailsBefore, 'An email went out on the first tap')
})

await step('Desk: second tap sends to both emails and marks the invoice sent', async () => {
  await page.getByRole('button', { name: `Tap again to email ${COUPLE.email}` }).click()
  await page.getByText('The invoice is marked sent.').waitFor({ timeout: 15000 })
  const mails = readFileSync(SINK, 'utf8').split('MAIL-FROM').length - 1
  expect(mails === mailsBefore + 2, `Expected two emails (both addresses), the sink has ${mails - mailsBefore}`)
  const log = readFileSync(SINK, 'utf8')
  expect(log.includes('jordan.second@example.com'), 'The second email got nothing')
})

await step('Desk: Needs you reminder cleared', async () => {
  await page.goto(BASE + '/desk', { waitUntil: 'networkidle' })
  const left = await page.getByText(new RegExp(`Send the \\$[\\d,]+ invoice to ${COUPLE.one} and ${COUPLE.two}`)).count()
  expect(left === 0, 'The reminder is still there')
})

await step('Desk Bookings: a past wedding moves to the Archive', async () => {
  await page.goto(BASE + '/desk/bookings', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /New booking/ }).first().click()
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Save as open' }) })
  await form.locator('input[name="partnerOne"]').fill('Morgan')
  await form.locator('input[name="partnerTwo"]').fill('Riley')
  await form.locator('input[name="email"]').fill('morgan.riley@example.com')
  await form.locator('input[name="eventDate"]').fill('2026-09-12')
  await form.locator('input[name="venueName"]').fill('Polish Hall')
  await form.getByRole('button', { name: 'Save as open' }).click()
  await page.waitForTimeout(2500)
  await page.goto(BASE + '/desk/bookings', { waitUntil: 'networkidle' })
  const onAll = await page.locator('main').getByText('Morgan & Riley').count()
  const archiveTab = page.getByRole('tab', { name: /Archive/ })
  await archiveTab.click()
  await page.waitForTimeout(500)
  const onArchive = await page.locator('main').getByText('Morgan & Riley').count()
  const avery = await page.locator('main').getByText(`${COUPLE.one} & ${COUPLE.two}`).count()
  expect(onAll === 0, 'The past wedding still shows on All')
  expect(onArchive > 0, 'The past wedding is not in the Archive')
  expect(avery === 0, 'An upcoming wedding shows in the Archive')
  await page.getByRole('tab', { name: /^All/ }).click()
  await page.getByRole('searchbox', { name: 'Search bookings' }).fill('Morgan')
  await page.getByText('1 past wedding matches in the Archive').waitFor({ timeout: 5000 })
  return `All ${onAll}, Archive ${onArchive}`
})

await step('Desk Money: a fully paid invoice shows as paid', async () => {
  await page.goto(BASE + '/desk/bookings', { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: /Archive/ }).click()
  const href = await page.locator('main a[href*="couple="]', { hasText: 'Morgan' }).first().getAttribute('href')
  const id = new URLSearchParams((href ?? '').split('?')[1] ?? '').get('couple')
  expect(id, `No booking link for Morgan: ${href}`)
  await page.goto(BASE + `/desk/money?couple=${id}`, { waitUntil: 'networkidle' })
  const form = page.locator('form', { hasText: 'Record a payment' })
  await form.locator('input[name=amount]').waitFor({ timeout: 10000 })
  const amount = await form.locator('input[name=amount]').inputValue()
  await form.getByRole('button', { name: 'Save payment' }).click()
  await page.waitForTimeout(2500)
  await page.goto(BASE + '/desk/money?tab=invoices', { waitUntil: 'networkidle' })
  const card = page.locator('li, article', { hasText: 'Morgan' }).last()
  const text = (await card.innerText()).replace(/\s+/g, ' ')
  expect(/\bpaid\b/i.test(text), `Invoice not shown as paid: ${text.slice(0, 200)}`)
  const link = await card.locator('a[href^="/p/"]').first().getAttribute('href', { timeout: 3000 }).catch(() => null)
  let pageNote = 'no invoice link'
  if (link) {
    const invoice = await page.request.get(BASE + link).then((r) => r.text()).catch(() => '')
    pageNote = invoice.includes('Paid in full') ? 'invoice page says Paid in full' : 'invoice page missing Paid in full'
    expect(invoice.includes('Paid in full'), pageNote)
  }
  return `paid $${amount}; ${pageNote}`
})

await step('Desk: page text spacing', async () => {
  const out = []
  for (const path of ['/desk', '/desk/bookings', '/desk/money', '/desk/leads', '/desk/portals', '/desk/rsvp', '/desk/bots', '/desk/packages', '/desk/settings', '/desk/songs', '/desk/vendors', '/desk/brands', '/desk/gear', '/desk/financials', '/desk/security']) {
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
  await page.goto(BASE + '/desk/money?tab=invoices', { waitUntil: 'networkidle' })
  const card = page.locator('li', { hasText: COUPLE.one }).first()
  await card.getByRole('button', { name: 'Void', exact: true }).click()
  await card.getByRole('button', { name: 'Tap again to void' }).click()
  await page.waitForTimeout(1500)
  await page.goto(BASE + '/desk/money?tab=invoices', { waitUntil: 'networkidle' })
  const still = await page.locator('li', { hasText: COUPLE.one }).getByRole('button', { name: 'Email the invoice' }).count()
  expect(still === 0, '"Email the invoice" still shows on the void invoice')
})

await step('Desk Vendors: http:// website refused', async () => {
  await page.goto(BASE + '/desk/vendors', { waitUntil: 'networkidle' })
  const form = page.locator('form', { hasText: 'Add a vendor' })
  await form.locator('input[name=name]').fill('Maple Hall')
  await form.locator('input[name=href]').evaluate((el) => el.removeAttribute('pattern'))
  await form.locator('input[name=href]').fill('http://maplehall.example.com')
  await form.getByRole('button', { name: 'Add the vendor' }).click()
  await page.getByText('must start with https://').first().waitFor({ timeout: 10000 })
})

await step('Desk Vendors: add a vendor with a big logo (shrunk) and one without', async () => {
  const big = await page.screenshot({ type: 'png' })
  await page.goto(BASE + '/desk/vendors', { waitUntil: 'networkidle' })
  let form = page.locator('form', { hasText: 'Add a vendor' })
  await form.locator('input[name=name]').fill('Willow Florals')
  await form.locator('select[name=categoryId]').selectOption({ label: 'Florists' })
  await form.locator('input[name=href]').fill('https://willowflorals.example.com')
  await form.locator('input[name=logo]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: big })
  await form.getByRole('button', { name: 'Add the vendor' }).click()
  await page.locator('li', { hasText: 'Willow Florals' }).first().waitFor({ timeout: 15000 })
  form = page.locator('form', { hasText: 'Add a vendor' })
  await form.locator('input[name=name]').fill('Maple Hall')
  await form.locator('select[name=categoryId]').selectOption({ label: 'Venues' })
  await form.locator('input[name=href]').fill('https://maplehall.example.com')
  await form.getByRole('button', { name: 'Add the vendor' }).click()
  await page.locator('li', { hasText: 'Maple Hall' }).first().waitFor({ timeout: 15000 })
  return `screenshot logo was ${big.length} bytes`
})

await step('Public /wedding-vendors lists them in the server HTML', async () => {
  const html = await (await page.request.get(BASE + '/wedding-vendors')).text()
  expect(html.includes('Willow Florals') && html.includes('Maple Hall'), 'Vendor names missing from the server HTML')
  expect(html.includes('>Florists<') && html.includes('>Venues<'), 'Category headings missing')
  expect(!html.includes('>Photographers<'), 'An empty category is showing')
  expect(html.includes('rel="noopener"') && html.includes('target="_blank"'), 'Links do not open in a new tab with noopener')
  expect(html.includes('alt="Willow Florals logo"'), 'Logo alt text missing')
  expect(/<link[^>]*rel="canonical"[^>]*\/wedding-vendors"/.test(html), 'Canonical missing')
  const v = await browser.newPage()
  await v.goto(BASE + '/wedding-vendors', { waitUntil: 'networkidle' })
  const size = await v.locator('img[alt="Willow Florals logo"]').evaluate((img) => [img.naturalWidth, img.naturalHeight, img.currentSrc])
  expect(size[0] > 0 && size[0] <= 600 && size[1] <= 300, `Logo not shrunk: ${size}`)
  const logo = await v.request.get(new URL(size[2]).href)
  const kb = Math.round((await logo.body()).length / 1024)
  expect(kb <= 200, `Logo is ${kb} KB`)
  await v.close()
  return `logo ${size[0]}x${size[1]}, ${kb} KB, ${logo.headers()['content-type']}`
})

await step('Desk Vendors: hide one, it leaves the public page right away', async () => {
  await page.goto(BASE + '/desk/vendors', { waitUntil: 'networkidle' })
  const row = page.locator('li', { hasText: 'Maple Hall' }).first()
  await row.getByRole('switch').click()
  await page.waitForTimeout(1500)
  const html = await (await page.request.get(BASE + '/wedding-vendors')).text()
  expect(!html.includes('Maple Hall') && !html.includes('>Venues<'), 'Hidden vendor or its empty category still shows')
})

await step('Desk Vendors: non-empty category refuses to delete', async () => {
  const card = page.locator('section', { hasText: 'Willow Florals' }).last()
  await card.getByRole('button', { name: 'Delete category' }).click()
  await card.getByRole('button', { name: 'Tap again to confirm' }).click()
  await card.getByText('first.').waitFor({ timeout: 10000 })
})

await step('Home and /weddings: no brand strip while there are no brands', async () => {
  for (const path of ['/', '/weddings']) {
    const html = await (await page.request.get(BASE + path)).text()
    expect(!html.includes('Brands I’ve worked with') && !html.includes('Brands I&#x27;ve'), `${path} shows an empty strip`)
  }
})

await step('Desk Brands: add one with a link and one without', async () => {
  for (const [name, href] of [['Sound Co', 'https://soundco.example.com'], ['Light Works', '']]) {
    await page.goto(BASE + '/desk/brands', { waitUntil: 'networkidle' })
    const form = page.locator('form', { hasText: 'Add a brand' })
    await form.locator('input[name=name]').fill(name)
    if (href) await form.locator('input[name=href]').fill(href)
    await form.getByRole('button', { name: 'Add the brand' }).click()
    await page.locator('li', { hasText: name }).first().waitFor({ timeout: 15000 })
  }
})

await step('Home and /weddings: brand strip in the server HTML', async () => {
  const out = []
  for (const path of ['/', '/weddings']) {
    const html = await (await page.request.get(BASE + path)).text()
    expect(html.includes('Brands I’ve worked with'), `${path}: heading missing`)
    expect(/<a href="https:\/\/soundco\.example\.com\/" target="_blank" rel="noopener"[^>]*>Sound Co<\/a>/.test(html), `${path}: linked name not a new-tab noopener link`)
    expect(html.includes('<span>Light Works</span>'), `${path}: unlinked name missing or clickable`)
    const strip = (html.match(/<section aria-labelledby="brands-title"[\s\S]*?<\/section>/) || [''])[0]
    expect(strip && !strip.includes('<img'), `${path}: the strip has images`)
    out.push(`${path} ok`)
  }
  const v = await browser.newPage()
  await v.goto(BASE + '/', { waitUntil: 'networkidle' })
  const strip = v.locator('.brand-strip .marquee')
  const before = await strip.evaluate((el) => getComputedStyle(el).animationPlayState + ' ' + getComputedStyle(el).animationName)
  await v.locator('.brand-strip').hover()
  const hovered = await strip.evaluate((el) => getComputedStyle(el).animationPlayState)
  await v.close()
  const still = await browser.newPage({ reducedMotion: 'reduce' })
  await still.goto(BASE + '/', { waitUntil: 'networkidle' })
  const shownCount = await still.locator('.brand-strip li:visible').count()
  const anim = await still.locator('.brand-strip .marquee').evaluate((el) => getComputedStyle(el).animationName)
  await still.close()
  expect(hovered === 'paused', `Hover did not pause (${before} -> ${hovered})`)
  expect(anim === 'none' && shownCount === 2, `Reduced motion: animation ${anim}, ${shownCount} logos visible`)
  return `${out.join(', ')}; ${before} -> ${hovered}; reduced motion shows ${shownCount}`
})

await step('Desk Brands: hiding every brand removes the strip right away', async () => {
  await page.goto(BASE + '/desk/brands', { waitUntil: 'networkidle' })
  for (const name of ['Sound Co', 'Light Works']) {
    await page.locator('li', { hasText: name }).first().getByRole('switch').click()
    await page.waitForTimeout(1200)
  }
  const html = await (await page.request.get(BASE + '/')).text()
  expect(!html.includes('Brands I’ve worked with'), 'Strip still shows with every brand hidden')
  for (const name of ['Sound Co', 'Light Works']) {
    await page.locator('li', { hasText: name }).first().getByRole('switch').click()
    await page.waitForTimeout(1200)
  }
})

const SHOTS = process.env.SHOTS_DIR ?? '/tmp/shots'
await import('node:fs').then((fs) => fs.mkdirSync(SHOTS, { recursive: true }))
const LONG_QUOTE = 'Piper made our whole day feel easy. From the first planning call he asked about our families, the songs that mattered and the ones to avoid at all costs. On the night he kept the timeline moving without anyone noticing, handled a late speech change like a pro, read the room perfectly after dinner and had both grandmothers and our college friends on the floor until the last song. We still get messages from guests about how good the music was, and we would book him again in a heartbeat.'

await step('Desk Reviews: add eight shown reviews', async () => {
  for (let i = 1; i <= 8; i += 1) {
    await page.goto(BASE + '/desk/reviews', { waitUntil: 'networkidle' })
    const form = page.locator('form', { hasText: 'Add a review' })
    await form.locator('textarea[name=quote]').fill(i === 2 ? LONG_QUOTE : `Review number ${i}. Great music, great energy and a packed dance floor all night.`)
    await form.locator('input[name=names]').fill(`Couple ${i}`)
    await form.locator('input[name=eventType]').fill('Wedding')
    await form.locator('input[name=date]').fill(`2026-0${(i % 9) + 1}-1${i % 9}`)
    await form.getByRole('switch').check()
    await form.getByRole('button', { name: 'Add the review' }).click()
    await page.getByText('Review added.').first().waitFor({ timeout: 15000 })
  }
})

for (const path of ['/', '/weddings']) {
  await step(`Reviews carousel on ${path}: server HTML has all eight`, async () => {
    const html = await (await page.request.get(BASE + path)).text()
    const missing = [1, 2, 3, 4, 5, 6, 7, 8].filter((i) => !html.includes(`Couple ${i}`))
    expect(missing.length === 0, `Missing from server HTML: ${missing.join(',')}`)
    expect(html.includes('Read or leave a Google review'), 'Review link above the carousel missing')
    expect(html.includes('aria-roledescription="carousel"'), 'No carousel in the HTML')
  })
  for (const [width, expected] of [[390, 1], [768, 2], [1280, 3]]) {
    await step(`Reviews carousel on ${path} at ${width}px`, async () => {
      const v = await browser.newPage({ viewport: { width, height: 900 } })
      v.on('pageerror', (e) => errors.push(e.message))
      await v.goto(BASE + path, { waitUntil: 'networkidle' })
      const region = v.locator('[aria-roledescription="carousel"]').last()
      await region.scrollIntoViewIfNeeded()
      await v.mouse.move(1, 1)
      const info = async () => region.evaluate((el) => {
        const list = el.querySelector('ul')
        const box = list.getBoundingClientRect()
        const cards = [...list.children].map((li) => li.getBoundingClientRect())
        const visible = cards.filter((r) => r.left >= box.left - 2 && r.right <= box.right + 2)
        const current = [...el.querySelectorAll('button[aria-current="true"]')].map((b) => b.getAttribute('aria-label'))
        return {
          visible: visible.length,
          heights: [...new Set(visible.map((r) => Math.round(r.height)))],
          dots: el.querySelectorAll('button[aria-label^="Go to slide"]').length,
          current: current[0] ?? '',
          overflowX: document.documentElement.scrollWidth > window.innerWidth,
        }
      })
      const first = await info()
      expect(first.visible === expected, `${first.visible} cards visible, expected ${expected}`)
      expect(first.heights.length === 1, `Card heights differ: ${first.heights}`)
      expect(first.dots === Math.ceil(8 / expected), `${first.dots} dots`)
      expect(!first.overflowX, 'Page scrolls sideways')
      const rows = await region.evaluate((el) => {
        const dots = [...el.querySelectorAll('button[aria-label^="Go to slide"], button[aria-label$=" reviews"]')]
        return new Set(dots.filter((d) => d.offsetParent).map((d) => Math.round(d.getBoundingClientRect().top))).size
      })
      // Under 768px the arrows sit in the dots row; above it they are at the sides.
      expect(width >= 768 || rows === 1, `Arrows and dots wrap onto ${rows} rows`)
      await v.screenshot({ path: `${SHOTS}/${path === '/' ? 'home' : 'weddings'}-${width}.png`, fullPage: false, clip: await region.boundingBox().then((b) => ({ x: 0, y: Math.max(0, b.y - 20), width, height: Math.min(900, b.height + 40) })) })
      const nextButton = region.getByRole('button', { name: 'Next reviews' }).locator('visible=true')
      await nextButton.click()
      await v.waitForTimeout(900)
      const second = await info()
      expect(second.current === `Go to slide 2 of ${first.dots}`, `After Next: ${second.current}`)
      // Loop: from the last dot, Next goes back to the first.
      await region.getByRole('button', { name: `Go to slide ${first.dots} of ${first.dots}` }).click()
      await v.waitForTimeout(900)
      await nextButton.click()
      await v.waitForTimeout(1200)
      const looped = await info()
      expect(looped.current === `Go to slide 1 of ${first.dots}`, `Did not loop: ${looped.current}`)
      // Keyboard: focus Next and press Enter.
      await nextButton.focus()
      await v.keyboard.press('Enter')
      await v.waitForTimeout(900)
      const keyed = await info()
      expect(keyed.current === `Go to slide 2 of ${first.dots}`, `Keyboard Next: ${keyed.current}`)
      await v.close()
      return `${first.visible} visible, ${first.dots} dots, height ${first.heights}`
    })
  }
  await step(`Reviews carousel on ${path}: Read more opens the long review in place`, async () => {
    const v = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await v.goto(BASE + path, { waitUntil: 'networkidle' })
    const card = v.locator('figure', { hasText: 'Couple 2' }).last()
    const more = card.getByRole('button', { name: 'Read more' })
    await more.waitFor({ timeout: 10000 })
    const quote = card.locator('blockquote')
    const before = await quote.evaluate((el) => el.clientHeight)
    await more.click()
    const after = await quote.evaluate((el) => [el.clientHeight, el.scrollHeight])
    await v.close()
    expect(after[0] > before && after[0] >= after[1] - 1, `Did not open: ${before} -> ${after}`)
    return `${before}px -> ${after[0]}px`
  })
  await step(`Reviews carousel on ${path}: advances by itself, not with reduced motion or on hover`, async () => {
    const watch = async (options, hover) => {
      const v = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...options })
      await v.goto(BASE + path, { waitUntil: 'networkidle' })
      const region = v.locator('[aria-roledescription="carousel"]').last()
      await region.scrollIntoViewIfNeeded()
      if (hover) await region.hover()
      else await v.mouse.move(1, 1)
      await v.waitForTimeout(7000)
      const current = await region.locator('button[aria-current="true"]').getAttribute('aria-label')
      await v.close()
      return current
    }
    const moving = await watch({}, false)
    const still = await watch({ reducedMotion: 'reduce' }, false)
    const hovered = await watch({}, true)
    expect(moving === 'Go to slide 2 of 3', `Auto-advance: ${moving}`)
    expect(still === 'Go to slide 1 of 3', `Reduced motion moved: ${still}`)
    expect(hovered === 'Go to slide 1 of 3', `Hover did not pause: ${hovered}`)
    return `auto ${moving}; reduced ${still}; hover ${hovered}`
  })
}

await step('Desk Gear: loads with the starting list and a $8,659 total', async () => {
  await page.goto(BASE + '/desk/gear', { waitUntil: 'networkidle' })
  const total = (await page.locator('[data-gear-total]').innerText()).trim()
  const rows = await page.locator('[data-gear-id]').count()
  expect(total === '$8,659', `Total ${total}`)
  expect(rows === 22, `${rows} items`)
  const nav = await page.locator('a[href="/desk/gear"]').count()
  expect(nav > 0, 'No Gear link in the Desk menu')
  return `${rows} items, ${total}`
})

await step('Desk Gear: add, edit and delete an item; total follows', async () => {
  const form = page.locator('form', { hasText: 'Add gear' })
  await form.locator('input[name=item]').fill('Test Speaker QA')
  await form.locator('input[name=serial]').fill('Unknown')
  await form.locator('input[name=purchased]').fill('2026-10-28')
  await form.locator('input[name=value]').fill('100')
  await form.locator('textarea[name=notes]').fill('Browse check')
  await form.getByRole('button', { name: 'Add the item' }).click()
  const row = page.locator('[data-gear-id]', { hasText: 'Test Speaker QA' })
  await row.waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  const added = (await page.locator('[data-gear-total]').innerText()).trim()
  expect(added === '$8,759', `After add: ${added}`)
  await row.getByRole('button', { name: 'Edit' }).click()
  await row.locator('input[name=item]').fill('Test Speaker QA Edited')
  await row.locator('input[name=value]').fill('')
  await row.getByRole('button', { name: 'Save' }).click()
  const edited = page.locator('[data-gear-id]', { hasText: 'Test Speaker QA Edited' })
  await edited.getByText('Not priced').waitFor({ timeout: 15000 })
  const afterEdit = (await page.locator('[data-gear-total]').innerText()).trim()
  expect(afterEdit === '$8,659', `After edit: ${afterEdit}`)
  await edited.getByRole('button', { name: 'Edit' }).click()
  await edited.getByRole('button', { name: 'Delete item' }).click()
  await edited.getByRole('button', { name: 'Tap again to confirm' }).click()
  await page.locator('[data-gear-id]', { hasText: 'Test Speaker QA' }).waitFor({ state: 'detached', timeout: 15000 })
  const rows = await page.locator('[data-gear-id]').count()
  expect(rows === 22, `${rows} items after delete`)
  return `${added} -> ${afterEdit}, back to ${rows} items`
})

await step('Desk Financials: loads the sheet; add, edit and delete income', async () => {
  await page.goto(BASE + '/desk/financials', { waitUntil: 'networkidle' })
  const stat = page.locator('[data-fin-stat="Income 2026"]')
  const total = (await stat.innerText()).trim()
  expect(total === '$48,631', `Income total ${total}`)
  const form = page.locator('form', { hasText: 'Add income' })
  await form.locator('input[name=date]').fill('2026-10-28')
  await form.locator('input[name=amount]').fill('100')
  await form.locator('input[name=name]').fill('Tip - QA Couple')
  await form.locator('select[name=category]').selectOption('tip')
  await form.getByRole('button', { name: 'Add income' }).click()
  const row = page.locator('[data-fin-row]', { hasText: 'Tip - QA Couple' })
  await row.waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  const added = (await stat.innerText()).trim()
  await row.getByRole('button', { name: 'Edit' }).click()
  await row.locator('input[name=amount]').fill('150')
  await row.getByRole('button', { name: 'Save' }).click()
  await page.waitForTimeout(1500)
  const edited = (await stat.innerText()).trim()
  await row.getByRole('button', { name: 'Edit' }).click()
  await row.getByRole('button', { name: 'Delete' }).click()
  await row.getByRole('button', { name: 'Tap again to confirm' }).click()
  await page.locator('[data-fin-row]', { hasText: 'Tip - QA Couple' }).waitFor({ state: 'detached', timeout: 15000 })
  const after = (await stat.innerText()).trim()
  expect(added === '$48,731' && edited === '$48,781' && after === '$48,631', `${added} / ${edited} / ${after}`)
  await page.getByRole('tab', { name: 'Pay periods' }).click()
  const jan = (await page.locator('[data-fin-period="2026-01-18"]').innerText()).replace(/\s+/g, ' ')
  expect(jan.includes('$892.50') && jan.includes('42.5 hours'), `Jan 18 period: ${jan}`)
  await page.getByRole('tab', { name: 'Weekly hours' }).click()
  await page.getByRole('button', { name: 'Download CSV' }).waitFor()
  return `${total} -> ${added} -> ${edited} -> ${after}; ${jan}`
})

// --- Public ----------------------------------------------------------------

const pub = await browser.newPage()
pub.setDefaultTimeout(15000)
pub.setDefaultNavigationTimeout(25000)
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

await step('/rsvp price boxes are tappable and jump to the form', async () => {
  const out = []
  for (const width of [390, 1280]) {
    const v = await browser.newPage({ viewport: { width, height: 800 } })
    await v.goto(BASE + '/rsvp', { waitUntil: 'networkidle' })
    for (const [name, field] of [['$40', 'one'], ['Free', 'ref']]) {
      await v.locator('a[href="#get-rsvp"]', { hasText: name }).click()
      await v.waitForTimeout(700)
      const focused = await v.evaluate(() => document.activeElement?.id ?? '')
      const inView = await v.evaluate(() => {
        const r = document.activeElement?.getBoundingClientRect()
        return !!r && r.top >= 0 && r.bottom <= window.innerHeight
      })
      // With card sales off the form is replaced by "Contact us".
      expect(focused === field || focused === 'rsvp-contact', `${name} at ${width}px focused "${focused}"`)
      expect(inView, `${name} at ${width}px: target not on screen`)
      out.push(`${width} ${name} -> ${focused}`)
    }
    await v.close()
  }
  return out.join(', ')
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

let passcode = ''
await step('Desk Portals shows a passcode', async () => {
  await page.goto(BASE + '/desk/portals', { waitUntil: 'networkidle' })
  const values = await page.$$eval('input', (els) => els.map((e) => e.value))
  passcode = values.find((v) => /^[A-Z0-9]{4,12}$/.test(v)) ?? ''
  expect(passcode, `No passcode on /desk/portals: ${values.slice(0, 10).join(',')}`)
  return passcode
})

await step('Couple opens their plan with the passcode', async () => {
  const couple = await browser.newPage()
  couple.setDefaultTimeout(15000)
  const pageErrors = []
  couple.on('pageerror', (e) => pageErrors.push(e.message))
  await couple.goto(BASE + '/portal', { waitUntil: 'networkidle' })
  await couple.locator('input.portal-input').fill(`Passcode: ${passcode.slice(0, 3).toLowerCase()}-${passcode.slice(3)}.`)
  const enabled = await couple.getByRole('button', { name: 'Open the plan' }).isEnabled()
  expect(enabled, `The button stays disabled after typing. Errors: ${pageErrors.join(' | ')}`)
  await couple.getByRole('button', { name: 'Open the plan' }).click()
  await couple.waitForTimeout(3000)
  const text = await couple.evaluate(() => document.body.innerText)
  expect(!/Enter the passcode Piper sent you/.test(text), `Still on the passcode page: ${text.slice(0, 300)} Errors: ${pageErrors.join(' | ')}`)
  return text.slice(0, 120).replace(/\s+/g, ' ')
})

await step('Older browsers without Object.hasOwn still load', async () => {
  const old = await browser.newPage()
  const oldErrors = []
  old.on('pageerror', (e) => oldErrors.push(e.message))
  await old.addInitScript(() => {
    delete Object.hasOwn
    delete Array.prototype.at
    delete Array.prototype.findLast
  })
  for (const path of ['/', '/portal', '/rsvp']) {
    await old.goto(BASE + path, { waitUntil: 'networkidle' })
  }
  const filled = await old.evaluate(() => typeof Object.hasOwn === 'function' && [1, 2].at(-1) === 2)
  expect(filled, 'The fill-ins did not load')
  expect(oldErrors.length === 0, oldErrors.slice(0, 3).join(' | '))
})

await step('/faq: twenty questions, no insurance, linked from the menu', async () => {
  const html = await (await pub.request.get(BASE + '/faq')).text()
  const questions = (html.match(/<h3[^>]*>/g) || []).length
  expect(questions === 20, `${questions} questions`)
  expect(!/insur|liability/i.test(html), 'Insurance is mentioned')
  expect(/<link[^>]*rel="canonical"[^>]*\/faq"/.test(html), 'Canonical missing')
  expect(html.includes('"@type":"FAQPage"'), 'FAQ structured data missing')
  for (const path of ['/', '/weddings']) {
    const page = await (await pub.request.get(BASE + path)).text()
    expect(/<header[\s\S]*?href="\/faq"[\s\S]*?<\/header>/.test(page), `${path}: no FAQ link in the menu`)
  }
})

await step('Copy: homepage setup sentence and One planning meeting on the cards', async () => {
  const home = await (await pub.request.get(BASE + '/')).text()
  expect(home.includes('I arrive early, set up, and run a sound check before guests arrive.'), 'New sentence missing')
  expect(!home.includes('coordinate with your venue and team'), 'Old sentence still there')
  await pub.goto(BASE + '/weddings', { waitUntil: 'networkidle' })
  const cards = await pub.evaluate(() => [...document.querySelectorAll('#packages article')].map((el) => ({
    name: el.querySelector('h3')?.textContent?.trim() ?? '',
    one: [...el.querySelectorAll('li')].some((li) => li.textContent.trim() === 'One planning meeting'),
    least: /at least one/i.test(el.textContent),
  })).filter((c) => ['The Main Event', 'The After Party', 'The Aisle'].includes(c.name)))
  const names = [...new Set(cards.filter((c) => c.one && !c.least).map((c) => c.name))]
  expect(names.length === 3, `Cards with "One planning meeting": ${names.join(', ')}`)
  const all = await pub.evaluate(() => document.body.innerText)
  expect(!/at least one planning meeting/i.test(all), '"At least one planning meeting" still on /weddings')
  return names.join(', ')
})

await step('Gear stays off the public site', async () => {
  const marks = ['PTI20426A0089', '0101G0A0605AAD', 'KYS299YY40001YL', 'Behringer XR18', 'Replacement value', '8,659', '48,631', 'Tims Tillsonburg', 'Pay periods']
  const found = []
  for (const path of ['/', '/weddings', '/faq', '/contact', '/book', '/rsvp', '/terms', '/wedding-vendors', '/hamilton-wedding-dj', '/sitemap.xml', '/robots.txt']) {
    const html = await (await pub.request.get(BASE + path)).text()
    for (const mark of marks) if (html.includes(mark)) found.push(`${path}: ${mark}`)
    if (/href="\/desk\/(gear|financials)"/.test(html)) found.push(`${path}: link to a private Desk page`)
  }
  expect(found.length === 0, found.join(', '))
  const signedOut = await pub.request.get(BASE + '/desk/gear', { maxRedirects: 0 })
  const body = signedOut.status() === 200 ? await signedOut.text() : ''
  expect(signedOut.status() !== 200 || !body.includes('PTI20426A0089'), 'Signed-out /desk/gear shows serials')
  return `signed out /desk/gear -> ${signedOut.status()}`
})

await step('Public page text spacing', async () => {
  const out = []
  for (const path of ['/', '/weddings', '/hamilton-wedding-dj', '/cambridge-wedding-dj', '/paris-wedding-dj', '/book', '/rsvp', '/rsvp/sign-in', '/contact', '/terms', '/portal', '/wedding-vendors', '/faq']) {
    out.push(await spacing(pub, path))
  }
  return out.join(', ')
})

async function passwordStep(p) {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await p.fill('input[type="password"]', 'piper-local')
  await p.click('button[type="submit"]')
}

await step('2FA: the password alone does not open the Desk; a wrong code fails, a right code works', async () => {
  const context = await browser.newContext()
  const p = await context.newPage()
  await passwordStep(p)
  await p.getByText('Your code').waitFor({ timeout: 15000 })
  const desk = await p.request.get(BASE + '/desk/money', { maxRedirects: 0 })
  expect(desk.status() !== 200, `Desk opened after the password alone (${desk.status()})`)
  await p.fill('input[name="code"]', '111111')
  await p.click('button[type="submit"]')
  await p.getByText('That did not match. Check it and try again.').waitFor({ timeout: 8000 })
  await p.fill('input[name="code"]', await freshCode(TWO_FA.secret))
  await p.click('button[type="submit"]')
  await p.waitForURL(/\/desk/, { timeout: 30000 })
  await context.close()
  return `password-only Desk request -> ${desk.status()}`
})

await step('2FA: a backup code works once, then stops working', async () => {
  const code = TWO_FA.backup[0]
  const first = await browser.newContext()
  const a = await first.newPage()
  await passwordStep(a)
  await a.getByText('Your code').waitFor({ timeout: 15000 })
  await a.fill('input[name="code"]', code)
  await a.click('button[type="submit"]')
  await a.waitForURL(/\/desk/, { timeout: 30000 })
  await first.close()
  const second = await browser.newContext()
  const b = await second.newPage()
  await passwordStep(b)
  await b.getByText('Your code').waitFor({ timeout: 15000 })
  await b.fill('input[name="code"]', code)
  await b.click('button[type="submit"]')
  await b.getByText('That did not match. Check it and try again.').waitFor({ timeout: 8000 })
  expect(b.url().includes('/login'), 'The used backup code opened the Desk')
  await second.close()
  return `${code.slice(0, 2)}… worked once`
})

await step('2FA: trust this device skips the code there; removing it asks again', async () => {
  const context = await browser.newContext()
  const p = await context.newPage()
  await passwordStep(p)
  await p.getByText('Your code').waitFor({ timeout: 15000 })
  await p.fill('input[name="code"]', await freshCode(TWO_FA.secret))
  await p.check('input[name="trust"]')
  await p.click('button[type="submit"]')
  await p.waitForURL(/\/desk/, { timeout: 30000 })
  await p.getByRole('button', { name: /Sign out/ }).first().click()
  await p.waitForURL(/\/login/, { timeout: 15000 })
  await passwordStep(p)
  await p.waitForURL(/\/desk/, { timeout: 15000 })
  await p.goto(BASE + '/desk/security', { waitUntil: 'networkidle' })
  const devices = await p.locator('[data-2fa-device]').count()
  const status = await p.locator('[data-2fa-status]').innerText()
  await p.locator('[data-2fa-device]').first().getByRole('button', { name: 'Remove' }).click()
  await p.locator('[data-2fa-device]').first().getByRole('button', { name: 'Tap again to confirm' }).click()
  await p.waitForTimeout(1500)
  await p.getByRole('button', { name: /Sign out/ }).first().click()
  await p.waitForURL(/\/login/, { timeout: 15000 })
  await passwordStep(p)
  await p.getByText('Your code').waitFor({ timeout: 15000 })
  await context.close()
  expect(devices === 1, `${devices} trusted devices listed`)
  expect(/On since/.test(status) && /9 unused backup codes/.test(status), `Status: ${status}`)
  return status
})

await step('2FA: new backup codes replace the old set', async () => {
  await page.goto(BASE + '/desk/security', { waitUntil: 'networkidle' })
  const form = page.locator('form', { hasText: 'Make new backup codes' })
  await form.locator('input[name="code"]').fill(await freshCode(TWO_FA.secret))
  await form.getByRole('button', { name: 'Make new backup codes' }).click()
  await page.locator('[data-2fa-backup] li').first().waitFor({ timeout: 15000 })
  const fresh = (await page.locator('[data-2fa-backup] li').allInnerTexts()).map((t) => t.trim())
  const old = TWO_FA.backup[1]
  const context = await browser.newContext()
  const p = await context.newPage()
  await passwordStep(p)
  await p.getByText('Your code').waitFor({ timeout: 15000 })
  await p.fill('input[name="code"]', old)
  await p.click('button[type="submit"]')
  await p.getByText('That did not match. Check it and try again.').waitFor({ timeout: 8000 })
  await p.fill('input[name="code"]', fresh[0])
  await p.click('button[type="submit"]')
  await p.waitForURL(/\/desk/, { timeout: 30000 })
  await context.close()
  expect(fresh.length === 10, `${fresh.length} new codes`)
  return 'old set refused, new set works'
})

await step('2FA: wrong codes count toward the five-try lockout', async () => {
  const context = await browser.newContext()
  const p = await context.newPage()
  let locked = false
  for (let i = 0; i < 7 && !locked; i += 1) {
    await passwordStep(p)
    await p.waitForTimeout(800)
    if ((await p.getByText('Too many tries').count()) > 0) {
      locked = true
      break
    }
    await p.getByText('Your code').waitFor({ timeout: 15000 })
    await p.fill('input[name="code"]', '000000')
    await p.click('button[type="submit"]')
    await p.waitForTimeout(1600)
    locked = (await p.getByText('Too many tries').count()) > 0
  }
  await context.close()
  expect(locked, 'No lockout after repeated wrong codes')
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
const joined = lines.join(' ## ').replace(/\n/g, ' ')
for (let i = 0; i < joined.length; i += 3500) {
  console.log(`::notice title=browse part ${i / 3500 + 1}::${joined.slice(i, i + 3500)}`)
}
process.exit(results.every((r) => r.ok) ? 0 : 1)
