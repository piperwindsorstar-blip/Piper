import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const seen = []
page.on('response', async (r) => {
  const u = r.url()
  if (u.includes('_serverFn') || u.includes('/portal')) {
    const h = r.headers()
    seen.push(`${r.request().method()} ${u.replace('https://piperpweddingdj.services', '').slice(0, 90)} ${r.status()} cf=${h['cf-cache-status'] ?? '-'} cc=${h['cache-control'] ?? '-'}`)
  }
})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('https://piperpweddingdj.services/portal?r=' + Date.now(), { waitUntil: 'networkidle' })
await page.locator('input.portal-input').fill('zzzz99')
const enabled = await page.getByRole('button', { name: 'Open the plan' }).isEnabled()
await page.getByRole('button', { name: 'Open the plan' }).click()
await page.waitForTimeout(4000)
const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300)
console.log(`::notice title=portal::enabled=${enabled} || text=${text} || errors=${errors.join(' | ')} || ${seen.join(' ## ')}`)
await browser.close()
