import { describe, expect, it } from 'vitest'
import {
  assertCharacterBuilderDraftRevisionFresh,
  CharacterBuilderDraftConflictError
} from './characterBuilderDraftConflict.js'

describe('character builder draft conflict guard', () => {
  it('allows draft-only finalization when no active revision exists', () => {
    expect(() => assertCharacterBuilderDraftRevisionFresh({
      activeUpdatedAt: null,
      characterId: 'character-draft-only',
      draftBaseActiveUpdatedAt: null,
      hasDraft: true
    })).not.toThrow()
  })

  it('allows finalization when the draft base revision matches the active revision', () => {
    expect(() => assertCharacterBuilderDraftRevisionFresh({
      activeUpdatedAt: '2026-05-03T10:15:30.000Z',
      characterId: 'character-active',
      draftBaseActiveUpdatedAt: new Date('2026-05-03T10:15:30.000Z'),
      hasDraft: true
    })).not.toThrow()
  })

  it('rejects finalization when the active revision changed after the draft was saved', () => {
    expect(() => assertCharacterBuilderDraftRevisionFresh({
      activeUpdatedAt: '2026-05-03T10:16:30.000Z',
      characterId: 'character-stale',
      draftBaseActiveUpdatedAt: '2026-05-03T10:15:30.000Z',
      hasDraft: true
    })).toThrow(CharacterBuilderDraftConflictError)
  })

  it('rejects finalization of an active record when no draft revision is available', () => {
    expect(() => assertCharacterBuilderDraftRevisionFresh({
      activeUpdatedAt: '2026-05-03T10:16:30.000Z',
      characterId: 'character-missing-draft',
      draftBaseActiveUpdatedAt: null,
      hasDraft: false
    })).toThrow(CharacterBuilderDraftConflictError)
  })
})
