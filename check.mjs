import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = 'https://piperpweddingdj.services'
await page.goto(base + '/book?r=' + Date.now(), { waitUntil: 'networkidle' })
const wedding = await page.evaluate(() => ({
  checked: document.querySelector('input[name="bookEventType"]:checked')?.value,
  est: document.querySelector('[aria-label="Price estimate"]')?.innerText.replace(/\s+/g, ' ').slice(0, 60),
}))
console.log(`::notice title=book wedding::${JSON.stringify(wedding)}`)
await page.locator('label', { hasText: 'Corporate' }).filter({ has: page.locator('input[name="bookEventType"]') }).click()
await page.waitForTimeout(800)
const corp = await page.evaluate(() => ({
  quote: document.body.innerText.includes('Custom quote — Piper replies personally within one business day.'),
  button: [...document.querySelectorAll('button')].some((b) => b.innerText.includes('Request a custom quote')),
  estimate: !!document.querySelector('[aria-label="Price estimate"]'),
  packages: !!document.querySelector('[name="packageId"]'),
  url: location.search,
}))
console.log(`::notice title=book corporate::${JSON.stringify(corp)}`)
await page.goto(base + '/book?event=Christmas%20party&r=' + Date.now(), { waitUntil: 'networkidle' })
const xmas = await page.evaluate(() => document.querySelector('input[name="bookEventType"]:checked')?.value)
console.log(`::notice title=christmas party link::${xmas} errors=${errors.join('|') || 'none'}`)
await browser.close()
