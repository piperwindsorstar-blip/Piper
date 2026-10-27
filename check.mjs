import { chromium } from 'playwright'
const browser = await chromium.launch()
for (const width of [390, 1280]) {
  const v = await browser.newPage({ viewport: { width, height: 800 } })
  await v.goto('https://piperpweddingdj.services/rsvp?r=' + Date.now(), { waitUntil: 'networkidle' })
  const out = []
  for (const name of ['$40', 'Free']) {
    await v.locator('a[href="#get-rsvp"]', { hasText: name }).click()
    await v.waitForTimeout(800)
    out.push(name + '->' + (await v.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)))
  }
  console.log(`::notice title=rsvp ${width}::${out.join(' ')}`)
  await v.close()
}
await browser.close()
