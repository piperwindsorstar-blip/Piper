import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mailbox, smtpData } from './smtp-edge.ts'
import { addressHeader, decodeWords, encodeWords } from './mime-header.ts'

describe('encoded From names', () => {
  it('encodes the couple name with its middle dot and keeps the address', () => {
    const header = addressHeader('Mark & Mya · RSVP', 'PiperPWeddingDJ@gmail.com')
    assert.match(header, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <PiperPWeddingDJ@gmail\.com>$/)
    assert.equal(decodeWords(header), 'Mark & Mya · RSVP <PiperPWeddingDJ@gmail.com>')
    assert.equal(mailbox(header), 'PiperPWeddingDJ@gmail.com')
  })

  it('keeps accents intact across a long name split into several words', () => {
    const name = 'Zoë-Hélène Brontë-Ångström & François Désirée-Müller · RSVP'
    const encoded = encodeWords(name)
    assert.ok(encoded.split('\r\n ').length > 1)
    for (const word of encoded.split('\r\n ')) assert.ok(word.length <= 75)
    assert.equal(decodeWords(encoded), name)
  })

  it('leaves plain ASCII readable and quotes specials', () => {
    assert.equal(addressHeader('RSVP by DJ Piper P', 'a@b.c'), 'RSVP by DJ Piper P <a@b.c>')
    assert.equal(addressHeader('RSVP', 'a@b.c'), 'RSVP <a@b.c>')
    assert.equal(addressHeader('Piper, DJ', 'a@b.c'), '"Piper, DJ" <a@b.c>')
  })

  it('puts the encoded name and subject in the message the worker sends', () => {
    const data = smtpData({
      from: addressHeader('Mark & Mya · RSVP', 'PiperPWeddingDJ@gmail.com'),
      to: 'pipermartinn@gmail.com',
      replyTo: 'PiperPWeddingDJ@gmail.com',
      letter: { subject: 'You’re invited · Mark & Mya', text: 'Hello' },
    })
    const from = data.split('\r\n').find((line) => line.startsWith('From: '))
    assert.ok(from)
    assert.ok(/^[\x20-\x7E]+$/.test(from), 'the From line is pure ASCII')
    assert.equal(
      decodeWords(from.slice(6)),
      'Mark & Mya · RSVP <PiperPWeddingDJ@gmail.com>',
    )
    assert.match(data, /Subject: =\?UTF-8\?B\?/)
  })
})
