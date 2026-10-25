import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { createEmptyBackground } from '#domains/backgrounds/backgroundAuthoring.utils'
import { createEmptyClass } from '#domains/classes/classAuthoring.utils'
import { createEmptyFeat } from '#domains/feats/featAuthoring.utils'
import { createEmptyEquipment } from '#domains/equipment/equipmentAuthoring.utils'
import { createEmptyVehicle } from '#domains/vehicles/vehicleAuthoring.utils'
import { createEmptyRace } from '#domains/races/raceAuthoring.utils'
import { createEmptyCreature } from '#domains/creatures/creatureAuthoring.utils'
import { createEmptySpell } from '#domains/spells/spellAuthoring.utils'
import { createInitialSession } from '#forms/layout/authoringSessionState'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { createAuthoredOperations } from './authoredOperations'

const client = new ConvexReactClient('https://unit-test.convex.cloud')
const background = createEmptyBackground({
  systemId: DND5E_SYSTEM_ID
})
const classPayload = createEmptyClass({ systemId: background.systemId })
const featPayload = createEmptyFeat({ systemId: background.systemId })
const equipmentPayload = createEmptyEquipment({
  systemId: background.systemId
})
const vehiclePayload = createEmptyVehicle({ systemId: background.systemId })
const racePayload = createEmptyRace({ systemId: background.systemId })
const creaturePayload = createEmptyCreature({ systemId: background.systemId })
const spellPayload = {
  ...createEmptySpell({ systemId: background.systemId }),
  magicSchoolId: 'school'
}

afterEach(() => vi.restoreAllMocks())

function draftFor(
  subjectKind:
    | 'BACKGROUND'
    | 'CLASS'
    | 'FEAT'
    | 'EQUIPMENT'
    | 'RACE'
    | 'CREATURE'
    | 'SPELL'
    | 'VEHICLE',
  payload:
    | typeof background
    | typeof classPayload
    | typeof featPayload
    | typeof equipmentPayload
    | typeof vehiclePayload
    | typeof racePayload
    | typeof creaturePayload
    | typeof spellPayload
): AuthoredDraftResult {
  return {
    subjectKind,
    subjectId: payload.id,
    systemId: payload.systemId,
    publicId: 'public-id',
    userId: 'owner',
    label: 'Server label',
    status: 'DRAFT',
    draftState: 'DRAFT_ONLY',
    baseActiveUpdatedAt: null,
    updatedAt: '2026-09-04T12:00:00.001Z',
    payload
  }
}

describe('native authored operations', () => {
  it('binds Background form-session saves to the provided client', async () => {
    const draft = draftFor('BACKGROUND', background)
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue(draft)
    const session = createInitialSession(
      {
        domain: 'background',
        mode: 'create',
        data: { system: null, systems: [{ id: background.systemId }] }
      },
      client
    )

    await session.authoredSession!.operations.saveDraft(background)

    expect(mutation.mock.calls[0]?.[1]).toEqual({
      subjectKind: 'BACKGROUND',
      subjectId: background.id,
      systemId: background.systemId,
      label: '',
      payload: background
    })
  })

  it('keeps Background publication on the shared mutation endpoint', async () => {
    const draft = draftFor('BACKGROUND', background)
    const mutation = vi
      .spyOn(client, 'mutation')
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({
        publicId: draft.publicId,
        subjectId: draft.subjectId
      })
    await createAuthoredOperations('BACKGROUND', client).activate(background)
    expect(getFunctionName(mutation.mock.calls[1]![0])).toBe(
      getFunctionName(api.content.publication.publishDraft)
    )
    expect(mutation.mock.calls[1]?.[1]).toEqual({
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
  })

  it.each([
    ['feat', 'FEAT', featPayload],
    ['equipment', 'EQUIPMENT', equipmentPayload],
    ['race', 'RACE', racePayload],
    ['creature', 'CREATURE', creaturePayload],
    ['spell', 'SPELL', spellPayload],
    ['vehicle', 'VEHICLE', vehiclePayload]
  ] as const)(
    'publishes %s through the shared mutation with the server draft timestamp',
    async (domain, subjectKind, payload) => {
      const draft = draftFor(subjectKind, payload)
      const mutation = vi
        .spyOn(client, 'mutation')
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({
          publicId: draft.publicId,
          subjectId: draft.subjectId
        })
      const session = createInitialSession(
        {
          domain,
          mode: 'create',
          data: { system: null, systems: [{ id: payload.systemId }] }
        },
        client
      )

      await session.authoredSession!.operations.activate(payload)

      expect(getFunctionName(mutation.mock.calls[0]![0])).toBe(
        getFunctionName(api.content.drafts.save)
      )
      expect(mutation.mock.calls[0]?.[1]).toEqual({
        subjectKind,
        subjectId: payload.id,
        systemId: payload.systemId,
        label: payload.label,
        payload
      })
      expect(getFunctionName(mutation.mock.calls[1]![0])).toBe(
        getFunctionName(api.content.publication.publishDraft)
      )
      expect(mutation.mock.calls[1]?.[1]).toEqual({
        subjectKind,
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
    }
  )

  it('publishes Class through its action after saving and forwards the server draft timestamp', async () => {
    const draft = draftFor('CLASS', classPayload)
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValueOnce(draft)
    const action = vi.spyOn(client, 'action').mockResolvedValue({
      publicId: draft.publicId,
      subjectId: draft.subjectId
    })
    await createAuthoredOperations('CLASS', client).activate(classPayload)
    expect(mutation).toHaveBeenCalledOnce()
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe(
      getFunctionName(api.content.drafts.save)
    )
    expect(mutation.mock.calls[0]?.[1]).toEqual({
      subjectKind: 'CLASS',
      subjectId: classPayload.id,
      systemId: classPayload.systemId,
      label: classPayload.label,
      payload: classPayload
    })
    expect(action).toHaveBeenCalledOnce()
    expect(getFunctionName(action.mock.calls[0]![0])).toBe(
      getFunctionName(api.content.classPublicationActions.publishDraft)
    )
    expect(action.mock.calls[0]?.[1]).toEqual({
      subjectKind: 'CLASS',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
  })

  it('propagates publication rejection without an extra save or unsafe retry', async () => {
    const draft = draftFor('BACKGROUND', background)
    const mutation = vi
      .spyOn(client, 'mutation')
      .mockResolvedValueOnce(draft)
      .mockRejectedValueOnce(new Error('The draft changed'))

    await expect(
      createAuthoredOperations('BACKGROUND', client).activate(background)
    ).rejects.toThrow('draft changed')
    expect(mutation).toHaveBeenCalledTimes(2)
  })

  it('uses native Spell duplicate, discard, and delete endpoints with the subject UUID', async () => {
    const mutation = vi.spyOn(client, 'mutation').mockResolvedValue(null)
    const operations = createAuthoredOperations('SPELL', client)

    await operations.duplicate(spellPayload.id)
    await operations.discardDraft(spellPayload.id)
    await operations.deleteActive(spellPayload.id)

    expect(mutation).toHaveBeenCalledTimes(3)
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe(
      getFunctionName(api.content.drafts.duplicate)
    )
    expect(mutation.mock.calls[0]?.[1]).toEqual({
      subjectKind: 'SPELL',
      subjectId: spellPayload.id
    })
    expect(getFunctionName(mutation.mock.calls[1]![0])).toBe(
      getFunctionName(api.content.drafts.discard)
    )
    expect(mutation.mock.calls[1]?.[1]).toEqual({
      subjectKind: 'SPELL',
      subjectId: spellPayload.id
    })
    expect(getFunctionName(mutation.mock.calls[2]![0])).toBe(
      getFunctionName(api.content.deletion.deleteActive)
    )
    expect(mutation.mock.calls[2]?.[1]).toEqual({
      subjectKind: 'SPELL',
      subjectId: spellPayload.id
    })
    expect(() => createAuthoredOperations('BACKGROUND').saveDraft(background)).toThrow(
      'current Convex client'
    )
  })
})
