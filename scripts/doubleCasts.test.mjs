import { describe, expect, it } from 'vitest'
import { allowlistProblems, findDoubleCasts, findNarrowingCasts } from './doubleCasts.mjs'

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

describe('findNarrowingCasts', () => {
  const narrowing = (source) => findNarrowingCasts('probe.ts', source).length

  it('finds a read value narrowed to a type', () => {
    expect(narrowing('const a = value as Kind')).toBe(1)
    expect(narrowing('const a = params.kind as Kind')).toBe(1)
    expect(narrowing('const a = JSON.parse(text) as Kind')).toBe(1)
    expect(narrowing('const a = (value ?? "x") as Kind')).toBe(1)
    expect(narrowing('const a = <Kind>value')).toBe(1)
  })

  it('accepts const assertions, widening to unknown, and cast literals', () => {
    expect(narrowing('const a = ["x"] as const')).toBe(0)
    expect(narrowing('const a = value as unknown')).toBe(0)
    expect(narrowing('const a = { id: 1 } as Kind')).toBe(0)
  })
})

describe('allowlistProblems for narrowing casts', () => {
  it('names narrowing casts in its messages', () => {
    const labels = { noun: 'narrowing casts', problem: 'cast narrows a read value' }
    expect(allowlistProblems([{ file: 'b.ts', line: 4 }], {}, labels)).toEqual([
      'b.ts:4: cast narrows a read value; type the value instead.'
    ])
  })
})
