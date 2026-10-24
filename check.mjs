import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
for (const path of ['/', '/weddings']) {
  await page.goto('https://piperpweddingdj.services' + path + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const r = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')].map((a) => a.href).filter((h) => /google\.|goo\.gl/.test(h))
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join(' ')
    const agg = (ld.match(/"aggregateRating":\{[^}]*\}/) || [''])[0]
    const txt = document.body.innerText
    const i = txt.search(/google/i)
    return { links: [...new Set(links)], agg, around: i >= 0 ? txt.slice(Math.max(0, i - 300), i + 500).replace(/\s+/g, ' ') : 'no google text' }
  })
  console.log(`::notice title=${path} links::${r.links.join(' , ') || 'none'}`)
  console.log(`::notice title=${path} rating::${r.agg || 'none'}`)
  console.log(`::notice title=${path} text::${r.around}`)
}
await browser.close()
