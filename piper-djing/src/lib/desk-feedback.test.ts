import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * The desk forms that used to submit on the browser's own click. Each one now
 * runs through ActionButton, so a click disables the button, shows a spinner
 * with what it is doing, and lands on "✓ Saved" or a red line to retry.
 */
const forms: { file: string; buttons: number }[] = [
  { file: 'src/routes/desk/bookings.tsx', buttons: 11 },
  { file: 'src/routes/desk/partners.tsx', buttons: 2 },
  { file: 'src/routes/desk/money.tsx', buttons: 4 },
  { file: 'src/routes/desk/portals/$slug/index.tsx', buttons: 1 },
  { file: 'src/routes/desk/portals/index.tsx', buttons: 3 },
  { file: 'src/routes/desk/questions.tsx', buttons: 2 },
  { file: 'src/routes/desk/reviews.tsx', buttons: 2 },
]

const read = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('desk button feedback', () => {
  for (const { file, buttons } of forms) {
    it(`${file} answers every save`, () => {
      const source = read(file)
      assert.equal(
        [...source.matchAll(/<ActionButton\b/g)].length,
        buttons,
        'every saving button goes through ActionButton',
      )
      assert.doesNotMatch(
        source,
        /type="submit"/,
        'no button submits on its own any more',
      )
      assert.doesNotMatch(
        source,
        /onSubmit=\{\(event\) => \{[^}]*\.then\(/,
        'the surrounding form does not do the work on submit',
      )
      for (const [, body] of source.matchAll(
        /<ActionButton\b([\s\S]*?)<\/ActionButton>/g,
      )) {
        assert.match(body, /busy="[^"]*…"/, 'busy label says what it is doing')
        assert.match(body, /done="[^"]+"/, 'done label names the result')
        assert.match(body, /onRun=/, 'the work lives in onRun')
      }
    })
  }

  it('keeps the button busy until the work lands, once', () => {
    const source = read('src/components/action-button.tsx')
    assert.match(source, /disabled=\{disabled \|\| phase === 'busy'\}/)
    assert.match(source, /if \(phase === 'busy'\) return/)
    assert.match(source, /aria-busy=\{phase === 'busy'\}/)
    assert.match(source, /3000/)
    assert.match(source, /Try again\./)
  })

  it('never asks a desk form to save twice', () => {
    const source = forms.map(({ file }) => read(file)).join('\n')
    assert.doesNotMatch(
      source,
      /<form[^>]*onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\)\s*setBusy/,
    )
  })
})
