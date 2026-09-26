import { beforeAll, describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'

import { isTurnEffectEligible, turnEffectRetainedConditions } from '../encounterTurnEffectState.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  ENCOUNTER_ID,
  encounterRun,
  frozenRulesRuntime,
  goblinActor,
  OCCURRED_AT,
  SIDE_ID,
  testUuid,
  turnSaveDamageEffect,
  type TurnSaveDamageEffectInput
} from './encounterActiveEffectFixtures.js'

const GOBLIN_ID = testUuid(0x101)
const CHARACTER_ACTOR_ID = testUuid(0x102)
const CHARACTER_ID = testUuid(0x103)
// Contribution order is deliberately the reverse of the sorted output.
const CONDITION_C = testUuid(0xc3)
const CONDITION_B = testUuid(0xc2)
const CONDITION_A = testUuid(0xc1)

const goblin = goblinActor(GOBLIN_ID)
const characterActor = encounterRunActorStateSchema.parse({
  id: CHARACTER_ACTOR_ID,
  encounterId: ENCOUNTER_ID,
  kind: 'CHARACTER',
  label: 'Ranger',
  sourceId: CHARACTER_ID,
  public: true,
  controllerUserIds: [],
  disposition: 'FRIENDLY',
  initiative: 14,
  manualOrder: null,
  healthDisplay: null,
  systemId: null,
  stableTieKey: CHARACTER_ACTOR_ID,
  resources: {},
  gmNotes: null,
  sideId: SIDE_ID,
  snapshot: {},
  createdAt: OCCURRED_AT,
  updatedAt: OCCURRED_AT
})

let runtime: RulesRuntimeService
beforeAll(async () => {
  runtime = await frozenRulesRuntime()
})

function effect(seed: number, input: Partial<TurnSaveDamageEffectInput> = {}) {
  return turnSaveDamageEffect({
    runtime,
    seed,
    target: goblin,
    damage: 1,
    saveDc: 30,
    ticks: 3,
    ...input
  })
}

describe('turnEffectRetainedConditions', () => {
  it('retains baseline-present conditions only, sorted, ignoring the effect itself as an owner', async () => {
    const owner = await effect(1, {
      conditionOwnership: [
        { conditionId: CONDITION_C, baselinePresent: true },
        { conditionId: CONDITION_B, baselinePresent: false },
        { conditionId: CONDITION_A, baselinePresent: true }
      ]
    })

    expect(turnEffectRetainedConditions(owner, [owner], new Set())).toEqual([
      CONDITION_A,
      CONDITION_C
    ])
  })

  it('retains a condition another live effect also owns, but not one only an expired effect owns', async () => {
    const owner = await effect(1, {
      conditionOwnership: [
        { conditionId: CONDITION_C, baselinePresent: false },
        { conditionId: CONDITION_A, baselinePresent: false }
      ]
    })
    const liveOther = await effect(2, {
      conditionOwnership: [{ conditionId: CONDITION_C, baselinePresent: false }]
    })
    const expiredOther = await effect(3, {
      conditionOwnership: [{ conditionId: CONDITION_A, baselinePresent: false }]
    })
    const effects = [owner, liveOther, expiredOther]

    expect(turnEffectRetainedConditions(owner, effects, new Set([expiredOther.id]))).toEqual([
      CONDITION_C
    ])
    expect(turnEffectRetainedConditions(owner, effects, new Set())).toEqual([
      CONDITION_A,
      CONDITION_C
    ])
    expect(
      turnEffectRetainedConditions(owner, effects, new Set([liveOther.id, expiredOther.id]))
    ).toEqual([])
  })

  it('returns no retained conditions for a schema-version-1 effect', async () => {
    const legacyShape = await effect(1)
    const other = await effect(2, {
      conditionOwnership: [{ conditionId: CONDITION_A, baselinePresent: true }]
    })

    expect(legacyShape.definition.schemaVersion).toBe(1)
    expect(turnEffectRetainedConditions(legacyShape, [legacyShape, other], new Set())).toEqual([])
  })
})

describe('isTurnEffectEligible', () => {
  it('selects only effects recurring at the boundary stage', async () => {
    const state = encounterRun([goblin])
    const start = await effect(1, { recurrenceStage: 'START_OF_TURN' })
    const end = await effect(2, { recurrenceStage: 'END_OF_TURN' })
    const none = await effect(3, { recurrenceStage: 'NONE' })

    expect(
      [start, end, none].map((value) => isTurnEffectEligible(value, goblin, state, 'START_OF_TURN'))
    ).toEqual([true, false, false])
    expect(
      [start, end, none].map((value) => isTurnEffectEligible(value, goblin, state, 'END_OF_TURN'))
    ).toEqual([false, true, false])
  })

  it('binds ENCOUNTER-lifetime Encounter-actor effects to their origin Encounter, but not OWNER-lifetime ones', async () => {
    const state = encounterRun([goblin])
    const otherRun = { ...state, id: testUuid(0xe2) }
    const encounterScoped = await effect(1, { lifetimeScope: 'ENCOUNTER' })
    const ownerScoped = await effect(2, { lifetimeScope: 'OWNER' })
    const characterOrigin = await effect(3, { lifetimeScope: 'OWNER', origin: 'CHARACTER' })

    expect(isTurnEffectEligible(encounterScoped, goblin, state, 'START_OF_TURN')).toBe(true)
    expect(isTurnEffectEligible(encounterScoped, goblin, otherRun, 'START_OF_TURN')).toBe(false)
    expect(isTurnEffectEligible(ownerScoped, goblin, otherRun, 'START_OF_TURN')).toBe(true)
    expect(isTurnEffectEligible(characterOrigin, goblin, otherRun, 'START_OF_TURN')).toBe(true)
  })

  it("binds ENCOUNTER-lifetime Character effects to their stored source Encounter, not the definition's origin", async () => {
    const state = encounterRun([goblin, characterActor])
    const encounterScoped = await effect(1, { lifetimeScope: 'ENCOUNTER' })

    expect(
      isTurnEffectEligible(
        { ...encounterScoped, sourceEncounterId: ENCOUNTER_ID },
        characterActor,
        state,
        'START_OF_TURN'
      )
    ).toBe(true)
    expect(
      isTurnEffectEligible(
        { ...encounterScoped, sourceEncounterId: testUuid(0xe2) },
        characterActor,
        state,
        'START_OF_TURN'
      )
    ).toBe(false)
    expect(isTurnEffectEligible(encounterScoped, characterActor, state, 'START_OF_TURN')).toBe(
      false
    )
  })
})
