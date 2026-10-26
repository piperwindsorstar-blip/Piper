import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const base = 'https://piperpweddingdj.services'
for (const t of ['woodstock', 'burlington', 'guelph', 'oakville']) {
  const res = await page.goto(`${base}/${t}-wedding-dj?r=${Date.now()}`, { waitUntil: 'networkidle' })
  const r = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.innerText.replace(/\s+/g, ' '),
    desc: document.querySelector('meta[name=description]')?.content,
    canon: document.querySelector('link[rel=canonical]')?.href,
    area: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.stringify(JSON.parse(s.textContent).areaServed)).join(' / ').slice(0, 400),
    travel: [...document.querySelectorAll('p')].map((p) => p.innerText).find((x) => /km/.test(x)),
  }))
  console.log(`::notice title=${t} ${res.status()}::${JSON.stringify(r)}`)
}
const sm = await (await page.request.get(base + '/sitemap.xml?r=' + Date.now())).text()
console.log(`::notice title=sitemap::${['woodstock','burlington','guelph','oakville'].map((t) => t + '=' + sm.includes(t + '-wedding-dj')).join(' ')}`)
for (const p of ['/', '/weddings']) {
  await page.goto(base + p + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const links = await page.evaluate(() => [...document.querySelectorAll('footer a')].map((a) => a.getAttribute('href')).filter((h) => /wedding-dj/.test(h)))
  console.log(`::notice title=links ${p}::${links.join(' ')}`)
}
await browser.close()
