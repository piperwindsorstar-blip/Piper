import { chromium } from 'playwright'
import { renderSVG } from './uqr.mjs'
const url = 'otpauth://totp/DJ%20Piper%20P%3APiper%20Desk?secret=D7X7ABCDEFGHIJKLMNOPQRSTUVWXYZ23&issuer=DJ%20Piper%20P&algorithm=SHA1&digits=6&period=30'
const svg = renderSVG(url, { border: 2, ecc: 'M', pixelSize: 6, whiteColor: '#ffffff', blackColor: '#000000' })
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(`<html><body style="margin:0;background:#fff"><div id="q" style="width:300px">${svg}</div><script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script></body></html>`)
await page.waitForFunction(() => typeof window.jsQR === 'function', null, { timeout: 20000 })
const shot = await page.locator('#q svg').screenshot()
const decoded = await page.evaluate(async (b64) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + b64
  await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const x = c.getContext('2d'); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height)
  return window.jsQR(d.data, d.width, d.height)?.data ?? null
}, shot.toString('base64'))
console.log(`::notice title=qr::${decoded === url ? 'MATCH' : 'MISMATCH ' + decoded}`)
await browser.close()
