import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
const base = 'https://piperpweddingdj.services'
const say = (t, v) => console.log(`::notice title=${t}::${String(v).replace(/\s+/g, ' ').slice(0, 900)}`)
const hits = []
for (const path of ['/', '/weddings', '/book', '/rsvp', '/terms', '/faq', '/contact', '/wedding-vendors', '/hamilton-wedding-dj', '/rsvp/sign-in', '/portal']) {
  await page.goto(base + path + '?r=' + Date.now(), { waitUntil: 'networkidle' })
  const html = await page.content()
  if (/13%|\bHST\b/.test(await page.evaluate(() => document.body.innerText))) hits.push(path)
  if (path === '/rsvp') say('rsvp', `fee=${html.includes('Paying by card adds a 3% card fee.')} old=${html.includes('13% HST')}`)
  if (path === '/') {
    const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join(' '))
    say('home json-ld', `inverted=${ld.includes('logo-inverted')} normal=${ld.includes('/brand/dj-piper-p.png')}`)
  }
  if (path === '/terms') {
    const t = await page.evaluate(() => ({ logo: document.querySelector('main img')?.getAttribute('src'), og: [...document.querySelectorAll('meta[property^="og:image"]')].map((m) => m.getAttribute('content')).join(' ') }))
    say('terms', JSON.stringify(t))
  }
}
say('13% or HST on public pages', hits.join(', ') || 'none')
await browser.close()
