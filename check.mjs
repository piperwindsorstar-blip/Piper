import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
for (const p of ['/', '/weddings', '/p/not-a-real-invoice']) {
  const r = await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  console.log(`::notice title=${p}::${r.status()}`)
}
const d = await page.request.get(base + '/desk/money', { maxRedirects: 0 })
console.log(`::notice title=desk/money::${d.status()} errors=${errors.join('|') || 'none'}`)
await browser.close()
