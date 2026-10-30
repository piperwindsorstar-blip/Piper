import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
for (const p of ['/', '/weddings', '/faq', '/wedding-vendors', '/book', '/rsvp']) {
  const r = await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  console.log(`::notice title=${p}::${r.status()}`)
}
for (const p of ['/desk', '/desk/security', '/desk/bookings']) {
  const r = await page.request.get(base + p, { maxRedirects: 0 })
  console.log(`::notice title=${p} signed out::${r.status()} ${r.headers().location ?? ''}`)
}
await page.goto(base + '/login', { waitUntil: 'networkidle' })
await page.fill('input[type="password"]', 'definitely-not-it')
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)
const msg = await page.locator('[role="alert"]').innerText().catch(() => 'none')
console.log(`::notice title=login wrong password::${msg}`)
console.log(`::notice title=errors::${errors.join('|') || 'none'}`)
await browser.close()
