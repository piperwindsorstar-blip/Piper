import { chromium } from 'playwright'
const out = []
const note = (k, v) => { out.push(`${k}: ${v}`); console.log(`::notice title=${k}::${String(v).replace(/\n/g, ' | ').slice(0, 900)}`) }
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const base = 'https://piperpweddingdj.services'
try {
  await page.goto(base + '/?r=' + Date.now(), { waitUntil: 'networkidle' })
  // headings text extraction
  const heads = await page.$$eval('h1,h2,h3', (els) => els.map((e) => e.tagName + ' ' + e.textContent.replace(/\s+/g, ' ').trim()))
  note('home headings', heads.join(' / '))
  const honeypot = await page.$eval('#home-company', (el) => [el.closest('[aria-hidden="true"]') ? 'aria-hidden' : 'NOT hidden', el.tabIndex, el.autocomplete].join(','))
  note('honeypot', honeypot)
  // unavailable Oct 24
  await page.click('button[aria-label="24 October 2026"]')
  await page.waitForTimeout(2500)
  note('Oct 24 answer', (await page.textContent('#check-a-date')).replace(/\s+/g, ' ').match(/(not|is|open|booked|taken|free|available)[^.]*\./gi)?.join(' ') ?? 'none')
  note('Oct 24 url', page.url())
  await page.click('button[aria-label="Next month"]')
  await page.click('button[aria-label="16 November 2026"]')
  await page.waitForTimeout(800)
  note('Nov 16 answer', (await page.textContent('#check-a-date')).replace(/\s+/g, ' ').match(/(not|is|open|booked|taken|free|available)[^.]*\./gi)?.join(' ') ?? 'none')
  await page.waitForURL(/\/book/, { timeout: 8000 })
  note('Nov 16 url', page.url())
  await page.waitForLoadState('networkidle')
  const dateVal = await page.$$eval('input[type="date"]', (els) => els.map((e) => e.name + '=' + e.value).join(','))
  note('book date fields', dateVal)
  const eventVal = await page.$$eval('select', (els) => els.map((e) => e.name + '=' + e.value).join(','))
  note('book selects', eventVal)
  const pkg = await page.$('select[name="packageId"]')
  if (pkg) await pkg.selectOption({ index: 1 })
  await page.waitForTimeout(800)
  const est = await page.$('[aria-label="Price estimate"]')
  note('book estimate', est ? (await est.textContent()).replace(/\s+/g, ' ') : 'NO ESTIMATE')
  for (const path of ['/rsvp', '/rsvp/sign-in', '/weddings', '/hamilton-wedding-dj', '/cambridge-wedding-dj', '/paris-wedding-dj', '/contact']) {
    const res = await page.goto(base + path + '?r=' + Date.now(), { waitUntil: 'networkidle' })
    const h = await page.$$eval('h1,h2', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 4).join(' / '))
    const sticky = await page.$$eval('*', (els) => els.some((e) => getComputedStyle(e).position === 'fixed' && /Check/i.test(e.textContent || '')))
    note(`${path} ${res.status()}`, `${h}${sticky ? ' | fixed Check bar' : ''}`)
  }
  const fb = await page.$$eval('a[href*="facebook.com"]', (els) => els.map((e) => e.href))
  note('contact fb links', fb.join(','))
  await page.goto(base + '/rsvp?r=' + Date.now(), { waitUntil: 'networkidle' })
  note('rsvp prices', (await page.textContent('main')).replace(/\s+/g, ' ').match(/Free.{0,80}\$40.{0,80}HST\./)?.[0] ?? 'missing')
} catch (e) {
  note('FAILED', e.message)
}
note('console errors', errors.length ? errors.join(' || ') : 'none')
await browser.close()
