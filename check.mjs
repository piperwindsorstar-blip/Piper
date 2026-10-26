import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch()
const errors = []
const base = 'https://piperpweddingdj.services'
for (const path of ['/', '/weddings']) {
  for (const width of [390, 768, 1280]) {
    const v = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
    v.on('pageerror', (e) => errors.push(e.message))
    await v.goto(base + path + '?r=' + Date.now(), { waitUntil: 'networkidle' })
    const section = v.locator('#reviews')
    await section.scrollIntoViewIfNeeded()
    await v.mouse.move(1, 1)
    await v.waitForTimeout(800)
    const r = await section.evaluate((el) => {
      const list = el.querySelector('[aria-roledescription="carousel"] ul') || el.querySelector('ul')
      const box = list?.getBoundingClientRect()
      const cards = list ? [...list.children].map((li) => li.getBoundingClientRect()) : []
      return {
        carousel: !!el.querySelector('[aria-roledescription="carousel"]'),
        cards: cards.length,
        visible: box ? cards.filter((c) => c.left >= box.left - 2 && c.right <= box.right + 2).length : 0,
        dots: el.querySelectorAll('button[aria-label^="Go to slide"]').length,
        more: el.querySelectorAll('button[aria-expanded]').length,
        sideways: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    console.log(`::notice title=${path} ${width}::${JSON.stringify(r)}`)
    await section.screenshot({ path: `shots/${path === '/' ? 'home' : 'weddings'}-${width}.png` })
    await v.close()
  }
}
console.log(`::notice title=errors::${errors.join('|') || 'none'}`)
await browser.close()
