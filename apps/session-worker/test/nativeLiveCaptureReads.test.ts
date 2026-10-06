import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectOwner } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { liveEncounterCaptures } from '../src/nativeEncounterReads.js'
import {
  readNativeLiveMaintenanceOwners,
  readNativeLiveMaintenanceSlot
} from '../src/nativeEncounterMaintenance.js'
import { readNativeLiveMovementConcentrationState } from '../src/nativeEncounterMovementConcentration.js'
import { readNativeLiveActorsAndEffects } from '../src/nativeEncounterTargets.js'
import { characterOwnerRowFor } from '../src/testing/characterPageFixture.js'
import {
  activeEffect,
  captureEnvelope,
  captureFake,
  ENCOUNTER_ID,
  encounterRunState,
  GAME_SYSTEM_ID,
  maintainedState,
  runActor,
  testUuid,
  CAMPAIGN_ID,
  USER_ID
} from '../src/testing/liveCaptureFixture.js'

const CASTER_ID = testUuid(0x10)
const TARGET_ID = testUuid(0x11)
const DEFINITION_ID = testUuid(0x20)
const STATE_ID = testUuid(0x30)
const CHARACTER_A = testUuid(0xa1)
const CHARACTER_B = testUuid(0xa2)

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

describe('readNativeLiveMaintenanceSlot', () => {
  const slot = { encounterId: ENCOUNTER_ID, actorId: CASTER_ID, definitionId: DEFINITION_ID }

  it('reads an empty slot with a single capture', async () => {
    const fake = captureFake(() => ({ kind: 'MAINTENANCE_SLOT', ...captureEnvelope, state: null }))

    await expect(
      readNativeLiveMaintenanceSlot({ ...slot, capture: fake.capture })
    ).resolves.toEqual({ state: null, dependents: [] })
    expect(fake.requests).toEqual([
      { kind: 'MAINTENANCE_SLOT', actorId: CASTER_ID, definitionId: DEFINITION_ID }
    ])
  })

  it('pages Character then Encounter-actor dependents and keeps each owner kind in cursor order', async () => {
    const fake = captureFake((request) => {
      if (request.kind === 'MAINTENANCE_SLOT')
        return { kind: 'MAINTENANCE_SLOT', ...captureEnvelope, state: slotState }
      if (request.kind !== 'MAINTENANCE_DEPENDENTS') throw new Error(`Unexpected ${request.kind}`)
      if (request.ownerKind === 'ENCOUNTER_ACTOR')
        return {
          kind: 'MAINTENANCE_DEPENDENTS',
          ...captureEnvelope,
          effects: [dependent(0x503, actorOwner)],
          continueCursor: null
        }
      return request.cursor === null
        ? {
            kind: 'MAINTENANCE_DEPENDENTS',
            ...captureEnvelope,
            effects: [dependent(0x501, characterOwner(CHARACTER_A))],
            continueCursor: 'page-2'
          }
        : {
            kind: 'MAINTENANCE_DEPENDENTS',
            ...captureEnvelope,
            effects: [dependent(0x502, characterOwner(CHARACTER_A))],
            continueCursor: null
          }
    })

    const result = await readNativeLiveMaintenanceSlot({ ...slot, capture: fake.capture })

    expect(result.dependents.map((effect) => effect.id)).toEqual([
      testUuid(0x501),
      testUuid(0x502),
      testUuid(0x503)
    ])
    expect(
      fake.requests.flatMap((request) =>
        request.kind === 'MAINTENANCE_DEPENDENTS' && request.ownerKind === 'CHARACTER'
          ? [request.cursor]
          : []
      )
    ).toEqual([null, 'page-2'])
  })

  it('refuses a dependent that belongs to another maintained state', async () => {
    const stray = activeEffect({
      id: testUuid(0x504),
      owner: actorOwner,
      createdOrdinal: 1,
      maintainedEffectStateId: testUuid(0x31)
    })
    const fake = captureFake((request) =>
      request.kind === 'MAINTENANCE_SLOT'
        ? { kind: 'MAINTENANCE_SLOT', ...captureEnvelope, state: slotState }
        : {
            kind: 'MAINTENANCE_DEPENDENTS',
            ...captureEnvelope,
            effects:
              request.kind === 'MAINTENANCE_DEPENDENTS' && request.ownerKind === 'ENCOUNTER_ACTOR'
                ? [stray]
                : [],
            continueCursor: null
          }
    )

    await expect(readNativeLiveMaintenanceSlot({ ...slot, capture: fake.capture })).rejects.toThrow(
      'Maintenance dependent identity mismatch.'
    )
  })

  it('refuses a repeated dependents cursor', async () => {
    const fake = captureFake((request) =>
      request.kind === 'MAINTENANCE_SLOT'
        ? { kind: 'MAINTENANCE_SLOT', ...captureEnvelope, state: slotState }
        : {
            kind: 'MAINTENANCE_DEPENDENTS',
            ...captureEnvelope,
            effects: [],
            continueCursor: 'loop'
          }
    )

    await expect(readNativeLiveMaintenanceSlot({ ...slot, capture: fake.capture })).rejects.toThrow(
      'Maintenance capture cursor repeated.'
    )
  })

  it('refuses a slot state owned by another actor', async () => {
    const foreign = maintainedState({
      id: STATE_ID,
      ownerActorId: TARGET_ID,
      definitionId: DEFINITION_ID
    })
    const fake = captureFake(() => ({
      kind: 'MAINTENANCE_SLOT',
      ...captureEnvelope,
      state: foreign
    }))

    await expect(readNativeLiveMaintenanceSlot({ ...slot, capture: fake.capture })).rejects.toThrow(
      'Maintenance slot identity mismatch.'
    )
  })
})

describe('readNativeLiveMaintenanceOwners', () => {
  const base = {
    gameSystemId: GAME_SYSTEM_ID,
    slot: { actorId: CASTER_ID, definitionId: DEFINITION_ID, stateId: STATE_ID }
  }

  it('reads an Encounter-actor owner from the captured Run effects without paging its effects', async () => {
    const removed = dependent(0x601, actorOwner)
    const kept = activeEffect({ id: testUuid(0x602), owner: actorOwner, createdOrdinal: 9 })
    const fake = captureFake((request) => {
      if (request.kind !== 'MAINTENANCE_OWNER') throw new Error(`Unexpected ${request.kind}`)
      return {
        kind: 'MAINTENANCE_OWNER',
        ...captureEnvelope,
        owner: request.owner,
        character: null
      }
    })

    const result = await readNativeLiveMaintenanceOwners({
      ...base,
      actors: [runActor({ id: TARGET_ID })],
      activeEffectsByActorId: new Map([[TARGET_ID, [removed, kept]]]),
      removed: [removed],
      capture: fake.capture
    })

    expect(result.owners).toEqual([
      { owner: actorOwner, effects: [removed, kept], character: null }
    ])
    expect(result.characterVersions).toEqual([])
    expect(fake.requests.map((request) => request.kind)).toEqual(['MAINTENANCE_OWNER'])
  })

  it('captures a Character owner that is not the mover, pages its effects and orders them by creation', async () => {
    const owner = characterOwner(CHARACTER_A)
    const row = characterOwnerRowFor({ characterId: CHARACTER_A })
    // Ids ascend by page while creation order runs the other way.
    const pageOne = [0x701, 0x702, 0x703, 0x704].map((id) =>
      activeEffect({ id: testUuid(id), owner, createdOrdinal: 0x705 - id + 1 })
    )
    const pageTwo = [activeEffect({ id: testUuid(0x705), owner, createdOrdinal: 1 })]
    const fake = captureFake((request) => {
      if (request.kind === 'MAINTENANCE_OWNER')
        return { kind: 'MAINTENANCE_OWNER', ...captureEnvelope, owner, character: row }
      if (request.kind !== 'MAINTENANCE_OWNER_EFFECTS')
        throw new Error(`Unexpected ${request.kind}`)
      return request.afterEffectId === null
        ? {
            kind: 'MAINTENANCE_OWNER_EFFECTS',
            ...captureEnvelope,
            owner,
            effects: pageOne,
            continueAfter: testUuid(0x704)
          }
        : {
            kind: 'MAINTENANCE_OWNER_EFFECTS',
            ...captureEnvelope,
            owner,
            effects: pageTwo,
            continueAfter: null
          }
    })

    const result = await readNativeLiveMaintenanceOwners({
      ...base,
      actors: [runActor({ id: CASTER_ID, characterId: CHARACTER_B })],
      activeEffectsByActorId: new Map(),
      removed: [dependent(0x601, owner)],
      capture: fake.capture
    })

    expect(result.owners[0]?.effects.map((effect) => effect.id)).toEqual([
      testUuid(0x705),
      testUuid(0x704),
      testUuid(0x703),
      testUuid(0x702),
      testUuid(0x701)
    ])
    expect(result.owners[0]?.character).toEqual(row)
    expect(result.characterVersions).toEqual([
      { characterId: CHARACTER_A, beforeStreamVersion: row.play.streamVersion }
    ])
    expect(
      fake.requests.map((request) =>
        request.kind === 'MAINTENANCE_OWNER_EFFECTS'
          ? [request.kind, request.afterEffectId]
          : [request.kind]
      )
    ).toEqual([
      ['MAINTENANCE_OWNER'],
      ['MAINTENANCE_OWNER_EFFECTS', null],
      ['MAINTENANCE_OWNER_EFFECTS', testUuid(0x704)]
    ])
  })

  it('serves a projected Character owner without any capture', async () => {
    const owner = characterOwner(CHARACTER_A)
    const row = characterOwnerRowFor({ characterId: CHARACTER_A })
    const effect = dependent(0x601, owner)
    const fake = captureFake(() => {
      throw new Error('A projected owner needs no capture.')
    })

    const result = await readNativeLiveMaintenanceOwners({
      ...base,
      actors: [],
      activeEffectsByActorId: new Map(),
      removed: [effect],
      capture: fake.capture,
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
    expect(fake.requests).toEqual([])
  })

  it('sorts Character versions by Character while keeping owners in removal order', async () => {
    const rowA = characterOwnerRowFor({ characterId: CHARACTER_A })
    const rowB = characterOwnerRowFor({ characterId: CHARACTER_B })
    const rows = new Map([
      [CHARACTER_A, { ...rowA, play: { ...rowA.play, streamVersion: 3 } }],
      [CHARACTER_B, { ...rowB, play: { ...rowB.play, streamVersion: 9 } }]
    ])
    const fake = captureFake((request) => {
      if (request.kind === 'MAINTENANCE_OWNER')
        return {
          kind: 'MAINTENANCE_OWNER',
          ...captureEnvelope,
          owner: request.owner,
          character:
            request.owner.kind === 'CHARACTER'
              ? (rows.get(request.owner.characterId) ?? null)
              : null
        }
      if (request.kind !== 'MAINTENANCE_OWNER_EFFECTS')
        throw new Error(`Unexpected ${request.kind}`)
      return {
        kind: 'MAINTENANCE_OWNER_EFFECTS',
        ...captureEnvelope,
        owner: request.owner,
        effects: [],
        continueAfter: null
      }
    })

    const result = await readNativeLiveMaintenanceOwners({
      ...base,
      actors: [],
      activeEffectsByActorId: new Map(),
      removed: [
        dependent(0x601, characterOwner(CHARACTER_B)),
        dependent(0x602, characterOwner(CHARACTER_A))
      ],
      capture: fake.capture
    })

    expect(result.owners.map((entry) => entry.owner)).toEqual([
      characterOwner(CHARACTER_B),
      characterOwner(CHARACTER_A)
    ])
    expect(result.characterVersions).toEqual([
      { characterId: CHARACTER_A, beforeStreamVersion: 3 },
      { characterId: CHARACTER_B, beforeStreamVersion: 9 }
    ])
  })

  it('refuses a Character owner that is missing or belongs to another System', async () => {
    const owner = characterOwner(CHARACTER_A)
    const row = characterOwnerRowFor({ characterId: CHARACTER_A })
    for (const character of [null, { ...row, systemId: testUuid(0x99) }]) {
      const fake = captureFake((request) =>
        request.kind === 'MAINTENANCE_OWNER'
          ? { kind: 'MAINTENANCE_OWNER', ...captureEnvelope, owner, character }
          : {
              kind: 'MAINTENANCE_OWNER_EFFECTS',
              ...captureEnvelope,
              owner,
              effects: [],
              continueAfter: null
            }
      )

      await expect(
        readNativeLiveMaintenanceOwners({
          ...base,
          actors: [],
          activeEffectsByActorId: new Map(),
          removed: [dependent(0x601, owner)],
          capture: fake.capture
        })
      ).rejects.toThrow('Maintained-effect Character owner is unavailable.')
    }
  })

  it('refuses an owner capture answering for another owner', async () => {
    const fake = captureFake(() => ({
      kind: 'MAINTENANCE_OWNER',
      ...captureEnvelope,
      owner: characterOwner(CHARACTER_B),
      character: null
    }))

    await expect(
      readNativeLiveMaintenanceOwners({
        ...base,
        actors: [],
        activeEffectsByActorId: new Map(),
        removed: [dependent(0x601, actorOwner)],
        capture: fake.capture
      })
    ).rejects.toThrow('Maintenance owner identity mismatch.')
  })

  it('refuses an owner effect cursor that does not end at the page boundary', async () => {
    const owner = characterOwner(CHARACTER_A)
    const row = characterOwnerRowFor({ characterId: CHARACTER_A })
    const page = [0x701, 0x702, 0x703, 0x704].map((id) =>
      activeEffect({ id: testUuid(id), owner, createdOrdinal: id })
    )
    const fake = captureFake((request) =>
      request.kind === 'MAINTENANCE_OWNER'
        ? { kind: 'MAINTENANCE_OWNER', ...captureEnvelope, owner, character: row }
        : {
            kind: 'MAINTENANCE_OWNER_EFFECTS',
            ...captureEnvelope,
            owner,
            effects: page,
            continueAfter: testUuid(0x703)
          }
    )

    await expect(
      readNativeLiveMaintenanceOwners({
        ...base,
        actors: [],
        activeEffectsByActorId: new Map(),
        removed: [dependent(0x601, owner)],
        capture: fake.capture
      })
    ).rejects.toThrow('Maintenance owner effect cursor mismatch.')
  })
})

describe('readNativeLiveMovementConcentrationState', () => {
  const state = encounterRunState({ actors: [runActor({ id: CASTER_ID })] })
  const concentrationState = maintainedState({
    id: STATE_ID,
    ownerActorId: CASTER_ID,
    definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  })
  const slotKey = `${CASTER_ID}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`
  const read = (
    fake: ReturnType<typeof captureFake>,
    projection?: Parameters<typeof readNativeLiveMovementConcentrationState>[0]['projection']
  ) =>
    readNativeLiveMovementConcentrationState({
      state,
      targetActorId: CASTER_ID,
      targets: new Map(),
      projection,
      capture: fake.capture
    })

  it('reads the stored Concentration slot when no contact has projected one', async () => {
    const fake = captureFake(() => ({ kind: 'MAINTENANCE_SLOT', ...captureEnvelope, state: null }))

    await expect(read(fake)).resolves.toBeNull()
    expect(fake.requests).toEqual([
      {
        kind: 'MAINTENANCE_SLOT',
        actorId: CASTER_ID,
        definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      }
    ])
  })

  it('prefers the slot an earlier contact projected over the stored one', async () => {
    const fake = captureFake(() => ({ kind: 'DEFINITION', ...captureEnvelope, definition: null }))

    await expect(
      read(fake, {
        slots: new Map([[slotKey, { state: null, dependents: [] }]]),
        owners: new Map()
      })
    ).resolves.toBeNull()
    expect(fake.requests).toEqual([])

    await expect(
      read(fake, {
        slots: new Map([[slotKey, { state: concentrationState, dependents: [] }]]),
        owners: new Map()
      })
    ).rejects.toThrow('The concentration maintenance definition is stale.')
    expect(fake.requests).toEqual([
      { kind: 'DEFINITION', definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
    ])
  })

  it('refuses a stored slot owned by another actor before reading its definition', async () => {
    const foreign = maintainedState({
      id: STATE_ID,
      ownerActorId: TARGET_ID,
      definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    })
    const fake = captureFake(() => ({
      kind: 'MAINTENANCE_SLOT',
      ...captureEnvelope,
      state: foreign
    }))

    await expect(read(fake)).rejects.toThrow(
      'The concentration state does not match its Encounter owner.'
    )
    expect(fake.requests.map((request) => request.kind)).toEqual(['MAINTENANCE_SLOT'])
  })

  it('refuses a slot capture answered with another kind', async () => {
    const fake = captureFake(() => ({ kind: 'DEFINITION', ...captureEnvelope, definition: null }))

    await expect(read(fake)).rejects.toThrow('Movement Concentration slot is unavailable.')
  })
})

describe('liveEncounterCaptures', () => {
  const initial: LiveSessionEncounterRulesInput = {
    campaignId: CAMPAIGN_ID,
    authorityEpoch: testUuid(0xe007),
    expectedUserId: USER_ID,
    expectedRole: 'OWNER',
    encounterId: ENCOUNTER_ID,
    expectedVersion: 7,
    request: { kind: 'INPUTS' }
  }

  it('shares one read between identical requests and records dependencies in request order', async () => {
    const fake = captureFake(() => ({ kind: 'DEFINITION', ...captureEnvelope, definition: null }))
    const captures = liveEncounterCaptures(initial, fake.reads)

    await Promise.all([
      captures.capture({ kind: 'DEFINITION', definitionId: DEFINITION_ID }),
      captures.capture({ kind: 'DEFINITION', definitionId: testUuid(0x21) }),
      captures.capture({ kind: 'DEFINITION', definitionId: DEFINITION_ID })
    ])

    expect(fake.requests).toHaveLength(2)
    expect(captures.dependencies).toEqual([
      { request: { kind: 'DEFINITION', definitionId: DEFINITION_ID } },
      { request: { kind: 'DEFINITION', definitionId: testUuid(0x21) } }
    ])
  })

  it('refuses a response that answers another request kind', async () => {
    const fake = captureFake(() => ({ kind: 'DEFINITION', ...captureEnvelope, definition: null }))
    const captures = liveEncounterCaptures(initial, fake.reads)

    await expect(captures.capture({ kind: 'ACTOR', actorId: CASTER_ID })).rejects.toThrow(
      'Encounter capture kind mismatch.'
    )
  })
})

describe('readNativeLiveActorsAndEffects', () => {
  const sortedFirst = testUuid(0x41)
  const sortedLast = testUuid(0x42)

  it('returns actors by id and merges a paged effect list by creation order', async () => {
    const state = encounterRunState({
      actors: [runActor({ id: sortedLast }), runActor({ id: sortedFirst })]
    })
    const owner = (actorId: string): ActiveRuleEffectOwner => ({
      kind: 'ENCOUNTER_ACTOR',
      encounterId: ENCOUNTER_ID,
      targetActorId: actorId
    })
    const firstPage = [0x801, 0x802, 0x803, 0x804].map((id) =>
      activeEffect({ id: testUuid(id), owner: owner(sortedFirst), createdOrdinal: 0x805 - id + 1 })
    )
    const lastPage = activeEffect({
      id: testUuid(0x805),
      owner: owner(sortedFirst),
      createdOrdinal: 1
    })
    const fake = captureFake((request) => {
      if (request.kind === 'ACTOR')
        return {
          kind: 'ACTOR',
          ...captureEnvelope,
          actor: runActor({ id: request.actorId }),
          effects: request.actorId === sortedFirst ? firstPage : [],
          continueAfter: request.actorId === sortedFirst ? testUuid(0x804) : null
        }
      if (request.kind !== 'EFFECTS') throw new Error(`Unexpected ${request.kind}`)
      return {
        kind: 'EFFECTS',
        ...captureEnvelope,
        actorId: request.actorId,
        effects: [lastPage],
        continueAfter: null
      }
    })

    const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
      state,
      capture: fake.capture
    })

    expect(actors.map((actor) => actor.id)).toEqual([sortedFirst, sortedLast])
    expect(activeEffectsByActorId.get(sortedFirst)?.map((effect) => effect.id)).toEqual([
      testUuid(0x805),
      testUuid(0x804),
      testUuid(0x803),
      testUuid(0x802),
      testUuid(0x801)
    ])
    expect(activeEffectsByActorId.get(sortedLast)).toEqual([])
    expect(fake.requests).toContainEqual({
      kind: 'EFFECTS',
      actorId: sortedFirst,
      afterEffectId: testUuid(0x804)
    })
  })

  it('refuses an actor capture answering for another actor', async () => {
    const state = encounterRunState({ actors: [runActor({ id: sortedFirst })] })
    const fake = captureFake(() => ({
      kind: 'ACTOR',
      ...captureEnvelope,
      actor: runActor({ id: sortedLast }),
      effects: [],
      continueAfter: null
    }))

    await expect(readNativeLiveActorsAndEffects({ state, capture: fake.capture })).rejects.toThrow(
      'Encounter actor binding mismatch.'
    )
  })

  it('refuses two actors that read the same Character', async () => {
    const state = encounterRunState({
      actors: [
        runActor({ id: sortedFirst, characterId: CHARACTER_A }),
        runActor({ id: sortedLast, characterId: CHARACTER_A })
      ]
    })
    const fake = captureFake((request) => ({
      kind: 'ACTOR',
      ...captureEnvelope,
      actor: runActor({
        id: request.kind === 'ACTOR' ? request.actorId : sortedFirst,
        characterId: CHARACTER_A
      }),
      effects: [],
      continueAfter: null
    }))

    await expect(readNativeLiveActorsAndEffects({ state, capture: fake.capture })).rejects.toThrow(
      'Encounter Character source binding mismatch.'
    )
  })
})
