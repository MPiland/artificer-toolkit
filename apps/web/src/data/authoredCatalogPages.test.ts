import {
  authoredCataloguePageSchema,
  type AuthoredCataloguePage,
  type AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { describe, expect, it, vi } from 'vitest'
import { loadPagedAuthoredCatalogItems } from './authoredCatalogPages'

const request: AuthoredCatalogueReadInput = {
  subjectKind: 'CREATURE',
  category: 'beast',
  sort: 'name',
  paginationOpts: { cursor: null, numItems: 48 }
}

function creature(id: string, label: string): AuthoredCataloguePage['page'][number] {
  return {
    id,
    publicId: `creature-${id}`,
    systemId: '22222222-2222-4222-8222-222222222222',
    label,
    description: null,
    status: 'ACTIVE',
    activeUpdatedAt: '2026-09-18T00:00:00.000Z',
    provenance: { kind: 'MASTER', ownerUserId: null },
    permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
  }
}

function page(items: AuthoredCataloguePage['page'], isDone: boolean, continueCursor: string) {
  return authoredCataloguePageSchema.parse({ page: items, isDone, continueCursor })
}

describe('loadPagedAuthoredCatalogItems', () => {
  it('walks complete native cursor pages in order', async () => {
    const first = page(
      [creature('11111111-1111-4111-8111-111111111111', 'One')],
      false,
      'cursor-one'
    )
    const second = page([creature('33333333-3333-4333-8333-333333333333', 'Two')], true, '')
    const list = vi.fn(async (input: AuthoredCatalogueReadInput) =>
      input.paginationOpts.cursor === null ? first : second
    )

    await expect(loadPagedAuthoredCatalogItems(list, request)).resolves.toEqual([
      ...first.page,
      ...second.page
    ])
    expect(list).toHaveBeenNthCalledWith(1, request)
    expect(list).toHaveBeenNthCalledWith(2, {
      ...request,
      paginationOpts: { ...request.paginationOpts, cursor: 'cursor-one' }
    })
  })

  it('fails closed on a repeated native cursor', async () => {
    const list = vi.fn(async () => page([], false, 'cursor-one'))

    await expect(loadPagedAuthoredCatalogItems(list, request)).rejects.toThrow(
      'Authored catalogue pagination returned a repeated cursor.'
    )
  })

  it('continues after an empty intermediate native page', async () => {
    const completed = page([creature('44444444-4444-4444-8444-444444444444', 'Three')], true, '')
    const list = vi.fn(async (input: AuthoredCatalogueReadInput) =>
      input.paginationOpts.cursor === null ? page([], false, 'cursor-one') : completed
    )

    await expect(loadPagedAuthoredCatalogItems(list, request)).resolves.toEqual(completed.page)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('fails closed on a multi-cursor cycle', async () => {
    const list = vi.fn(async (input: AuthoredCatalogueReadInput) => {
      if (input.paginationOpts.cursor === null) return page([], false, 'cursor-one')
      if (input.paginationOpts.cursor === 'cursor-one') return page([], false, 'cursor-two')
      return page([], false, 'cursor-one')
    })

    await expect(loadPagedAuthoredCatalogItems(list, request)).rejects.toThrow(
      'Authored catalogue pagination returned a repeated cursor.'
    )
    expect(list).toHaveBeenCalledTimes(3)
  })
})
