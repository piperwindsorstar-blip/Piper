import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
const res = await page.goto(base + '/faq?r=' + Date.now(), { waitUntil: 'networkidle' })
const faq = await page.evaluate(() => ({
  title: document.title,
  canon: document.querySelector('link[rel=canonical]')?.href,
  h2: [...document.querySelectorAll('main h2')].map((h) => h.innerText),
  q: document.querySelectorAll('main h3').length,
  insured: /insur|liability/i.test(document.documentElement.outerHTML),
}))
console.log(`::notice title=faq ${res.status()}::${JSON.stringify(faq)}`)
await page.screenshot({ path: 'shots/faq.png' })
for (const p of ['/', '/weddings']) {
  await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const r = await page.evaluate(() => ({
    nav: [...document.querySelectorAll('header a[href="/faq"]')].map((a) => a.innerText).join('/'),
    footer: [...document.querySelectorAll('footer a[href="/faq"]')].length,
    sentence: document.body.innerText.includes('I arrive early, set up, and run a sound check before guests arrive.'),
    old: document.body.innerText.includes('coordinate with your venue and team'),
    cards: [...document.querySelectorAll('#packages article')].map((el) => el.querySelector('h3')?.innerText + ':' + ([...el.querySelectorAll('li')].find((li) => /planning meeting/i.test(li.innerText))?.innerText ?? '-')),
    least: /at least one planning/i.test(document.body.innerText),
  }))
  console.log(`::notice title=${p}::${JSON.stringify(r)}`)
}
const sm = await (await page.request.get(base + '/sitemap.xml?r=' + Date.now())).text()
console.log(`::notice title=sitemap::${sm.includes('/faq')} errors=${errors.join('|') || 'none'}`)
await browser.close()
