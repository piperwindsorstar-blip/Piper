import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto('https://piperpweddingdj.services/weddings?r=' + Date.now(), { waitUntil: 'networkidle' })
const text = await page.evaluate(() => {
  const el = document.querySelector('#packages') || [...document.querySelectorAll('section')].find((s) => /The Main Event/.test(s.innerText))
  return el ? el.innerText : document.body.innerText
})
const chunks = text.replace(/\n+/g, ' / ').match(/.{1,800}/g) || []
chunks.slice(0, 9).forEach((c, i) => console.log(`::notice title=packages ${i}::${c}`))
await browser.close()
