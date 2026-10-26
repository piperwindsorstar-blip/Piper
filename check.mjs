import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
for (const t of ['hamilton', 'cambridge', 'paris', 'woodstock', 'burlington', 'guelph', 'oakville']) {
  await page.goto(`https://piperpweddingdj.services/${t}-wedding-dj?r=${Date.now()}`, { waitUntil: 'networkidle' })
  const r = await page.evaluate(() => {
    const txt = document.body.innerText
    const i = txt.indexOf('WEDDINGS IN'), j = txt.search(/Weddings in /)
    const k = i >= 0 ? i : j
    return { venue: /Lavender Farm|Rivers Edge/i.test(txt), nearby: k >= 0 ? txt.slice(k, k + 160).replace(/\s+/g, ' ') : 'none' }
  })
  console.log(`::notice title=${t}::venue=${r.venue} | ${r.nearby}`)
}
await browser.close()
