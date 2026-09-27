import { describe, expect, it } from 'vitest'
import { sha256Hex } from '../utils/sha256.js'

/** Node's own SHA-256 (`globalThis.crypto` is `node:crypto`'s Web Crypto) over the UTF-8 bytes. */
async function nodeSha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('sha256Hex', () => {
  it('matches the NIST FIPS 180-2 vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    )
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
    )
  })

  it('pads every block boundary length exactly', async () => {
    for (const length of [1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
      const text = 'x'.repeat(length)
      expect(sha256Hex(text), `length ${length}`).toBe(await nodeSha256(text))
    }
  })

  it('hashes the UTF-8 bytes of multi-byte and unpaired-surrogate text', async () => {
    for (const text of ['é', '雪', '🧙‍♀️', 'a雪🧙‍♀️'.repeat(20), '\ud800', 'x\udc00y'])
      expect(sha256Hex(text)).toBe(await nodeSha256(text))
  })

  it('equals node:crypto on random inputs', async () => {
    const alphabet = ['a', 'Z', '0', '"', '\\', '\n', 'é', '雪', '🧙', '\ud800']
    let seed = 0x9e3779b9
    const next = () => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return seed >>> 0
    }
    for (let sample = 0; sample < 300; sample++) {
      const length = next() % 400
      let text = ''
      for (let index = 0; index < length; index++) text += alphabet[next() % alphabet.length]
      expect(sha256Hex(text)).toBe(await nodeSha256(text))
    }
  })
})
