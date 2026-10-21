import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('https://piperpweddingdj.services/?r=' + Date.now(), { waitUntil: 'networkidle' })
const imgs = await page.$$eval('a[href*="instagram.com"] img', (els) => els.map((e) => `${e.currentSrc || e.src} ${e.naturalWidth}x${e.naturalHeight}`))
console.log(`::notice title=insta::${imgs.join(' | ')}`)
await browser.close()
