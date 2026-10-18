import { describe, expect, it } from 'vitest'
import { allowlistProblems, findDoubleCasts } from './doubleCasts.mjs'

const casts = (source) => findDoubleCasts('probe.ts', source).length

describe('findDoubleCasts', () => {
  it('finds a cast through unknown in either assertion syntax, parenthesized or not', () => {
    expect(casts('const a = value as unknown as string')).toBe(1)
    expect(casts('const a = (value as unknown) as string')).toBe(1)
    expect(casts('const a = <string>(<unknown>value)')).toBe(1)
    expect(casts('const a = f(x as unknown as A, y as unknown as B)')).toBe(2)
  })

  it('accepts a single assertion, including one to unknown', () => {
    expect(casts('const a = value as unknown')).toBe(0)
    expect(casts('const a = value as string')).toBe(0)
    expect(casts('const a = (value as A) as B')).toBe(0)
  })
})

describe('allowlistProblems', () => {
  const allowed = { 'a.ts': { count: 2, reason: 'seam' } }
  const at = (file, line) => ({ file, line })

  it('passes when every cast is in an allowlisted file at its exact count', () => {
    expect(allowlistProblems([at('a.ts', 1), at('a.ts', 9)], allowed)).toEqual([])
  })

  it('fails on a cast in a file the allowlist does not name', () => {
    expect(allowlistProblems([at('a.ts', 1), at('a.ts', 9), at('b.ts', 4)], allowed)).toEqual([
      'b.ts:4: cast through unknown; type the value instead.'
    ])
  })

  it('fails when an allowlisted file gains or loses a cast', () => {
    expect(allowlistProblems([at('a.ts', 1), at('a.ts', 2), at('a.ts', 3)], allowed)).toEqual([
      'a.ts: 3 double casts, allowlist says 2; type the new cast instead.'
    ])
    expect(allowlistProblems([], allowed)).toEqual([
      'a.ts: 0 double casts, allowlist says 2; lower the allowlist count.'
    ])
  })
})
