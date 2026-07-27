import { describe, expect, it } from 'vitest'
import {
  assertCharacterBuilderDraftRevisionFresh,
  CharacterBuilderDraftConflictError
} from './characterBuilderDraftConflict.js'

describe('character builder draft conflict guard', () => {
  it('allows draft-only finalization when no active revision exists', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: null,
        baseActiveUpdatedAt: null,
        characterId: 'character-draft-only',
        shouldCheckRevision: true
      })
    ).not.toThrow()
  })

  it('allows direct active commits when no draft or commit baseline exists', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: '2026-05-03T10:15:30.000Z',
        baseActiveUpdatedAt: null,
        characterId: 'character-direct-commit',
        shouldCheckRevision: false
      })
    ).not.toThrow()
  })

  it('allows finalization when the base revision matches the active revision', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: '2026-05-03T10:15:30.000Z',
        baseActiveUpdatedAt: new Date('2026-05-03T10:15:30.000Z'),
        characterId: 'character-active',
        shouldCheckRevision: true
      })
    ).not.toThrow()
  })

  it('allows equivalent ISO and PostgreSQL timestamp strings', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: '2026-05-03 10:15:30+00',
        baseActiveUpdatedAt: '2026-05-03T10:15:30Z',
        characterId: 'character-active',
        shouldCheckRevision: true
      })
    ).not.toThrow()
  })

  it('allows equivalent offset timestamps without dropping fractional precision', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: '2026-05-03 10:15:30.123456+00',
        baseActiveUpdatedAt: '2026-05-03T05:15:30.123456-05:00',
        characterId: 'character-active',
        shouldCheckRevision: true
      })
    ).not.toThrow()
  })

  it('rejects finalization when the active revision changed after the draft was saved', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: '2026-05-03T10:16:30.000Z',
        baseActiveUpdatedAt: '2026-05-03T10:15:30.000Z',
        characterId: 'character-stale',
        shouldCheckRevision: true
      })
    ).toThrow(CharacterBuilderDraftConflictError)
  })

  it('rejects finalization when only the sub-millisecond timestamp differs', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: '2026-05-03T10:15:30.123999Z',
        baseActiveUpdatedAt: '2026-05-03T10:15:30.123456Z',
        characterId: 'character-sub-millisecond-stale',
        shouldCheckRevision: true
      })
    ).toThrow(CharacterBuilderDraftConflictError)
  })

  it('rejects checked finalization when no base revision is available', () => {
    expect(() =>
      assertCharacterBuilderDraftRevisionFresh({
        activeUpdatedAt: '2026-05-03T10:16:30.000Z',
        baseActiveUpdatedAt: null,
        characterId: 'character-missing-baseline',
        shouldCheckRevision: true
      })
    ).toThrow(CharacterBuilderDraftConflictError)
  })
})
