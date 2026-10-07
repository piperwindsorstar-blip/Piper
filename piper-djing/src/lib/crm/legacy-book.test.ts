import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  bookPathAction,
  legacyDateAnswerFromBody,
  rewriteLegacyCookie,
  rewriteLegacyHtml,
  isLegacyAsset,
  relayMissingAsset,
  rewriteLegacyLocation,
  unknownServerFn,
} from '../legacy-book.server.ts'
import { legacyLocation } from '../legacy-host.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('old host', () => {
  it('sends the public pages to the new address', () => {
    assert.equal(legacyLocation('piperp-wedding-dj.grok.me', '/', ''), 'https://piperpweddingdj.services/')
    assert.equal(
      legacyLocation('piperp-wedding-dj.grok.me', '/book', '?from=home'),
      'https://piperpweddingdj.services/book?from=home',
    )
  })

  it('leaves the bot connection and couple links on the old host', () => {
    assert.equal(legacyLocation('piperp-wedding-dj.grok.me', '/api/bots/v1', ''), null)
    assert.equal(legacyLocation('piperp-wedding-dj.grok.me', '/api/bots/v1/join', ''), null)
    assert.equal(legacyLocation('piperp-wedding-dj.grok.me', '/c/abc', ''), null)
    assert.equal(legacyLocation('piperp-wedding-dj.grok.me', '/p/abc', ''), null)
    assert.equal(legacyLocation('piperpweddingdj.services', '/', ''), null)
  })
})

describe('which book answers', () => {
  it('reads bots and nested couple pages from the old book', () => {
    assert.equal(bookPathAction('/api/bots/v1').kind, 'bots')
    assert.equal(bookPathAction('/api/bots/v1/glance').kind, 'bots')
    assert.equal(bookPathAction('/c/abc/invoice').kind, 'legacy-page')
    assert.equal(bookPathAction('/').kind, 'pass')
    assert.equal(bookPathAction('/book').kind, 'pass')
    assert.equal(bookPathAction('/photos/instagram-nametag.png').kind, 'pass')
  })

  it('keeps an exact couple or invoice slug for the desk that created it', () => {
    assert.deepEqual(bookPathAction('/c/nora'), { kind: 'couple', slug: 'nora' })
    assert.deepEqual(bookPathAction('/c/nora/'), { kind: 'couple', slug: 'nora' })
    assert.deepEqual(bookPathAction('/p/inv-1'), { kind: 'invoice', slug: 'inv-1' })
  })

  it('names a server function by its id', () => {
    assert.deepEqual(bookPathAction('/_serverFn/abc123'), { kind: 'server-fn', id: 'abc123' })
  })
})

describe('old pages on the new address', () => {
  it('loads the old scripts from the old host', () => {
    const html = rewriteLegacyHtml('<link href="/assets/app.js"><script src="/assets/app.js"></script>')
    assert.match(html, /https:\/\/piperp-wedding-dj\.grok\.me\/assets\/app\.js/)
    assert.doesNotMatch(html, /href="\/assets\//)
  })

  it('keeps a redirect on the address the visitor is using', () => {
    assert.equal(
      rewriteLegacyLocation('https://piperp-wedding-dj.grok.me/c/abc', 'https://piperpweddingdj.services'),
      'https://piperpweddingdj.services/c/abc',
    )
    assert.equal(rewriteLegacyLocation('/c/abc', 'https://piperpweddingdj.services'), '/c/abc')
  })

  it('does not pin a cookie to the old host', () => {
    assert.equal(
      rewriteLegacyCookie('session=1; HttpOnly; Domain=grok.me; Path=/'),
      'session=1; HttpOnly; Path=/',
    )
  })

  it('recognises an unknown server function', () => {
    const unknown = new Response('{"status":500,"unhandled":true,"message":"HTTPError"}', {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
    const known = new Response('{"open":true}', { status: 200 })
    const ours = new Response('{"message":"Choose a date."}', {
      status: 500,
      headers: { 'x-tss-serialized': 'true' },
    })
    assert.equal(unknownServerFn(unknown), true)
    assert.equal(unknownServerFn(known), false)
    assert.equal(unknownServerFn(ours), false)
  })

  it('fetches an old script only when this site does not have it', () => {
    assert.equal(isLegacyAsset('/assets/styles-DuKtIWRK.css'), true)
    assert.equal(isLegacyAsset('/photos/instagram-nametag.png'), true)
    assert.equal(isLegacyAsset('/book'), false)
    const missing = new Response('missing', { status: 404, headers: { 'content-type': 'text/html' } })
    const found = new Response('png', { status: 200, headers: { 'content-type': 'image/png' } })
    assert.equal(relayMissingAsset(missing, '/assets/styles-DuKtIWRK.css'), true)
    assert.equal(relayMissingAsset(found, '/photos/instagram-nametag.png'), false)
  })

  it('reads taken and open from the old date check', () => {
    const taken = '{"t":10,"p":{"k":["answer"],"v":[{"t":1,"s":"taken"}]}}'
    const open = '{"t":10,"p":{"k":["answer"],"v":[{"t":1,"s":"open"}]}}'
    assert.equal(legacyDateAnswerFromBody(taken), 'taken')
    assert.equal(legacyDateAnswerFromBody(open), 'open')
    assert.equal(legacyDateAnswerFromBody('{}'), 'unknown')
  })
})

describe('the book is not wiped', () => {
  it('only creates missing tables and keeps the same Cloudflare book', () => {
    const files = [
      'exports.cloudflare.ts',
      'src/lib/db.server.ts',
      'src/lib/legacy-book.server.ts',
      'vite.config.ts',
    ].map((file) => readFileSync(resolve(root, file), 'utf8'))
    const source = files.join('\n')
    assert.doesNotMatch(source, /\bDROP\b/i)
    assert.doesNotMatch(source, /\bTRUNCATE\b/i)
    assert.doesNotMatch(
      source,
      /\bDELETE\s+FROM\s+(bookings|payments|invoices|media|leads|forms|bots|questions|terms|emails)\b/i,
    )
    assert.match(source, /CREATE TABLE IF NOT EXISTS bookings/)
    assert.match(source, /migrations: \[\{ tag: 'v1', new_sqlite_classes: \['Book'\] \}\]/)
    assert.match(source, /export class Book extends DurableObject/)
  })
})
