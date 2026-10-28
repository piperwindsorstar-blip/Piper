import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const base = 'https://piperpweddingdj.services'
const marks = ['PTI20426A0089', '0101G0A0605AAD', 'KYS299YY40001YL', 'Behringer XR18', 'Replacement value', '8,659', '/desk/gear']
const found = []
for (const path of ['/', '/weddings', '/faq', '/contact', '/book', '/rsvp', '/terms', '/wedding-vendors', '/hamilton-wedding-dj', '/oakville-wedding-dj', '/sitemap.xml', '/robots.txt']) {
  const r = await page.request.get(base + path + (path.includes('.') ? '' : '?r=' + Date.now()))
  const html = await r.text()
  for (const m of marks) if (html.includes(m)) found.push(`${path}:${m}`)
}
const signedOut = await page.request.get(base + '/desk/gear', { maxRedirects: 0 })
console.log(`::notice title=public::found=${found.join(',') || 'none'}`)
console.log(`::notice title=desk/gear signed out::${signedOut.status()} ${signedOut.headers().location ?? ''}`)
await browser.close()
