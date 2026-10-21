import { chromium } from 'playwright'
const browser = await chromium.launch()
const out = []
for (const [w, h] of [[1280, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto('https://piperpweddingdj.services/weddings?r=' + Date.now(), { waitUntil: 'networkidle' })
  const r = await page.$eval('img[src*="piper-p-rings"]', (e) => { const b = e.getBoundingClientRect(); const p = e.parentElement.getBoundingClientRect(); return `img ${Math.round(b.width)}px wide, left gap ${Math.round(b.left - p.left)} right gap ${Math.round(p.right - b.right)}` })
  out.push(`${w}px: ${r}`)
}
console.log(`::notice title=logo::${out.join(' | ')}`)
await browser.close()
