import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })
const base = 'https://piperpweddingdj.services'
const say = (t, v) => console.log(`::notice title=${t}::${String(v).replace(/\s+/g, ' ').slice(0, 900)}`)
const browser = await chromium.launch()
const pages = ['/', '/weddings', '/book', '/faq', '/terms', '/wedding-vendors', '/rsvp', '/contact', '/hamilton-wedding-dj', '/sitemap.xml', '/robots.txt']
const problems = []
const rows = []
for (const width of [390, 1280]) {
  for (const path of pages) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errs = []
    const bad = []
    page.on('pageerror', (e) => errs.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
    page.on('response', (r) => r.status() >= 400 && r.url().startsWith(base) && bad.push(`${r.status()} ${r.url().replace(base, '')}`))
    const t0 = Date.now()
    const res = await page.goto(base + path, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => 'ERR ' + e.message }))
    const ms = Date.now() - t0
    const info = await page.evaluate(() => ({
      title: document.title,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('loading') !== 'lazy').map((i) => i.getAttribute('src')),
    })).catch(() => ({ title: '?', overflow: false, broken: [] }))
    if (!path.endsWith('.xml') && !path.endsWith('.txt') && ['/', '/weddings', '/book'].includes(path)) {
      await page.screenshot({ path: `shots/${width}${path === '/' ? '-home' : path.replace(/\//g, '-')}.png`, fullPage: false })
    }
    const status = res.status()
    rows.push(`${width} ${path} ${status} ${ms}ms`)
    if (status !== 200 || info.overflow || info.broken.length || errs.length || bad.length) {
      problems.push(`${width} ${path}: status ${status}${info.overflow ? ', sideways scroll' : ''}${info.broken.length ? ', broken img ' + info.broken.join(' ') : ''}${errs.length ? ', errors ' + errs.slice(0, 2).join(' | ') : ''}${bad.length ? ', ' + bad.slice(0, 3).join(' ') : ''}`)
    }
    await page.close()
  }
}
// The date checker still answers.
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto(base + '/', { waitUntil: 'networkidle' })
await p.click('button[aria-label="Next month"]')
const day = await p.locator('button[aria-label*="2026"], button[aria-label*="2027"]').filter({ hasNot: p.locator('[disabled]') }).nth(10)
const label = await day.getAttribute('aria-label')
await day.click().catch(() => {})
const answer = await p.getByText(/your date is (not )?available/).first().innerText({ timeout: 8000 }).catch(() => 'no answer')
say('date checker', `${label}: ${answer}`)
say('pages', rows.join(' · '))
say('problems', problems.join(' || ') || 'none')
await browser.close()
