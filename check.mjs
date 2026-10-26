import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
for (const p of ['/', '/weddings', '/wedding-vendors']) {
  const res = await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  console.log(`::notice title=${p}::${res.status()} strip=${await page.locator('.brand-strip').count()}`)
}
for (const p of ['/desk/brands', '/desk/vendors', '/desk/partners']) {
  const r = await page.request.get(base + p, { maxRedirects: 0 })
  console.log(`::notice title=${p}::${r.status()} ${r.headers().location ?? ''}`)
}
console.log(`::notice title=errors::${errors.join('|') || 'none'}`)
await browser.close()
