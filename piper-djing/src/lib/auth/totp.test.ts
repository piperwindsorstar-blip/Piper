import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  hotp,
  keyedHash,
  looksLikeBackupCode,
  matchTotp,
  newBackupCodes,
  normalizeBackupCode,
} from './totp.ts'

// RFC 6238 test secret: ASCII "12345678901234567890".
const RFC = base32Encode(new TextEncoder().encode('12345678901234567890'))

describe('authenticator codes', () => {
  it('matches the RFC 6238 test values', async () => {
    assert.equal(RFC, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    assert.equal(await hotp(RFC, Math.floor(59 / 30)), '287082')
    assert.equal(await hotp(RFC, Math.floor(1111111109 / 30)), '081804')
    assert.deepEqual([...base32Decode(RFC)].length, 20)
  })

  it('accepts one step of drift, and never the same step twice', async () => {
    const now = 1111111109 * 1000
    const step = Math.floor(1111111109 / 30)
    assert.equal(await matchTotp(RFC, '081804', now), step)
    assert.equal(await matchTotp(RFC, '081804', now + 30_000), step)
    assert.equal(await matchTotp(RFC, '081804', now + 90_000), null)
    assert.equal(await matchTotp(RFC, '081804', now, step), null)
    assert.equal(await matchTotp(RFC, '12345', now), null)
  })

  it('encrypts the secret, and a different key cannot read it', async () => {
    const sealed = await encryptSecret(RFC, 'key-one')
    assert.equal(sealed.includes(RFC), false)
    assert.equal(await decryptSecret(sealed, 'key-one'), RFC)
    await assert.rejects(() => decryptSecret(sealed, 'key-two'))
  })

  it('makes ten distinct backup codes and hashes them', async () => {
    const codes = newBackupCodes()
    assert.equal(codes.length, 10)
    assert.equal(new Set(codes).size, 10)
    for (const code of codes) {
      assert.match(code, /^[a-z2-9]{4}-[a-z2-9]{4}$/)
      assert.equal(looksLikeBackupCode(code), true)
    }
    assert.equal(looksLikeBackupCode('123456'), false)
    assert.equal(normalizeBackupCode(' K7MQ-2XPD '), 'k7mq2xpd')
    const hash = await keyedHash('backup:k7mq2xpd', 'key-one')
    assert.match(hash, /^[0-9a-f]{64}$/)
    assert.notEqual(hash, await keyedHash('backup:k7mq2xpd', 'key-two'))
  })
})
