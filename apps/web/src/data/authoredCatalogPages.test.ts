import { describe, expect, it, vi } from 'vitest'
import { loadPagedAuthoredCatalogItems } from './authoredCatalogPages'

const request = { direction: 'FORWARD', limit: 48, sort: 'name' } as const

describe('loadPagedAuthoredCatalogItems', () => {
  it('walks bounded cursor pages in order', async () => {
    const list = vi.fn(
      async (input: typeof request & { cursor?: { id: string; values: string[] } }) =>
        input.cursor
          ? {
              items: [{ id: 'two' }],
              page: { nextCursor: null }
            }
          : {
              items: [{ id: 'one' }],
              page: { nextCursor: { id: 'one', values: ['one'] } }
            }
    )

    await expect(loadPagedAuthoredCatalogItems(list, request)).resolves.toEqual([
      { id: 'one' },
      { id: 'two' }
    ])
    expect(list).toHaveBeenNthCalledWith(1, request)
    expect(list).toHaveBeenNthCalledWith(2, {
      ...request,
      cursor: { id: 'one', values: ['one'] }
    })
  })

  it('fails closed when pagination repeats a cursor', async () => {
    const cursor = { id: 'one', values: ['one'] }
    const list = vi.fn(async () => ({ items: [], page: { nextCursor: cursor } }))

    await expect(loadPagedAuthoredCatalogItems(list, request)).rejects.toThrow(
      'Authored catalogue pagination returned a repeated cursor.'
    )
  })
})
