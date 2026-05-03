import { z } from 'zod'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import { resolveAuthoredDetailState } from './authoredDetailState'

const itemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string()
})

const response = {
  item: {
    id: 'active-id',
    label: 'Active Record',
    description: 'Active copy'
  },
  permissions: {
    canCopy: true,
    canDelete: false,
    canEdit: true,
    canView: true
  },
  provenance: {
    kind: 'OWNED' as const,
    ownerUserId: 'user-id'
  }
}

function draft(payload: Record<string, unknown>): AuthoredDraftDto {
  return {
    id: 'draft-row-id',
    subjectKind: 'SPELL',
    subjectId: 'active-id',
    userId: 'user-id',
    systemId: 'system-id',
    label: 'Draft Record',
    status: 'DRAFT',
    draftState: 'ACTIVE_WITH_DRAFT',
    payload
  }
}

describe('resolveAuthoredDetailState', () => {
  it('prefers a valid draft preview over active content by default', () => {
    const state = resolveAuthoredDetailState({
      draft: draft({
        id: 'active-id',
        label: 'Draft Record',
        description: 'Draft copy'
      }),
      response,
      schema: itemSchema
    })

    expect(state.mode).toBe('draft')
    expect(state.item?.label).toBe('Draft Record')
    expect(state.activeItem?.label).toBe('Active Record')
  })

  it('can show active content when a valid draft also exists', () => {
    const state = resolveAuthoredDetailState({
      draft: draft({
        id: 'active-id',
        label: 'Draft Record',
        description: 'Draft copy'
      }),
      response,
      schema: itemSchema,
      viewActive: true
    })

    expect(state.mode).toBe('active')
    expect(state.item?.label).toBe('Active Record')
    expect(state.draftItem?.label).toBe('Draft Record')
  })

  it('falls back to active content when a stale draft is invalid', () => {
    const state = resolveAuthoredDetailState({
      draft: draft({ id: 'active-id' }),
      response,
      schema: itemSchema
    })

    expect(state.mode).toBe('active')
    expect(state.hasInvalidDraft).toBe(true)
    expect(state.item?.label).toBe('Active Record')
  })

  it('returns an invalid draft-only recovery state without throwing', () => {
    const state = resolveAuthoredDetailState({
      draft: draft({ id: 'draft-only' }),
      response: null,
      schema: itemSchema
    })

    expect(state.mode).toBe('invalid-draft-only')
    expect(state.item).toBeNull()
    expect(state.hasInvalidDraft).toBe(true)
  })
})
