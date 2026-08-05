import { describe, expect, it, vi } from 'vitest'

import { fetchDndBeyondCharacter } from './dndBeyondClient.js'

describe('D&D Beyond client', () => {
  it('shares one byte budget across a batch', async () => {
    const fetcher = vi.fn(async () => new Response('{}'))
    const budget = { remainingBytes: 3 }

    await fetchDndBeyondCharacter('1', fetcher as unknown as typeof fetch, budget)

    await expect(
      fetchDndBeyondCharacter('2', fetcher as unknown as typeof fetch, budget)
    ).rejects.toThrow('batch exceeds 25 MiB')
    expect(budget.remainingBytes).toBe(0)
  })
})
