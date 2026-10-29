import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
for (const p of ['/', '/weddings']) {
  const r = await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  console.log(`::notice title=${p}::${r.status()}`)
}
for (const p of ['/desk', '/desk/bookings', '/desk/money?couple=1', '/desk/leads']) {
  const r = await page.request.get(base + p, { maxRedirects: 0 })
  console.log(`::notice title=${p}::${r.status()} ${r.headers().location ?? ''}`)
}
console.log(`::notice title=errors::${errors.join('|') || 'none'}`)
await browser.close()
