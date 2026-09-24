import { describe, expect, it } from 'vitest'
import {
  canonicalizeJson,
  checksumCanonicalJson,
  equalCanonicalJson,
  normalizeCanonicalJson
} from '../utils/canonicalJson.js'

describe('canonical JSON persistence compatibility', () => {
  it('retains canonical bytes and SHA-256, including undefined normalization and Unicode', async () => {
    const examples: readonly { value: unknown; canonical: string }[] = [
      { value: null, canonical: 'null' },
      { value: true, canonical: 'true' },
      { value: -0, canonical: '0' },
      { value: {}, canonical: '{}' },
      { value: [], canonical: '[]' },
      { value: { b: 2, a: { z: 1, a: 0 } }, canonical: '{"a":{"a":0,"z":1},"b":2}' },
      { value: { omitted: undefined, kept: [undefined, null] }, canonical: '{"kept":[null,null]}' },
      { value: '雪🧙‍♀️\ud800', canonical: '"雪🧙‍♀️\\ud800"' },
      { value: { value: 1e30 }, canonical: '{"value":1e+30}' }
    ]
    for (const { value, canonical } of examples) {
      expect(canonicalizeJson(value)).toBe(canonical)
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
      expect(checksumCanonicalJson(value)).toBe(
        Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      )
    }
  })

  it('normalizes without mutating inputs and compares normalized key order', () => {
    const input = { omitted: undefined, nested: [undefined, { b: 2, a: 1 }] }
    expect(normalizeCanonicalJson(input)).toEqual({ nested: [null, { b: 2, a: 1 }] })
    expect(Object.hasOwn(input, 'omitted')).toBe(true)
    expect(input.nested[0]).toBeUndefined()
    expect(equalCanonicalJson(input, { nested: [null, { a: 1, b: 2 }] })).toBe(true)
    expect(equalCanonicalJson(input, { nested: [null, { a: 1, b: 3 }] })).toBe(false)
  })

  it('retains rejection of non-JSON values and non-plain objects', () => {
    expect(() => canonicalizeJson(undefined)).toThrow(TypeError)
    for (const value of [NaN, Infinity, -Infinity, 1n, new Date(0), Symbol('x'), () => 1]) {
      expect(() => canonicalizeJson(value)).toThrow(TypeError)
      expect(() => checksumCanonicalJson({ nested: value })).toThrow(TypeError)
    }
  })
})
