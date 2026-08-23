import type { CharacterBuilderDraftDto } from '@artificer-toolkit/schema/api/characters'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import { createCharacterBuilderAuthoringSession } from './characterBuilderAuthoringSession'
import { getCharacterBuilderProgressState } from './characterBuilderAuthoringState'
import { toCharacterFormValues } from '../shared/formNormalization'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture,
  characterFixture
} from '../fixtures/characterBuilder.fixtures'

const draftFixture = {
  characterId: characterFixture.id,
  id: 'draft-character-row',
  publicId: 'character-draft',
  userId: 'user-1',
  systemId: characterFixture.systemId,
  label: 'Astra Vale Draft',
  status: AUTHORED_RECORD_STATUS.DRAFT,
  draftState: 'ACTIVE_WITH_DRAFT',
  mode: 'edit',
  payload: {
    character: characterFixture
  },
  baseActiveUpdatedAt: '2026-05-03T10:15:30.000Z',
  createdAt: '2026-05-04T10:15:30.000Z',
  updatedAt: '2026-05-05T10:15:30.000Z'
} satisfies CharacterBuilderDraftDto

describe('createCharacterBuilderAuthoringSession', () => {
  it('keeps renderer progress updates separate from provider-owned navigation', () => {
    const progress = getCharacterBuilderProgressState(
      characterBuilderPayloadFixture,
      toCharacterFormValues(characterBuilderPayloadFixture)
    )

    expect(progress).not.toHaveProperty('activeStepId')
    expect(progress).not.toHaveProperty('activeStepLabel')
    expect(progress).not.toHaveProperty('visibleSteps')
  })

  it('creates a ready create session from resolved character payload data', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        payload: characterBuilderPayloadFixture,
        systems: []
      },
      mode: 'create'
    })

    expect(session.kind).toBe('character-builder')
    expect(session.mode).toBe('create')
    expect(session.systemRequired).toBe(false)
    expect(session.initialValues?.id).toBe(characterFixture.id)
    expect(session.subjectLabel).toBe(characterFixture.label)
    expect(session.initialAuthoringState?.activeStepId).toBe(
      characterBuilderPayloadFixture.resolution.recommendedSectionId
    )
    expect(session.initialAuthoringState?.visibleSteps).toHaveLength(9)
    expect(session.initialAuthoringState?.progressSummary.stepCount).toBe(9)
  })

  it('keeps the ready create form owner stable across transient Character identities', () => {
    const firstSession = createCharacterBuilderAuthoringSession({
      data: {
        payload: characterBuilderDraftPayloadFixture,
        systems: []
      },
      mode: 'create'
    })
    const nextSession = createCharacterBuilderAuthoringSession({
      data: {
        payload: {
          ...characterBuilderDraftPayloadFixture,
          character: {
            ...characterBuilderDraftPayloadFixture.character,
            id: 'authenticated-transient-character'
          }
        },
        systems: []
      },
      mode: 'create'
    })

    expect(firstSession.formKey).toBe('character:create:ready')
    expect(nextSession.formKey).toBe(firstSession.formKey)
  })

  it('creates a system-required create session when no payload is available', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        payload: null,
        systems: []
      },
      mode: 'create'
    })

    expect(session.systemRequired).toBe(true)
    expect(session.payload).toBeNull()
    expect(session.initialValues).toBeUndefined()
  })

  it('prefers draft payloads for edit sessions with active drafts', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        breadcrumbLabel: draftFixture.label,
        characterId: characterFixture.id,
        draft: draftFixture,
        draftPayload: characterBuilderDraftPayloadFixture,
        response: characterBuilderPayloadFixture
      },
      mode: 'edit'
    })

    expect(session.mode).toBe('edit')
    expect(session.hasActiveDraft).toBe(true)
    expect(session.hasInvalidDraft).toBe(false)
    expect(session.isDraft).toBe(true)
    expect(session.baseActiveUpdatedAt).toBe(draftFixture.baseActiveUpdatedAt)
    expect(session.payload).toBe(characterBuilderDraftPayloadFixture)
    expect(session.initialValues?.builderIntent?.abilities).toBeDefined()
    expect(session.initialAuthoringState?.activeStepId).toBe(
      characterBuilderDraftPayloadFixture.resolution.recommendedSectionId
    )
    expect(session.initialAuthoringState?.visibleSteps).toHaveLength(9)
  })

  it('marks invalid draft-only edit sessions without creating form values', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        breadcrumbLabel: draftFixture.label,
        characterId: characterFixture.id,
        draft: draftFixture,
        draftPayload: null,
        response: null
      },
      mode: 'edit'
    })

    expect(session.invalidDraftOnly).toBe(true)
    expect(session.notFound).toBe(false)
    expect(session.payload).toBeNull()
    expect(session.initialValues).toBeUndefined()
  })

  it('marks edit sessions as not found when no active record or draft exists', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        breadcrumbLabel: null,
        characterId: characterFixture.id,
        draft: null,
        draftPayload: null,
        response: null
      },
      mode: 'edit'
    })

    expect(session.notFound).toBe(true)
    expect(session.invalidDraftOnly).toBe(false)
  })
})
