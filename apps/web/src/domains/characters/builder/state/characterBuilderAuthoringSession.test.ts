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

  it('keeps creation read-only until the mounted client opens a persisted draft', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        systemId: characterFixture.systemId,
        systems: []
      },
      mode: 'create'
    })

    expect(session.kind).toBe('character-builder')
    expect(session.mode).toBe('create')
    expect(session.systemRequired).toBe(false)
    expect(session.systemId).toBe(characterFixture.systemId)
    expect(session.characterId).toBeUndefined()
    expect(session.initialValues).toBeUndefined()
    expect(session.draft).toBeNull()
    expect(session.readOnly).toBe(true)
  })

  it('keeps the form owner stable on save but replaces it for a reopened generation', () => {
    const data = {
      characterId: characterFixture.id,
      breadcrumbLabel: draftFixture.label,
      draft: draftFixture,
      activeCharacter: characterFixture
    }
    const firstSession = createCharacterBuilderAuthoringSession({
      data,
      mode: 'edit'
    })
    const nextSession = createCharacterBuilderAuthoringSession({
      data: {
        ...data,
        draft: { ...draftFixture, updatedAt: '2026-09-06T10:15:30.000Z' }
      },
      mode: 'edit'
    })

    expect(firstSession.formKey).toBe(`character:${characterFixture.id}:${draftFixture.id}`)
    expect(nextSession.formKey).toBe(firstSession.formKey)
    const reopened = createCharacterBuilderAuthoringSession({
      data: { ...data, draft: { ...draftFixture, id: 'next-generation' } },
      mode: 'edit'
    })
    expect(reopened.formKey).not.toBe(firstSession.formKey)
  })

  it('creates a system-required create session when no System is available', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        systems: []
      },
      mode: 'create'
    })

    expect(session.systemRequired).toBe(true)
    expect(session.initialValues).toBeUndefined()
  })

  it('opens form values from the stored draft, without a server-resolved payload', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        breadcrumbLabel: draftFixture.label,
        characterId: characterFixture.id,
        draft: { ...draftFixture, payload: characterBuilderDraftPayloadFixture },
        activeCharacter: characterFixture
      },
      mode: 'edit'
    })

    expect(session.mode).toBe('edit')
    expect(session.hasActiveDraft).toBe(true)
    expect(session.isDraft).toBe(true)
    expect(session.readOnly).toBe(false)
    expect(session.draft?.baseActiveUpdatedAt).toBe(draftFixture.baseActiveUpdatedAt)
    expect(session.initialValues).toEqual(
      toCharacterFormValues(characterBuilderDraftPayloadFixture)
    )
    expect(session.initialValues?.builderIntent?.abilities).toBeDefined()
  })

  it('marks edit sessions as not found when no active record or draft exists', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        breadcrumbLabel: null,
        characterId: characterFixture.id,
        draft: null,
        activeCharacter: null
      },
      mode: 'edit'
    })

    expect(session.notFound).toBe(true)
  })

  it('resumes draft-only Characters in create mode without claiming an active draft', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        breadcrumbLabel: draftFixture.label,
        characterId: characterBuilderDraftPayloadFixture.character.id,
        draft: {
          ...draftFixture,
          characterId: characterBuilderDraftPayloadFixture.character.id,
          draftState: 'DRAFT_ONLY',
          mode: 'create',
          baseActiveUpdatedAt: null,
          payload: characterBuilderDraftPayloadFixture
        },
        activeCharacter: null
      },
      mode: 'edit'
    })

    expect(session.mode).toBe('create')
    expect(session.hasActiveDraft).toBe(false)
    expect(session.isDraft).toBe(true)
    expect(session.draft?.baseActiveUpdatedAt).toBeNull()
    expect(session.initialValues?.id).toBe(characterBuilderDraftPayloadFixture.character.id)
  })

  it('opens an active Character without fabricating a draft', () => {
    const session = createCharacterBuilderAuthoringSession({
      data: {
        breadcrumbLabel: characterFixture.label,
        characterId: characterFixture.id,
        draft: null,
        activeCharacter: characterFixture
      },
      mode: 'edit'
    })

    expect(session.mode).toBe('edit')
    expect(session.hasActiveDraft).toBe(false)
    expect(session.isDraft).toBe(false)
    expect(session.notFound).toBe(false)
    expect(session.draft).toBeNull()
    expect(session.readOnly).toBe(true)
    expect(session.systemId).toBe(characterFixture.systemId)
    expect(session.initialValues).toBeUndefined()
  })
})
