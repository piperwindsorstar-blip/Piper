import { chromium } from 'playwright'
const browser = await chromium.launch()
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto('https://piperpweddingdj.services/weddings?r=' + Date.now(), { waitUntil: 'networkidle' })
  const r = await page.evaluate(async () => {
    const up = document.getElementById('uplighting')
    const imgs = up ? [...up.querySelectorAll('img')] : []
    up?.scrollIntoView()
    await new Promise((res) => setTimeout(res, 1500))
    return {
      afterGear: document.getElementById('the-booth')?.nextElementSibling === up,
      heading: up?.querySelector('h2')?.textContent,
      price: up?.innerText.includes('Wired uplights are $15 each.'),
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length + '/' + imgs.length,
      button: up ? [...up.querySelectorAll('button')].map((b) => b.innerText.trim()).join() : '',
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  console.log(`::notice title=uplighting ${width}::${JSON.stringify(r)}`)
}
await browser.close()
