const base = 'https://piperpweddingdj.services'
for (const path of ['/hamilton-wedding-dj', '/oakville-wedding-dj']) {
  const html = await (await fetch(base + path, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } })).text()
  const metas = [...html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description|twitter:description)"[^>]*>/g)].map((m) => m[0])
  console.log(`::notice title=${path} server html::${metas.join(' || ').slice(0, 900)}`)
}
const { chromium } = await import('playwright')
const b = await chromium.launch()
const p = await b.newPage()
await p.goto(base + '/hamilton-wedding-dj', { waitUntil: 'networkidle' })
const d = await p.evaluate(() => [...document.querySelectorAll('meta[name="description"]')].map((m) => m.getAttribute('content')))
console.log(`::notice title=hamilton rendered::${JSON.stringify(d)}`)
await b.close()
