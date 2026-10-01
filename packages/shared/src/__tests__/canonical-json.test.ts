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

  it('preserves own __proto__ properties at every depth without changing prototypes', () => {
    const canonical = '{"__proto__":{"polluted":true},"nested":[{"__proto__":{"value":1}}]}'
    const input: unknown = JSON.parse(canonical)
    const normalized = normalizeCanonicalJson(input)

    expect(normalized).toStrictEqual(input)
    expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(normalized, '__proto__')?.value).toEqual({
      polluted: true
    })
    expect(canonicalizeJson(input)).toBe(canonical)
    expect(canonicalizeJson(JSON.parse(canonicalizeJson(input)))).toBe(canonical)
    expect(Object.getPrototypeOf(input)).toBe(Object.prototype)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('rejects enumerable accessors without executing them, including nested objects and arrays', () => {
    let getterCalls = 0
    const accessor = {
      get value() {
        getterCalls += 1
        return 1
      }
    }
    const array: unknown[] = [null]
    Object.defineProperty(array, '0', Object.getOwnPropertyDescriptor(accessor, 'value')!)
    const setterOnly = Object.defineProperty({}, 'value', { enumerable: true, set() {} })

    for (const value of [
      accessor,
      { nested: accessor },
      [accessor],
      array,
      { nested: array },
      setterOnly
    ]) {
      expect(() => normalizeCanonicalJson(value)).toThrow(TypeError)
      expect(() => canonicalizeJson(value)).toThrow(TypeError)
      expect(() => checksumCanonicalJson(value)).toThrow(TypeError)
      expect(() => equalCanonicalJson(value, {})).toThrow(TypeError)
    }
    expect(getterCalls).toBe(0)
  })

  it('continues to ignore non-enumerable accessors', () => {
    const value = Object.defineProperty({ kept: 1 }, 'hidden', {
      get() {
        throw new Error('Non-enumerable getters must not run.')
      }
    })
    expect(canonicalizeJson(value)).toBe('{"kept":1}')
  })
})
