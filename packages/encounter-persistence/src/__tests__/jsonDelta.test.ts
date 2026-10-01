import { describe, expect, it } from 'vitest'
import {
  canonicalJsonValueSchema,
  canonicalJsonRecordSchema,
  jsonDeltaSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import { applyJsonDelta, diffJson } from '../jsonDelta.js'

const cases: [string, JsonValue, JsonValue][] = [
  ['equal values', { a: [1, 2], b: 'x' }, { a: [1, 2], b: 'x' }],
  ['a changed nested key', { a: { b: 1, c: [1] } }, { a: { b: 2, c: [1] } }],
  ['added and dropped keys', { a: 1, b: 2 }, { b: 2, c: { d: 3 } }],
  ['an appended item', { list: [1, 2, 3] }, { list: [1, 2, 3, 4] }],
  ['a removed leading item', [{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ id: 'b' }, { id: 'c' }]],
  ['a changed middle item', [1, 2, 3, 4], [1, 9, 3, 4]],
  ['repeated items', [1, 1, 1], [1, 1]],
  ['a type change', { a: [1] }, { a: { 0: 1 } }],
  ['a scalar', 'x', null],
  [
    'prototype names added',
    {},
    JSON.parse('{"constructor":{"prototype":1},"__proto__":{"nested":[1,2]}}')
  ],
  ['prototype names removed', JSON.parse('{"constructor":1,"__proto__":{"nested":1}}'), {}],
  [
    'prototype names changed',
    JSON.parse('{"__proto__":{"nested":1},"constructor":1}'),
    JSON.parse('{"__proto__":{"nested":2},"constructor":{"prototype":3}}')
  ],
  [
    'prototype names unchanged',
    JSON.parse('{"__proto__":1,"constructor":1,"nested":1}'),
    JSON.parse('{"__proto__":1,"constructor":1,"nested":2}')
  ]
]

describe('JSON deltas', () => {
  it('preserves raw own JSON keys and refuses accessors without invoking them', () => {
    const value = JSON.parse('{"__proto__":{"kept":true},"constructor":1}')
    expect(canonicalJsonRecordSchema.parse(value)).toBe(value)
    expect(canonicalJsonValueSchema.parse(value)).toBe(value)
    let invoked = false
    const accessor = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() {
        invoked = true
        return 1
      }
    })
    expect(canonicalJsonValueSchema.safeParse(accessor).success).toBe(false)
    expect(jsonDeltaSchema.safeParse({ set: accessor }).success).toBe(false)
    expect(invoked).toBe(false)
    expect(canonicalJsonRecordSchema.safeParse([]).success).toBe(false)
  })

  it.each(cases)('rebuild the next value after %s', (_, previous, next) => {
    const delta = diffJson(previous, next)
    expect(delta === null).toBe(JSON.stringify(previous) === JSON.stringify(next))
    const rebuilt = delta
      ? applyJsonDelta(previous, jsonDeltaSchema.parse(JSON.parse(JSON.stringify(delta))))
      : previous
    expect(rebuilt).toEqual(next)
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(next))
    if (typeof rebuilt === 'object' && rebuilt !== null && !Array.isArray(rebuilt))
      expect(Object.getPrototypeOf(rebuilt)).toBe(Object.prototype)
  })

  it('carries only the changed parts', () => {
    const large = 'x'.repeat(10_000)
    const delta = diffJson(
      { sealed: large, choices: [{ id: 1 }], cursor: 1 },
      { sealed: large, choices: [{ id: 1 }, { id: 2 }], cursor: 2 }
    )
    expect(JSON.stringify(delta).length).toBeLessThan(100)
  })

  it('strictly validates every delta branch and nested JSON value', () => {
    for (const valid of [
      { set: [null, true, 1, 'value', { nested: [] }] },
      { keys: { nested: { keep: [0, 1], splice: [2] } }, drop: ['removed'] },
      { keep: [0, 0], splice: [] }
    ])
      expect(jsonDeltaSchema.safeParse(valid).success).toBe(true)

    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const cyclicDelta: { keys: Record<string, unknown>; drop: string[] } = { keys: {}, drop: [] }
    cyclicDelta.keys.self = cyclicDelta
    const throwing = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() {
        throw new Error('Invalid JSON accessor')
      }
    })
    for (const invalid of [
      {},
      { set: 1, extra: true },
      { keys: {}, drop: [], extra: true },
      { keep: [0, 0], splice: [], extra: true },
      { set: undefined },
      { set: { nested: Number.POSITIVE_INFINITY } },
      { set: Number.NaN },
      { set: new Date() },
      { set: cyclic },
      { set: throwing },
      cyclicDelta,
      { keys: cyclic, drop: [] },
      { keys: { nested: { set: 1, extra: true } }, drop: [] },
      { keys: {}, drop: [1] },
      { keep: [-1, 0], splice: [] },
      { keep: [0.5, 0], splice: [] },
      { keep: [0], splice: [] },
      { keep: [0, 0, 0], splice: [] },
      { keep: [Infinity, 0], splice: [] },
      { keep: [Number.MAX_SAFE_INTEGER + 1, 0], splice: [] },
      { keep: [0, 0], splice: [undefined] },
      { set: Array(1) },
      { set: JSON.parse('{"__proto__":{}}'), keys: {}, drop: [] },
      { set: { ['__proto__']: undefined } },
      { keys: { ['__proto__']: { set: Infinity } }, drop: [] }
    ])
      expect(jsonDeltaSchema.safeParse(invalid).success).toBe(false)

    expect(() => applyJsonDelta([1], jsonDeltaSchema.parse({ keep: [1, 1], splice: [] }))).toThrow(
      'A JSON array delta needs the array it was taken from.'
    )
  })
})
