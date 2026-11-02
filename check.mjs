import { chromium } from 'playwright'
const browser = await chromium.launch()
const base = 'https://piperpweddingdj.services'
const say = (title, value) => console.log(`::notice title=${title}::${String(value).replace(/\s+/g, ' ').slice(0, 900)}`)
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(base + '/?r=' + Date.now(), { waitUntil: 'networkidle' })
const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => /logo|brand/.test(s || '')))
say('home logos', imgs.join(', ') + ` inverted=${imgs.some((s) => s.includes('logo-inverted'))}`)
await page.goto(base + '/book?r=' + Date.now(), { waitUntil: 'networkidle' })
await page.selectOption('select[name="packageId"]', 'stag')
const stagHidden = (await page.locator('input[name="withStag"]').count()) === 0
await page.selectOption('select[name="packageId"]', 'ceremony')
const ceremonyHidden = (await page.locator('input[name="withStag"]').count()) === 0
await page.selectOption('select[name="packageId"]', 'full')
await page.locator('input[name="withStag"]').check()
const required = await page.locator('input[name="stagDate"]').evaluate((el) => el.required).catch(() => null)
say('book stag', `required=${required} hiddenForStag=${stagHidden} hiddenForCeremony=${ceremonyHidden}`)
await browser.close()
