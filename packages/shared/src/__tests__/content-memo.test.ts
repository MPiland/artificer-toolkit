import { describe, expect, it, vi } from 'vitest'
import { createContentMemo } from '../utils/contentMemo.js'

const parseJson = (content: string) => {
  const parsed = JSON.parse(content) as { items: number[] }
  return { items: parsed.items, byIndex: new Map(parsed.items.map((item, index) => [index, { item }])) }
}

describe('content memo', () => {
  it('parses an exact content string once and returns the cold result on a warm hit', () => {
    const memo = createContentMemo<ReturnType<typeof parseJson>>()
    const parse = vi.fn(parseJson)
    const content = '{"items":[1,2,3]}'

    const cold = memo(content, parse)
    const warm = memo(content, parse)

    expect(parse).toHaveBeenCalledTimes(1)
    expect(warm).toBe(cold)
    expect(warm).toEqual(parseJson(content))
    expect(memo('{"items": [1,2,3]}', parse)).toEqual(cold)
    expect(parse).toHaveBeenCalledTimes(2)
  })

  it('deep-freezes results, including Map values', () => {
    const memo = createContentMemo<ReturnType<typeof parseJson>>()
    const value = memo('{"items":[1]}', parseJson)

    expect(Object.isFrozen(value)).toBe(true)
    expect(Object.isFrozen(value.items)).toBe(true)
    expect(Object.isFrozen(value.byIndex.get(0))).toBe(true)
    expect(() => value.items.push(2)).toThrow(TypeError)
  })

  it('evicts the least recently used entry past the limit', () => {
    const memo = createContentMemo<string>(2)
    const parse = vi.fn((content: string) => content.toUpperCase())

    memo('a', parse)
    memo('b', parse)
    memo('a', parse)
    memo('c', parse)
    expect(parse).toHaveBeenCalledTimes(3)

    memo('a', parse)
    expect(parse).toHaveBeenCalledTimes(3)
    memo('b', parse)
    expect(parse).toHaveBeenCalledTimes(4)
  })

  it('never stores a failed parse', () => {
    const memo = createContentMemo<number>()
    const parse = vi.fn((): number => {
      throw new Error('invalid')
    })

    expect(() => memo('x', parse)).toThrow('invalid')
    expect(() => memo('x', parse)).toThrow('invalid')
    expect(parse).toHaveBeenCalledTimes(2)
  })
})
