import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => { delete Object.hasOwn; delete Array.prototype.at; delete Array.prototype.findLast })
for (const path of ['/', '/portal', '/weddings', '/rsvp']) await page.goto('https://piperpweddingdj.services' + path + '?r=' + Date.now(), { waitUntil: 'networkidle' })
const ok = await page.evaluate(() => typeof Object.hasOwn === 'function')
console.log(`::notice title=old::filled=${ok} errors=${errors.join(' | ') || 'none'}`)
await browser.close()
