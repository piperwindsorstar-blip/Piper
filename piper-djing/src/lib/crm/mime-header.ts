/**
 * Mail headers that carry more than plain ASCII. RFC 2047 says a display name
 * or subject with "·", accents or emoji must travel as encoded-words, or mail
 * clients show it garbled. These helpers write them, split so no word runs
 * past the 75-character limit and no character is cut in half.
 */

const encoder = new TextEncoder()

/** Characters that force a display name into quotes (RFC 5322 specials). */
const SPECIALS = /[()<>[\]:;@\\,."]/u

function isAscii(text: string): boolean {
  return /^[\x20-\x7E]*$/u.test(text)
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * The text as one or more `=?UTF-8?B?…?=` words, joined by folding white space
 * so a long name can wrap. Plain ASCII without control characters is left as
 * it is.
 */
export function encodeWords(text: string): string {
  const clean = text.replace(/[\r\n]+/gu, ' ').trim()
  if (isAscii(clean)) return clean
  // 45 bytes of UTF-8 make 60 base64 characters, inside the 75 limit.
  const words: string[] = []
  let chunk: number[] = []
  for (const char of clean) {
    const bytes = encoder.encode(char)
    if (chunk.length + bytes.length > 45) {
      words.push(`=?UTF-8?B?${base64(Uint8Array.from(chunk))}?=`)
      chunk = []
    }
    chunk.push(...bytes)
  }
  if (chunk.length > 0) words.push(`=?UTF-8?B?${base64(Uint8Array.from(chunk))}?=`)
  return words.join('\r\n ')
}

/**
 * A From (or To) header value: `Mark & Mya <x@y>` stays readable, a name with
 * "·" or accents is encoded, and a name with specials is quoted.
 */
export function addressHeader(name: string, address: string): string {
  const display = name.replace(/[\r\n]+/gu, ' ').trim()
  if (!display) return `<${address}>`
  if (!isAscii(display)) return `${encodeWords(display)} <${address}>`
  if (SPECIALS.test(display)) {
    return `"${display.replace(/["\\]/gu, (char) => `\\${char}`)}" <${address}>`
  }
  return `${display} <${address}>`
}

/** Reads an encoded header back to text. Used by the tests. */
export function decodeWords(value: string): string {
  return value
    .replace(/\?=\s+=\?/gu, '?==?')
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/giu, (_match, data: string) => {
      const binary = atob(data)
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      return new TextDecoder().decode(bytes)
    })
}
