import { describe, expect, it } from 'vitest'
import type { ClassListResponseDto } from '#app/lib/api'
import {
  buildClassListFilters,
  formatClassCategory,
  mapClassListToAuthoredItems
} from './classListMapper'

describe('class list mapper', () => {
  it('keeps uncategorized drafts distinct from base classes', () => {
    const response = createClassListResponse([
      createClassListItem({
        id: 'draft-class',
        category: undefined,
        label: 'Untitled Draft'
      }),
      createClassListItem({
        id: 'base-class',
        category: 'BASE',
        label: 'Fighter'
      })
    ])

    const items = mapClassListToAuthoredItems(response)
    const filters = buildClassListFilters(response)

    expect(formatClassCategory(undefined)).toBe('Uncategorized')
    expect(items.find((item) => item.id === 'draft-class')).toMatchObject({
      attributes: { Category: 'Uncategorized' },
      filterValues: { category: 'UNCATEGORIZED' }
    })
    expect(items.find((item) => item.id === 'base-class')).toMatchObject({
      attributes: { Category: 'Base Class' },
      filterValues: { category: 'BASE' }
    })
    expect(filters.find((filter) => filter.key === 'category')?.options).toEqual([
      { value: 'BASE', label: 'Base Class' },
      { value: 'UNCATEGORIZED', label: 'Uncategorized' }
    ])
  })

  it('marks subclasses as child rows under their parent class', () => {
    const response = createClassListResponse([
      createClassListItem({
        id: 'fighter',
        category: 'BASE',
        label: 'Fighter'
      }),
      createClassListItem({
        id: 'champion',
        category: 'SUBCLASS',
        label: 'Champion',
        parentClassId: 'fighter'
      })
    ])

    const items = mapClassListToAuthoredItems(response)

    expect(items.find((item) => item.id === 'champion')).toMatchObject({
      hierarchy: {
        level: 1,
        parentId: 'fighter',
        parentLabel: 'Fighter'
      }
    })
  })
})

function createClassListResponse(items: ClassListResponseDto['items']): ClassListResponseDto {
  return {
    items,
    drafts: [],
    meta: {}
  }
}

function createClassListItem(
  overrides: Partial<ClassListResponseDto['items'][number]>
): ClassListResponseDto['items'][number] {
  return {
    id: 'class-id',
    publicId: overrides.id ?? 'class-id',
    activeRevisionId: 'class-active-revision',
    label: 'Class',
    status: 'DRAFT',
    description: null,
    userId: 'user-1',
    systemId: 'system-1',
    provenance: {
      kind: 'OWNED',
      ownerUserId: 'user-1'
    },
    permissions: {
      canView: true,
      canEdit: true,
      canCopy: true,
      canDelete: false
    },
    ...overrides
  }
}
