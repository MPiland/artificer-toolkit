import { describe, expect, it } from 'vitest'
import { applyJsonDelta, diffJson, type JsonValue } from '../jsonDelta.js'

const cases: [string, JsonValue, JsonValue][] = [
  ['equal values', { a: [1, 2], b: 'x' }, { a: [1, 2], b: 'x' }],
  ['a changed nested key', { a: { b: 1, c: [1] } }, { a: { b: 2, c: [1] } }],
  ['added and dropped keys', { a: 1, b: 2 }, { b: 2, c: { d: 3 } }],
  ['an appended item', { list: [1, 2, 3] }, { list: [1, 2, 3, 4] }],
  ['a removed leading item', [{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ id: 'b' }, { id: 'c' }]],
  ['a changed middle item', [1, 2, 3, 4], [1, 9, 3, 4]],
  ['repeated items', [1, 1, 1], [1, 1]],
  ['a type change', { a: [1] }, { a: { 0: 1 } }],
  ['a scalar', 'x', null]
]

describe('JSON deltas', () => {
  it.each(cases)('rebuild the next value after %s', (_, previous, next) => {
    const delta = diffJson(previous, next)
    expect(delta === null).toBe(JSON.stringify(previous) === JSON.stringify(next))
    expect(delta ? applyJsonDelta(previous, JSON.parse(JSON.stringify(delta))) : previous).toEqual(
      next
    )
  })

  it('carries only the changed parts', () => {
    const large = 'x'.repeat(10_000)
    const delta = diffJson(
      { sealed: large, choices: [{ id: 1 }], cursor: 1 },
      { sealed: large, choices: [{ id: 1 }, { id: 2 }], cursor: 2 }
    )
    expect(JSON.stringify(delta).length).toBeLessThan(100)
  })
})
