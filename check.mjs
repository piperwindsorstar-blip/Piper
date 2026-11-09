import { chromium } from 'playwright'
const base = 'https://piperpweddingdj.services'
const say = (t, v) => console.log(`::notice title=${t}::${String(v).replace(/\s+/g, ' ').slice(0, 900)}`)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto(base + '/?r=' + Date.now(), { waitUntil: 'networkidle' })
say('home dropdown', (await p.locator('#home-event option').allTextContents()).join(' | '))
await p.goto(base + '/book?r=' + Date.now(), { waitUntil: 'networkidle' })
say('book picker', (await p.locator('input[name="bookEventType"]').evaluateAll((els) => els.map((e) => e.closest('label').innerText.trim()))).join(' | '))
await p.locator('label', { hasText: /^Corporate$/ }).click()
await p.waitForTimeout(800)
say('book corporate', `checked=${await p.locator('input[name="bookEventType"]:checked').getAttribute('value')} quote=${await p.getByText('Custom quote — Piper replies personally within one business day.').count()} packages=${await p.locator('select[name="packageId"]').count()} estimate=${await p.getByText('Your estimate').count()}`)
const towns = ['hamilton', 'cambridge', 'paris', 'woodstock', 'burlington', 'guelph', 'oakville']
const out = []
for (const t of towns) {
  const html = await (await fetch(`${base}/${t}-wedding-dj`)).text()
  out.push(`${t}: ${(html.match(/<meta name="description" content="([^"]*)"/) || [])[1]}`)
}
say('town descriptions 1', out.slice(0, 4).join(' || '))
say('town descriptions 2', out.slice(4).join(' || '))
await b.close()
