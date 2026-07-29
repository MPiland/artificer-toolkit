import { z } from 'zod'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'
import { resolveAuthoredDetailState } from './authoredDetailState'

const itemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string()
})

const response = {
  publicId: '1',
  activeRevisionId: 'active-revision-id',
  hasDraft: false,
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

function draft(
  payload: Record<string, unknown>,
  overrides: Partial<AuthoredDraftDto> = {}
): AuthoredDraftDto {
  return {
    subjectKind: 'SPELL',
    subjectId: 'active-id',
    publicId: '1',
    userId: 'user-id',
    systemId: 'system-id',
    label: 'Draft Record',
    status: 'DRAFT',
    draftState: 'ACTIVE_WITH_DRAFT',
    revisionId: 'draft-revision-id',
    revisionNumber: 2,
    activeRevisionId: 'active-revision-id',
    baseActiveRevisionId: 'active-revision-id',
    payload,
    ...overrides
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
    expect(state.canViewActive).toBe(true)
    expect(state.hasActiveContent).toBe(true)
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
    expect(state.canViewActive).toBe(true)
    expect(state.hasActiveContent).toBe(true)
  })

  it('keeps the active view draft affordance without receiving the draft payload', () => {
    const state = resolveAuthoredDetailState({
      draft: null,
      response: { ...response, hasDraft: true },
      schema: itemSchema,
      viewActive: true
    })

    expect(state.mode).toBe('active')
    expect(state.item?.label).toBe('Active Record')
    expect(state.canViewActive).toBe(true)
    expect(state.draft).toBeNull()
  })

  it('does not treat a draft-only detail response as active content', () => {
    const draftOnlyResponse = {
      ...response,
      item: {
        id: 'draft-only-id',
        label: 'Draft Only Record',
        description: 'Draft-only copy'
      }
    }
    const state = resolveAuthoredDetailState({
      draft: draft(
        {
          id: 'draft-only-id',
          label: 'Draft Only Record',
          description: 'Draft-only copy'
        },
        {
          draftState: 'DRAFT_ONLY',
          subjectId: 'draft-only-id'
        }
      ),
      response: draftOnlyResponse,
      schema: itemSchema
    })

    expect(state.mode).toBe('draft')
    expect(state.item?.label).toBe('Draft Only Record')
    expect(state.canViewActive).toBe(false)
    expect(state.hasActiveContent).toBe(false)
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
    expect(state.hasActiveContent).toBe(true)
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
    expect(state.canViewActive).toBe(false)
    expect(state.hasActiveContent).toBe(false)
  })
})
