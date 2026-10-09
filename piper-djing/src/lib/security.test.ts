import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applySecurityHeaders, httpsRedirectTarget } from './security.ts'

function request(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers })
}

describe('https', () => {
  it('sends a public http visit to https and keeps the path', () => {
    assert.equal(
      httpsRedirectTarget(
        request('http://piperpweddingdj.services/weddings?from=home'),
      ),
      'https://piperpweddingdj.services/weddings?from=home',
    )
  })

  it('leaves an https visit and local dev alone', () => {
    assert.equal(
      httpsRedirectTarget(request('https://piperpweddingdj.services/')),
      null,
    )
    assert.equal(httpsRedirectTarget(request('http://localhost:8080/')), null)
    assert.equal(
      httpsRedirectTarget(request('http://127.0.0.1:8080/book')),
      null,
    )
    assert.equal(
      httpsRedirectTarget(
        request('https://piperpweddingdj.services/', {
          'cf-visitor': '{"scheme":"https"}',
        }),
      ),
      null,
    )
  })

  it('follows the visitor scheme when the worker url is already https', () => {
    assert.equal(
      httpsRedirectTarget(
        request('https://piperpweddingdj.services/book', {
          'cf-visitor': '{"scheme":"http"}',
        }),
      ),
      'https://piperpweddingdj.services/book',
    )
  })
})

describe('security headers', () => {
  it('locks the public site to https and keeps the desk link off the referrer', () => {
    const response = applySecurityHeaders(
      new Response('ok'),
      request('https://piperpweddingdj.services/'),
    )
    assert.equal(
      response.headers.get('strict-transport-security'),
      'max-age=31536000; includeSubDomains',
    )
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(
      response.headers.get('referrer-policy'),
      'strict-origin-when-cross-origin',
    )
    assert.equal(response.headers.get('x-frame-options'), 'DENY')
    assert.match(
      response.headers.get('content-security-policy') ?? '',
      /frame-ancestors 'none'/,
    )
  })

  it('does not pin localhost to https', () => {
    const response = applySecurityHeaders(
      new Response('ok'),
      request('http://localhost:8080/'),
    )
    assert.equal(response.headers.get('strict-transport-security'), null)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  })
})
