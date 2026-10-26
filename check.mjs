import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
for (const p of ['/', '/weddings']) {
  const res = await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const strip = await page.locator('.brand-strip').count()
  console.log(`::notice title=${p} ${res.status()}::strip=${strip} title=${await page.title()}`)
}
for (const p of ['/brand-logo/1', '/desk/brands']) {
  const r = await page.request.get(base + p, { maxRedirects: 0 })
  console.log(`::notice title=${p}::${r.status()}`)
}
console.log(`::notice title=errors::${errors.join('|') || 'none'}`)
await browser.close()
