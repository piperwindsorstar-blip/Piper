import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
const res = await page.goto(`${base}/wedding-vendors?r=${Date.now()}`, { waitUntil: 'networkidle' })
const r = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector('h1')?.innerText,
  desc: document.querySelector('meta[name=description]')?.content,
  canon: document.querySelector('link[rel=canonical]')?.href,
  intro: document.querySelector('main p')?.innerText,
  h2: [...document.querySelectorAll('main h2')].map((h) => h.innerText),
}))
console.log(`::notice title=vendors ${res.status()}::${JSON.stringify(r)}`)
const sm = await (await page.request.get(base + '/sitemap.xml?r=' + Date.now())).text()
console.log(`::notice title=sitemap::${sm.includes('/wedding-vendors')}`)
for (const p of ['/', '/weddings']) {
  await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const links = await page.evaluate(() => ['header', 'footer', 'main'].map((t) => t + ':' + [...document.querySelectorAll(t + ' a[href="/wedding-vendors"]')].map((a) => a.innerText.trim()).join('/')).join(' '))
  console.log(`::notice title=links ${p}::${links}`)
}
const desk = await (await page.request.get(base + '/desk/vendors', { maxRedirects: 0 })).status()
console.log(`::notice title=desk signed out::${desk} errors=${errors.join('|') || 'none'}`)
await browser.close()
