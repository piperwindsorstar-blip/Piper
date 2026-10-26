import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [p, re] of [['/', /Venues I’ve played[\s\S]{0,320}/], ['/paris-wedding-dj', /WEDDINGS IN PARIS[\s\S]{0,420}/i]]) {
  await page.goto(`https://piperpweddingdj.services${p}?r=${Date.now()}`, { waitUntil: 'networkidle' })
  const t = await page.evaluate(() => document.body.innerText)
  console.log(`::notice title=${p}::${(t.match(re) || ['missing'])[0].replace(/\s+/g, ' ')}`)
}
await browser.close()
