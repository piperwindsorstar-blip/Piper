import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const out = []
for (const path of ['/weddings', '/hamilton-wedding-dj']) {
  await page.goto('https://piperpweddingdj.services' + path + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const img = await page.$eval('main img, section img', (e) => `${e.currentSrc || e.src} ${e.naturalWidth}x${e.naturalHeight} alt=${e.alt}`)
  out.push(`${path}: ${img}`)
}
console.log(`::notice title=logo::${out.join(' | ')}`)
await browser.close()
