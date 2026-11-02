import { chromium } from 'playwright'
const browser = await chromium.launch()
const base = 'https://piperpweddingdj.services'
const say = (title, value) => console.log(`::notice title=${title}::${String(value).replace(/\s+/g, ' ').slice(0, 900)}`)
const errors = []
async function open(path, width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  page.on('pageerror', (e) => errors.push(`${path}@${width}: ${e.message}`))
  await page.goto(base + path + (path.includes('?') ? '&' : '?') + 'r=' + Date.now(), { waitUntil: 'networkidle' })
  return page
}
let page = await open('/weddings')
let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
say('weddings', `newWording=${text.includes('A second venue is a $75 setup fee. Uplights are $15 each.')} hst13=${/13% HST/.test(text)} logo=${await page.evaluate(() => document.querySelector('header img')?.getAttribute('src'))}`)
page = await open('/book')
text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
const og = await page.evaluate(() => [...document.querySelectorAll('meta[property^="og:image"]')].map((m) => m.getAttribute('content')).join(' '))
say('book', `hst13=${/13% HST/.test(text)} logo=${await page.evaluate(() => document.querySelector('header img')?.getAttribute('src'))} og=${og}`)
await page.selectOption('select[name="packageId"]', 'stag').catch(() => {})
const stagHidden = (await page.locator('input[name="withStag"]').count()) === 0
await page.selectOption('select[name="packageId"]', 'ceremony').catch(() => {})
const ceremonyHidden = (await page.locator('input[name="withStag"]').count()) === 0
await page.selectOption('select[name="packageId"]', 'full').catch(() => {})
await page.locator('input[name="withStag"]').check()
say('book stag', `dateField=${await page.locator('input[name="stagDate"]').count()} hiddenForStag=${stagHidden} hiddenForCeremony=${ceremonyHidden}`)
page = await open('/terms')
text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
say('terms', `hst13=${/13% HST/.test(text)} cardFee3=${/3% card fee/.test(text)}`)
for (const width of [390, 768, 1280]) {
  for (const path of ['/', '/weddings']) {
    const p = await open(path, width)
    const r = await p.evaluate(() => {
      const slides = [...document.querySelectorAll('[aria-roledescription="slide"]')]
      const visible = slides.filter((s) => { const b = s.getBoundingClientRect(); return b.width > 0 && b.left >= -2 && b.right <= window.innerWidth + 2 }).length
      return { slides: slides.length, visible, google: [...document.querySelectorAll('a')].filter((a) => /Read on Google/i.test(a.innerText)).length, prev: !!document.querySelector('button[aria-label*="revious"]'), next: !!document.querySelector('button[aria-label*="ext"]') }
    })
    say(`reviews ${path} ${width}`, JSON.stringify(r))
    await p.close()
  }
}
say('errors', errors.join(' | ') || 'none')
await browser.close()
