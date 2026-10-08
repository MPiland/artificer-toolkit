import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectOwner } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import {
  ROOM_EPOCH,
  storedEffectDocument,
  storedMaintainedStateDocument,
  withRoomCapture,
  type RoomCapture
} from '../test/roomCaptureFixture.js'
import { liveEncounterCaptures } from './nativeEncounterReads.js'
import {
  readNativeLiveMaintenanceOwners,
  readNativeLiveMaintenanceSlot
} from './nativeEncounterMaintenance.js'
import { readNativeLiveMovementConcentrationState } from './nativeEncounterMovementConcentration.js'
import { readNativeLiveActorsAndEffects } from './nativeEncounterTargets.js'
import {
  activeEffect as authoredEffect,
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  encounterRunState,
  GAME_SYSTEM_ID,
  maintainedState,
  runActor,
  testUuid,
  USER_ID
} from './testing/liveCaptureFixture.js'
import { srdRoomCharacter } from './testing/srdRoomCharacter.js'

/**
 * The planners' capture reads over the REAL room capture: the answers come from a room store holding
 * the Run, its effects and its SRD Characters, not from canned responses. Malformed answers no
 * real room produces stay in test/nativeLiveCaptureReads.test.ts.
 */

const CASTER_ID = testUuid(0x10)
const TARGET_ID = testUuid(0x11)
const DEFINITION_ID = testUuid(0x20)
const STATE_ID = testUuid(0x30)
const CHARACTER_A = testUuid(0xa1)
const CHARACTER_B = testUuid(0xa2)

const srdCharacter = (characterId: string, userId: string) =>
  srdRoomCharacter({ characterId, userId, campaignId: CAMPAIGN_ID })

/** A Run-lifetime effect: the lifetime a stored maintained dependent has, which its source Encounter indexes. */
const activeEffect = (input: Omit<Parameters<typeof authoredEffect>[0], 'lifetimeScope'>) =>
  authoredEffect({ ...input, lifetimeScope: 'ENCOUNTER' })

const characterOwner = (characterId: string): ActiveRuleEffectOwner => ({
  kind: 'CHARACTER',
  characterId
})
const actorOwner: ActiveRuleEffectOwner = {
  kind: 'ENCOUNTER_ACTOR',
  encounterId: ENCOUNTER_ID,
  targetActorId: TARGET_ID
}
const dependent = (id: number, owner: ActiveRuleEffectOwner, createdOrdinal = id) =>
  activeEffect({ id: testUuid(id), owner, createdOrdinal, maintainedEffectStateId: STATE_ID })

const slotState = maintainedState({
  id: STATE_ID,
  ownerActorId: CASTER_ID,
  definitionId: DEFINITION_ID
})
const slotDocument = storedMaintainedStateDocument(slotState)

const actors = [runActor({ id: CASTER_ID }), runActor({ id: TARGET_ID })]
const state = encounterRunState({ actors })

/** The stored row identity (a cursor) of the effect with `id`. */
const rowId = (room: RoomCapture, id: string) => {
  const row = room.store
    .documents('characterActiveRuleEffects')
    .find((candidate) => candidate.id === id)
  if (!row) throw new Error(`The stored effect ${id} is missing.`)
  return row._id
}

describe('readNativeLiveMaintenanceSlot over the real room', () => {
  const slot = { encounterId: ENCOUNTER_ID, actorId: CASTER_ID, definitionId: DEFINITION_ID }

  it('reads an empty slot with a single capture', async () => {
    await withRoomCapture({ state, actors }, async (room) => {
      await expect(
        readNativeLiveMaintenanceSlot({ ...slot, capture: room.capture })
      ).resolves.toEqual({ state: null, dependents: [] })
      expect(room.requests).toEqual([
        { kind: 'MAINTENANCE_SLOT', actorId: CASTER_ID, definitionId: DEFINITION_ID }
      ])
    })
  })

  it('pages Character then Encounter-actor dependents and keeps each owner kind in cursor order', async () => {
    const characterDependents = [0x501, 0x502, 0x503, 0x504, 0x505].map((id) =>
      dependent(id, characterOwner(CHARACTER_A))
    )
    await withRoomCapture(
      {
        state,
        actors,
        characters: [srdCharacter(CHARACTER_A, testUuid(0xb1))],
        maintenanceCharacterOwners: [{ maintainedStateId: STATE_ID, characterId: CHARACTER_A }],
        documents: [
          slotDocument,
          ...[...characterDependents, dependent(0x5a1, actorOwner)].map(storedEffectDocument)
        ]
      },
      async (room) => {
        const result = await readNativeLiveMaintenanceSlot({ ...slot, capture: room.capture })

        expect(result.dependents.map((effect) => effect.id)).toEqual([
          ...characterDependents.map((effect) => effect.id),
          testUuid(0x5a1)
        ])
        expect(
          room.requests.flatMap((request) =>
            request.kind === 'MAINTENANCE_DEPENDENTS' && request.ownerKind === 'CHARACTER'
              ? [request.cursor]
              : []
          )
        ).toEqual([null, rowId(room, testUuid(0x504))])
      }
    )
  })
})

describe('readNativeLiveMaintenanceOwners over the real room', () => {
  const base = {
    gameSystemId: GAME_SYSTEM_ID,
    slot: { actorId: CASTER_ID, definitionId: DEFINITION_ID, stateId: STATE_ID }
  }

  it('reads an Encounter-actor owner from the captured Run effects without paging its effects', async () => {
    const removed = dependent(0x601, actorOwner)
    const kept = activeEffect({ id: testUuid(0x602), owner: actorOwner, createdOrdinal: 9 })
    await withRoomCapture(
      {
        state,
        actors,
        documents: [slotDocument, ...[removed, kept].map(storedEffectDocument)]
      },
      async (room) => {
        const result = await readNativeLiveMaintenanceOwners({
          ...base,
          actors: [runActor({ id: TARGET_ID })],
          activeEffectsByActorId: new Map([[TARGET_ID, [removed, kept]]]),
          removed: [removed],
          capture: room.capture
        })

        expect(result.owners).toEqual([
          { owner: actorOwner, effects: [removed, kept], character: null }
        ])
        expect(result.characterVersions).toEqual([])
        expect(room.requests.map((request) => request.kind)).toEqual(['MAINTENANCE_OWNER'])
      }
    )
  })

  it('captures a Character owner that is not the mover, pages its effects and orders them by creation', async () => {
    const character = srdCharacter(CHARACTER_A, testUuid(0xb1))
    const owner = characterOwner(CHARACTER_A)
    // Ids ascend by page while creation order runs the other way.
    const effects = [0x701, 0x702, 0x703, 0x704, 0x705].map((id) =>
      activeEffect({
        id: testUuid(id),
        owner,
        createdOrdinal: 0x705 - id + 1,
        maintainedEffectStateId: id === 0x701 ? STATE_ID : undefined
      })
    )
    await withRoomCapture(
      {
        state,
        actors,
        characters: [character],
        documents: [slotDocument, ...effects.map(storedEffectDocument)]
      },
      async (room) => {
        const result = await readNativeLiveMaintenanceOwners({
          ...base,
          actors: [runActor({ id: CASTER_ID, characterId: CHARACTER_B })],
          activeEffectsByActorId: new Map(),
          removed: [effects[0]!],
          capture: room.capture
        })

        expect(result.owners[0]?.effects.map((effect) => effect.id)).toEqual([
          testUuid(0x705),
          testUuid(0x704),
          testUuid(0x703),
          testUuid(0x702),
          testUuid(0x701)
        ])
        const row = room.characterRows.get(CHARACTER_A)!
        const stored = room.store.documents('characters').find(({ id }) => id === CHARACTER_A)
        // The head holds no aggregate hashes; the held capture carries the assembled ones.
        expect(stored).toBeDefined()
        expect(stored).not.toHaveProperty('checksum')
        expect(stored).not.toHaveProperty('sheetStateChecksum')
        expect(result.owners[0]?.character).toEqual(row)
        expect(result.characterVersions).toEqual([
          { characterId: CHARACTER_A, beforeStreamVersion: row.play.streamVersion }
        ])
        expect(
          room.requests.map((request) =>
            request.kind === 'MAINTENANCE_OWNER_EFFECTS'
              ? [request.kind, request.afterEffectId]
              : [request.kind]
          )
        ).toEqual([
          ['MAINTENANCE_OWNER'],
          ['MAINTENANCE_OWNER_EFFECTS', null],
          ['MAINTENANCE_OWNER_EFFECTS', testUuid(0x704)]
        ])
      }
    )
  })

  it('serves a projected Character owner without any capture', async () => {
    const character = srdCharacter(CHARACTER_A, testUuid(0xb1))
    const owner = characterOwner(CHARACTER_A)
    const row = character.part.inputs!.owner
    const effect = dependent(0x601, owner)
    await withRoomCapture({ state, actors, characters: [character] }, async (room) => {
      const result = await readNativeLiveMaintenanceOwners({
        ...base,
        actors: [],
        activeEffectsByActorId: new Map(),
        removed: [effect],
        capture: room.capture,
        projection: {
          slots: new Map(),
          owners: new Map([
            [checksumCanonicalJson(owner), { owner, effects: [effect], character: row }]
          ])
        }
      })

      expect(result.owners).toEqual([{ owner, effects: [effect], character: row }])
      expect(result.characterVersions).toEqual([
        { characterId: CHARACTER_A, beforeStreamVersion: row.play.streamVersion }
      ])
      expect(room.requests).toEqual([])
    })
  })

  it('sorts Character versions by Character while keeping owners in removal order', async () => {
    const characterA = srdCharacter(CHARACTER_A, testUuid(0xb1))
    const characterB = srdCharacter(CHARACTER_B, testUuid(0xb2))
    const withStreamVersion = (
      character: ReturnType<typeof srdCharacter>,
      streamVersion: number
    ) => {
      const owner = character.part.inputs!.owner
      return { ...owner, play: { ...owner.play, streamVersion } }
    }
    await withRoomCapture(
      {
        state,
        actors,
        characters: [characterA, characterB],
        characterOwners: new Map([
          [CHARACTER_A, withStreamVersion(characterA, 3)],
          [CHARACTER_B, withStreamVersion(characterB, 9)]
        ]),
        documents: [
          slotDocument,
          ...[
            dependent(0x601, characterOwner(CHARACTER_B)),
            dependent(0x602, characterOwner(CHARACTER_A))
          ].map(storedEffectDocument)
        ]
      },
      async (room) => {
        const result = await readNativeLiveMaintenanceOwners({
          ...base,
          actors: [],
          activeEffectsByActorId: new Map(),
          removed: [
            dependent(0x601, characterOwner(CHARACTER_B)),
            dependent(0x602, characterOwner(CHARACTER_A))
          ],
          capture: room.capture
        })

        expect(result.owners.map((entry) => entry.owner)).toEqual([
          characterOwner(CHARACTER_B),
          characterOwner(CHARACTER_A)
        ])
        expect(result.characterVersions).toEqual([
          { characterId: CHARACTER_A, beforeStreamVersion: 3 },
          { characterId: CHARACTER_B, beforeStreamVersion: 9 }
        ])
      }
    )
  })
})

describe('readNativeLiveMovementConcentrationState over the real room', () => {
  const concentrationState = maintainedState({
    id: STATE_ID,
    ownerActorId: CASTER_ID,
    definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  })
  const slotKey = `${CASTER_ID}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`
  const casterActors = [runActor({ id: CASTER_ID })]
  const casterState = encounterRunState({ actors: casterActors })
  const read = (
    room: RoomCapture,
    projection?: Parameters<typeof readNativeLiveMovementConcentrationState>[0]['projection']
  ) =>
    readNativeLiveMovementConcentrationState({
      state: casterState,
      targetActorId: CASTER_ID,
      targets: new Map(),
      projection,
      capture: room.capture
    })

  it('reads the stored Concentration slot when no contact has projected one', async () => {
    await withRoomCapture({ state: casterState, actors: casterActors }, async (room) => {
      await expect(read(room)).resolves.toBeNull()
      expect(room.requests).toEqual([
        {
          kind: 'MAINTENANCE_SLOT',
          actorId: CASTER_ID,
          definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        }
      ])
    })
  })

  it('prefers the slot an earlier contact projected over the stored one', async () => {
    await withRoomCapture({ state: casterState, actors: casterActors }, async (room) => {
      await expect(
        read(room, {
          slots: new Map([[slotKey, { state: null, dependents: [] }]]),
          owners: new Map()
        })
      ).resolves.toBeNull()
      expect(room.requests).toEqual([])

      // The room holds no published Concentration definition, so its real DEFINITION read answers none.
      await expect(
        read(room, {
          slots: new Map([[slotKey, { state: concentrationState, dependents: [] }]]),
          owners: new Map()
        })
      ).rejects.toThrow('The concentration maintenance definition is stale.')
      expect(room.requests).toEqual([
        { kind: 'DEFINITION', definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
      ])
    })
  })
})

describe('liveEncounterCaptures over the real room', () => {
  const initial: LiveSessionEncounterRulesInput = {
    campaignId: CAMPAIGN_ID,
    authorityEpoch: ROOM_EPOCH,
    expectedUserId: USER_ID,
    expectedRole: 'OWNER',
    encounterId: ENCOUNTER_ID,
    expectedVersion: state.version,
    request: { kind: 'INPUTS' }
  }

  it('shares one read between identical requests and records dependencies in request order', async () => {
    await withRoomCapture({ state, actors }, async (room) => {
      const captures = liveEncounterCaptures(initial, room.reads)

      await Promise.all([
        captures.capture({ kind: 'DEFINITION', definitionId: DEFINITION_ID }),
        captures.capture({ kind: 'DEFINITION', definitionId: testUuid(0x21) }),
        captures.capture({ kind: 'DEFINITION', definitionId: DEFINITION_ID })
      ])

      expect(room.requests).toHaveLength(2)
      expect(captures.dependencies).toEqual([
        { request: { kind: 'DEFINITION', definitionId: DEFINITION_ID } },
        { request: { kind: 'DEFINITION', definitionId: testUuid(0x21) } }
      ])
    })
  })
})

describe('readNativeLiveActorsAndEffects over the real room', () => {
  const sortedFirst = testUuid(0x41)
  const sortedLast = testUuid(0x42)

  it('returns actors by id and merges a paged effect list by creation order', async () => {
    const roomActors = [runActor({ id: sortedLast }), runActor({ id: sortedFirst })]
    const roomState = encounterRunState({ actors: roomActors })
    const owner: ActiveRuleEffectOwner = {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: ENCOUNTER_ID,
      targetActorId: sortedFirst
    }
    // Ids ascend by page while creation order runs the other way.
    const effects = [0x801, 0x802, 0x803, 0x804, 0x805].map((id) =>
      activeEffect({ id: testUuid(id), owner, createdOrdinal: 0x805 - id + 1 })
    )
    await withRoomCapture(
      { state: roomState, actors: roomActors, documents: effects.map(storedEffectDocument) },
      async (room) => {
        const { actors: read, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
          state: roomState,
          capture: room.capture
        })

        expect(read.map((actor) => actor.id)).toEqual([sortedFirst, sortedLast])
        expect(activeEffectsByActorId.get(sortedFirst)?.map((effect) => effect.id)).toEqual([
          testUuid(0x805),
          testUuid(0x804),
          testUuid(0x803),
          testUuid(0x802),
          testUuid(0x801)
        ])
        expect(activeEffectsByActorId.get(sortedLast)).toEqual([])
        expect(room.requests).toContainEqual({
          kind: 'EFFECTS',
          actorId: sortedFirst,
          afterEffectId: testUuid(0x804)
        })
      }
    )
  })
})
