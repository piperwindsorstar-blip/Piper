import { chromium } from 'playwright'
const browser = await chromium.launch()
const v = await browser.newPage({ viewport: { width: 390, height: 900 } })
await v.goto('https://piperpweddingdj.services/rsvp?r=' + Date.now(), { waitUntil: 'networkidle' })
const r = await v.evaluate(() => ({
  cards: [...document.querySelectorAll('article')].map((a) => a.tagName + ':' + a.innerText.replace(/\s+/g, ' ') + ':clickable=' + !!a.closest('a,button,label')),
  form: document.querySelector('form h2')?.innerText ?? 'no form',
  button: [...document.querySelectorAll('form button[type=submit]')].map((b) => b.innerText).join('|'),
}))
console.log(`::notice title=rsvp::${JSON.stringify(r)}`)
await browser.close()
