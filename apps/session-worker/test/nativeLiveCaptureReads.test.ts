import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectOwner } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'

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

  it('refuses a dependent that belongs to another maintained state', async () => {
    const stray = activeEffect({
      id: testUuid(0x504),
      owner: actorOwner,
      createdOrdinal: 1,
      maintainedEffectStateId: testUuid(0x31)
    })
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
    const fake = captureFake((request) =>
      request.kind === 'MAINTENANCE_SLOT'
        ? { kind: 'MAINTENANCE_SLOT', ...captureEnvelope, state: slotState, zoneIds: [] }
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
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
    const fake = captureFake((request) =>
      request.kind === 'MAINTENANCE_SLOT'
        ? { kind: 'MAINTENANCE_SLOT', ...captureEnvelope, state: slotState, zoneIds: [] }
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
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
    const fake = captureFake(() => ({
      kind: 'MAINTENANCE_SLOT',
      ...captureEnvelope,
      state: foreign,
      zoneIds: []
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

  it('refuses a Character owner that is missing or belongs to another System', async () => {
    const owner = characterOwner(CHARACTER_A)
    const row = characterOwnerRowFor({ characterId: CHARACTER_A })
    for (const character of [null, { ...row, systemId: testUuid(0x99) }]) {
      // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
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
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
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
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
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
  const read = (fake: ReturnType<typeof captureFake>) =>
    readNativeLiveMovementConcentrationState({
      state,
      targetActorId: CASTER_ID,
      targets: new Map(),
      capture: fake.capture
    })

  it('refuses a stored slot owned by another actor before reading its definition', async () => {
    const foreign = maintainedState({
      id: STATE_ID,
      ownerActorId: TARGET_ID,
      definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    })
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
    const fake = captureFake(() => ({
      kind: 'MAINTENANCE_SLOT',
      ...captureEnvelope,
      state: foreign,
      zoneIds: []
    }))

    await expect(read(fake)).rejects.toThrow(
      'The concentration state does not match its Encounter owner.'
    )
    expect(fake.requests.map((request) => request.kind)).toEqual(['MAINTENANCE_SLOT'])
  })

  it('refuses a slot capture answered with another kind', async () => {
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
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

  it('refuses a response that answers another request kind', async () => {
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
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

  it('refuses an actor capture answering for another actor', async () => {
    const state = encounterRunState({ actors: [runActor({ id: sortedFirst })] })
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
    const fake = captureFake(() => ({
      kind: 'ACTOR',
      ...captureEnvelope,
      actor: runActor({ id: sortedLast }),
      characterDead: false,
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
    // Fake: the test pins how the reader handles this capture response, which the real producer never emits.
    const fake = captureFake((request) => ({
      kind: 'ACTOR',
      ...captureEnvelope,
      actor: runActor({
        id: request.kind === 'ACTOR' ? request.actorId : sortedFirst,
        characterId: CHARACTER_A
      }),
      characterDead: false,
      effects: [],
      continueAfter: null
    }))

    await expect(readNativeLiveActorsAndEffects({ state, capture: fake.capture })).rejects.toThrow(
      'Encounter Character source binding mismatch.'
    )
  })
})
