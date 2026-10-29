import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const base = 'https://piperpweddingdj.services'
const marks = ['48,631', 'Tims Tillsonburg', 'Pay periods', '/desk/financials']
const found = []
for (const path of ['/', '/weddings', '/faq', '/contact', '/book', '/rsvp', '/sitemap.xml']) {
  const html = await (await page.request.get(base + path + (path.includes('.') ? '' : '?r=' + Date.now()))).text()
  for (const m of marks) if (html.includes(m)) found.push(`${path}:${m}`)
}
const r = await page.request.get(base + '/desk/financials', { maxRedirects: 0 })
console.log(`::notice title=public::found=${found.join(',') || 'none'}`)
console.log(`::notice title=desk/financials signed out::${r.status()} ${r.headers().location ?? ''}`)
await browser.close()
