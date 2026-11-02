import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('https://piperpweddingdj.services/faq?r=' + Date.now(), { waitUntil: 'networkidle' })
const r = await page.evaluate(() => {
  const h = [...document.querySelectorAll('main h3')].find((x) => x.textContent.trim() === 'How do we book?')
  const visible = h?.nextElementSibling?.textContent?.trim() ?? ''
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((j) => j['@type'] === 'FAQPage')
  const q = ld?.mainEntity.find((e) => e.name === 'How do we book?')
  return { visible, same: visible === q?.acceptedAnswer?.text, count: ld?.mainEntity.length }
})
console.log(`::notice title=faq book::${JSON.stringify(r)}`)
await browser.close()
