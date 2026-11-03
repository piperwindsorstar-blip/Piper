import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('https://piperpweddingdj.services/faq?r=' + Date.now(), { waitUntil: 'networkidle' })
const html = await page.content()
const say = (t, v) => console.log(`::notice title=${t}::${String(v).replace(/\s+/g, ' ').slice(0, 900)}`)
say('faq deposit', `custom=${html.includes('A Custom event is deposited at 30% of the agreed price unless Piper sets another deposit.')} event=${html.includes('A non-wedding event deposit is set at Piper&#x27;s discretion.') || html.includes("A non-wedding event deposit is set at Piper's discretion.")} wedding=${html.includes('is a flat $500 deposit.')}`)
say('faq book', `quote=${html.includes('Custom quote — Piper replies personally within one business day.')} steps=${html.includes('Four steps: check your date')}`)
await browser.close()
