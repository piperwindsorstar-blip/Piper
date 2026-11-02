import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const base = 'https://piperpweddingdj.services'
const say = (title, value) => console.log(`::notice title=${title}::${String(value).replace(/\s+/g, ' ').slice(0, 900)}`)
async function sentences(path, re) {
  await page.goto(base + path + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const text = await page.evaluate(() => document.body.innerText)
  return text.split(/(?<=[.!?])\s+/).filter((s) => re.test(s)).join(' | ')
}
say('terms', await sentences('/terms', /HST|card|venue|non-wedding/i))
say('weddings copy', await sentences('/weddings', /HST|card fee|uplight|venue|quoted/i))
const wlogo = await page.evaluate(() => [...document.querySelectorAll('header img')].map((i) => i.getAttribute('src')).join(','))
const wreviews = await page.evaluate(() => ({ carousel: !!document.querySelector('[aria-roledescription="carousel"]'), cards: document.querySelectorAll('[aria-roledescription="slide"]').length, google: [...document.querySelectorAll('a')].filter((a) => /Read on Google/i.test(a.innerText)).length }))
say('weddings logo+reviews', `${wlogo} ${JSON.stringify(wreviews)}`)
say('book copy', await sentences('/book', /HST|card|uplight|venue/i))
const book = await page.evaluate(() => ({
  logo: [...document.querySelectorAll('header img')].map((i) => i.getAttribute('src')).join(','),
  og: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
  ogw: document.querySelector('meta[property="og:image:width"]')?.getAttribute('content'),
  stagBox: !!document.querySelector('input[name="withStag"]'),
}))
say('book head', JSON.stringify(book))
const stag = page.locator('input[name="withStag"]')
if (await stag.count()) {
  await stag.check()
  await page.waitForTimeout(300)
  say('book stag date field', await page.locator('input[name="stagDate"]').count())
}
await page.goto(base + '/?r=' + Date.now(), { waitUntil: 'networkidle' })
const home = await page.evaluate(() => ({ carousel: !!document.querySelector('[aria-roledescription="carousel"]'), cards: document.querySelectorAll('[aria-roledescription="slide"]').length, google: [...document.querySelectorAll('a')].filter((a) => /Read on Google/i.test(a.innerText)).length }))
say('home reviews', JSON.stringify(home))
await browser.close()
