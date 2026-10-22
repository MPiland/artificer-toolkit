import { beforeAll, describe, expect, it } from 'vitest'
import { encounterMaintainedEffectStateRecordSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { encounterAreaTargetOccurrenceId } from '../encounterAreaPending.js'
import {
  isTurnEffectEligible,
  requireTurnMaintainedStates,
  turnEffectRetainedConditions
} from '../encounterTurnEffectState.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../systems/dnd5e/concentrationIdentity.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  characterActor as runCharacterActor,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import {
  GOBLIN,
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

const goblin = srdCreatureActor({ id: GOBLIN_ID, creature: GOBLIN })
const characterActor = runCharacterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })

let runtime: RulesRuntimeService
beforeAll(async () => {
  runtime = createSrdRulesRuntime()
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

  it('returns no retained conditions for an effect with no state contributions', async () => {
    const withoutContributions = await effect(1)
    const other = await effect(2, {
      conditionOwnership: [{ conditionId: CONDITION_A, baselinePresent: true }]
    })

    expect(withoutContributions.definition.stateContributions).toEqual([])
    expect(
      turnEffectRetainedConditions(withoutContributions, [withoutContributions, other], new Set())
    ).toEqual([])
  })
})

describe('requireTurnMaintainedStates', () => {
  const CASTER_ID = testUuid(0x104)
  const STATE_ID = testUuid(0x105)
  const CAST_OCCURRENCE_ID = testUuid(0x106)

  const maintained = encounterMaintainedEffectStateRecordSchema.parse({
    id: STATE_ID,
    encounterId: ENCOUNTER_ID,
    ownerActorId: CASTER_ID,
    maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: '1'.repeat(64),
      provenance: {
        kind: 'ACTION',
        sourceActionId: 'spell-fear',
        sourceOccurrenceId: CAST_OCCURRENCE_ID
      },
      sourceActorId: CASTER_ID,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    },
    descriptorChecksum: '2'.repeat(64),
    version: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })

  /** The Goblin's effect under the caster's Concentration, applied under `occurrenceId`. */
  async function heldEffect(occurrenceId: string) {
    const held = await effect(1, { sourceActorId: CASTER_ID, maintainedEffectStateId: STATE_ID })
    const { origin } = held.definition
    if (origin.kind !== 'ENCOUNTER')
      throw new Error('The fixture effect is applied in an Encounter.')
    return {
      ...held,
      definition: { ...held.definition, origin: { ...origin, sourceOccurrenceId: occurrenceId } }
    }
  }

  const bind = async (occurrenceId: string) =>
    requireTurnMaintainedStates(
      ENCOUNTER_ID,
      goblin,
      [await heldEffect(occurrenceId)],
      async () => maintained
    )

  it('binds an effect applied under the cast occurrence to its Concentration', async () => {
    expect(await bind(CAST_OCCURRENCE_ID)).toEqual(new Map([[STATE_ID, maintained]]))
  })

  it("binds an area creature's effect, applied under that creature's own save occurrence, to the area's Concentration", async () => {
    expect(await bind(encounterAreaTargetOccurrenceId(CAST_OCCURRENCE_ID, GOBLIN_ID))).toEqual(
      new Map([[STATE_ID, maintained]])
    )
  })

  it("refuses an effect bound to another creature's area occurrence or another cast", async () => {
    await expect(
      bind(encounterAreaTargetOccurrenceId(CAST_OCCURRENCE_ID, CHARACTER_ACTOR_ID))
    ).rejects.toThrow('Maintained turn effect source binding is stale.')
    await expect(bind(testUuid(0x107))).rejects.toThrow(
      'Maintained turn effect source binding is stale.'
    )
  })

  it('binds a carried effect, whose origin is an earlier Run, by its caster stamp (D151)', async () => {
    const CASTER_CHARACTER_ID = testUuid(0x108)
    const reinstated = {
      ...maintained,
      descriptor: {
        ...maintained.descriptor,
        provenance: { kind: 'CARRIED' as const, casterCharacterId: CASTER_CHARACTER_ID }
      }
    }
    const carried = async (casterCharacterId: string | null) => {
      const held = await heldEffect(testUuid(0x109))
      const { origin } = held.definition
      if (origin.kind !== 'ENCOUNTER')
        throw new Error('The fixture effect is applied in an Encounter.')
      return {
        ...held,
        definition: {
          ...held.definition,
          origin: { ...origin, sourceAggregateId: testUuid(0x10a) }
        },
        lifecycle: { ...held.lifecycle, concentrationCasterCharacterId: casterCharacterId }
      }
    }
    const bindCarried = async (casterCharacterId: string | null) =>
      requireTurnMaintainedStates(
        ENCOUNTER_ID,
        goblin,
        [await carried(casterCharacterId)],
        async () => reinstated
      )

    expect(await bindCarried(CASTER_CHARACTER_ID)).toEqual(new Map([[STATE_ID, reinstated]]))
    await expect(bindCarried(testUuid(0x10b))).rejects.toThrow(
      'Maintained turn effect source binding is stale.'
    )
    await expect(bindCarried(null)).rejects.toThrow(
      'Maintained turn effect source binding is stale.'
    )
  })
})

describe('isTurnEffectEligible', () => {
  it('selects only effects recurring at the boundary stage', async () => {
    const state = srdEncounterState({ actors: [goblin], currentActorId: GOBLIN_ID })
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
    const state = srdEncounterState({ actors: [goblin], currentActorId: GOBLIN_ID })
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
    const state = srdEncounterState({ actors: [goblin, characterActor], currentActorId: GOBLIN_ID })
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
