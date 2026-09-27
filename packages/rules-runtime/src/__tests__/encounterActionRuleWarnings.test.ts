import { describe, expect, it } from 'vitest'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  evaluateEncounterActionEconomy,
  prepareEncounterActionEconomy,
  stageEncounterActionEconomyRefreshes
} from '../encounterActionEconomy.js'
import { consumeEncounterActionEconomy } from '../encounterActionEconomyConsumption.js'
import {
  encounterActionEconomyWarnings,
  evaluateEncounterActionRuleWarnings,
  overridesActionEconomy
} from '../encounterActionRuleWarnings.js'
import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from '../encounterActorState.js'
import type { CurrentReusableDefinitionSource } from '../ruleCapabilityStateService.js'
import {
  creatureActor,
  creatureEncounter,
  prepareCreatureAction,
  QUILL_VOLLEY_ID,
  quillVolley,
  srdConditionId
} from './encounterCreatureAction.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000b0001'
const TARGET_ID = '00000000-0000-4000-8000-0000000b0002'

/** The published SRD rule-state definitions, served as current reusable definitions. */
const srdDefinitions: CurrentReusableDefinitionSource = {
  async requireCurrent(definitionId) {
    const seed = SRD_RULE_STATE_DEFINITIONS.find((definition) => definition.id === definitionId)
    if (!seed) throw new Error(`SRD rule-state definition ${definitionId} is missing.`)
    return reusableDefinitionCurrentDtoSchema.parse({
      ...seed,
      gameSystemId: SRD_SYSTEM_ID,
      contentSourceId: '00000000-0000-4000-8000-0000000b0003',
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-09-26T00:00:00.000Z',
      publishedBy: SRD_USER_ID
    })
  }
}

const allowanceChecksum = (definitionId: string) =>
  SRD_RULE_STATE_DEFINITIONS.find((definition) => definition.id === definitionId)!.checksum

function withUsage(actor: EncounterRunActorState, definitionId: string, used: number) {
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterRuleUsageUsed(actor, definitionId, used)
  })
}

async function economy(input: {
  actor: EncounterRunActorState
  activation: { code: string; amount: number }
  automationMode?: 'ASSISTED' | 'MANUAL'
}) {
  const { state, movementTargets } = creatureEncounter([input.actor], input.automationMode)
  const target = movementTargets.get(input.actor.id)
  return evaluateEncounterActionEconomy({
    actor: input.actor,
    state,
    activation: input.activation,
    target,
    loadTarget: async () => target,
    definitions: srdDefinitions
  })
}

const ACTION = { code: 'ACTION', amount: 1 }
const BONUS_ACTION = { code: 'BONUS_ACTION', amount: 1 }
const fresh = () => creatureActor({ id: ACTOR_ID, label: 'Wolf', features: [] })

describe('encounter action economy allowance', () => {
  it('binds a one-action activation to the unused SRD action allowance', async () => {
    await expect(economy({ actor: fresh(), activation: ACTION })).resolves.toEqual({
      consumption: {
        definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
        definitionVersion: 1,
        definitionChecksum: allowanceChecksum(SRD_ACTION_ALLOWANCE_DEFINITION_ID),
        maximum: 1,
        beforeUsed: 0,
        afterUsed: 1
      },
      available: true
    })
    await expect(economy({ actor: fresh(), activation: BONUS_ACTION })).resolves.toMatchObject({
      consumption: { definitionId: SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID, beforeUsed: 0 },
      available: true
    })
  })

  it('reports a used allowance as unavailable, still offering the next usage', async () => {
    const actor = withUsage(fresh(), SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1)
    await expect(economy({ actor, activation: ACTION })).resolves.toMatchObject({
      consumption: { maximum: 1, beforeUsed: 1, afterUsed: 2 },
      available: false
    })
    // A used action leaves the separate bonus-action allowance untouched.
    await expect(economy({ actor, activation: BONUS_ACTION })).resolves.toMatchObject({
      consumption: { beforeUsed: 0 },
      available: true
    })
  })

  it('suppresses an unused allowance while the actor is incapacitated', async () => {
    const actor = creatureActor({
      id: ACTOR_ID,
      label: 'Wolf',
      features: [],
      conditionIds: [srdConditionId('INCAPACITATED')]
    })
    await expect(economy({ actor, activation: BONUS_ACTION })).resolves.toMatchObject({
      consumption: { beforeUsed: 0, afterUsed: 1 },
      available: false
    })
  })

  it('tracks no allowance in Manual mode or for activations the System does not meter', async () => {
    await expect(
      economy({ actor: fresh(), activation: ACTION, automationMode: 'MANUAL' })
    ).resolves.toBeNull()
    await expect(
      economy({ actor: fresh(), activation: { code: 'REACTION', amount: 1 } })
    ).resolves.toBeNull()
    await expect(
      economy({ actor: fresh(), activation: { code: 'ACTION', amount: 2 } })
    ).resolves.toBeNull()
  })

  it('refuses an unavailable allowance on flows that cannot override it', async () => {
    const prepare = (actor: EncounterRunActorState) => {
      const { state, movementTargets } = creatureEncounter([actor])
      return prepareEncounterActionEconomy({
        actor,
        state,
        activation: ACTION,
        loadTarget: async () => movementTargets.get(ACTOR_ID),
        definitions: srdDefinitions
      })
    }
    const actor = fresh()
    await expect(prepare(actor)).resolves.toMatchObject({ beforeUsed: 0, afterUsed: 1 })
    await expect(prepare(withUsage(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1))).rejects.toThrow(
      'The selected action allowance is unavailable.'
    )
  })
})

describe('encounter action economy warning', () => {
  const consumption = (beforeUsed: number) => ({
    definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
    definitionVersion: 1,
    definitionChecksum: allowanceChecksum(SRD_ACTION_ALLOWANCE_DEFINITION_ID),
    maximum: 1,
    beforeUsed,
    afterUsed: beforeUsed + 1
  })

  it('warns only when the allowance is unavailable', () => {
    expect(encounterActionEconomyWarnings(null, 'ACTION')).toEqual([])
    expect(
      encounterActionEconomyWarnings({ consumption: consumption(0), available: true }, 'ACTION')
    ).toEqual([])
  })

  it('names the spent allowance by its activation', () => {
    expect(
      encounterActionEconomyWarnings({ consumption: consumption(1), available: false }, 'ACTION')
    ).toEqual([{ code: 'ACTION_ECONOMY_UNAVAILABLE', message: 'No action left this turn.' }])
    expect(
      encounterActionEconomyWarnings(
        { consumption: consumption(1), available: false },
        'BONUS_ACTION'
      )
    ).toEqual([{ code: 'ACTION_ECONOMY_UNAVAILABLE', message: 'No bonus action left this turn.' }])
  })

  it('distinguishes a suppressed allowance from a spent one', () => {
    expect(
      encounterActionEconomyWarnings({ consumption: consumption(0), available: false }, 'ACTION')
    ).toEqual([
      { code: 'ACTION_ECONOMY_UNAVAILABLE', message: "This actor can't take an action right now." }
    ])
    expect(
      encounterActionEconomyWarnings(
        { consumption: consumption(0), available: false },
        'BONUS_ACTION'
      )
    ).toEqual([
      {
        code: 'ACTION_ECONOMY_UNAVAILABLE',
        message: "This actor can't take a bonus action right now."
      }
    ])
  })
})

describe('encounter action economy consumption', () => {
  const consumption = (input: { beforeUsed: number; afterUsed: number }) => ({
    definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
    definitionVersion: 1,
    definitionChecksum: allowanceChecksum(SRD_ACTION_ALLOWANCE_DEFINITION_ID),
    maximum: 1,
    ...input
  })

  it('records one use and leaves every other actor field unchanged', () => {
    const actor = fresh()
    const consumed = consumeEncounterActionEconomy({
      actor,
      consumption: consumption({ beforeUsed: 0, afterUsed: 1 }),
      overridden: false
    })
    expect(consumed).toEqual(withUsage(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1))
    expect(encounterRuleUsageUsed(consumed, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
  })

  it('uses an allowance past its maximum only when the action was overridden', () => {
    const actor = withUsage(fresh(), SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1)
    const overuse = consumption({ beforeUsed: 1, afterUsed: 2 })
    expect(() =>
      consumeEncounterActionEconomy({ actor, consumption: overuse, overridden: false })
    ).toThrow('The selected action allowance changed before settlement.')
    expect(
      encounterRuleUsageUsed(
        consumeEncounterActionEconomy({ actor, consumption: overuse, overridden: true }),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(2)
  })

  it('refuses a stale or non-unit transition even when overridden', () => {
    const actor = withUsage(fresh(), SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1)
    for (const overridden of [false, true]) {
      expect(() =>
        consumeEncounterActionEconomy({
          actor,
          consumption: consumption({ beforeUsed: 0, afterUsed: 1 }),
          overridden
        })
      ).toThrow('The selected action allowance changed before settlement.')
      expect(() =>
        consumeEncounterActionEconomy({
          actor,
          consumption: consumption({ beforeUsed: 1, afterUsed: 3 }),
          overridden
        })
      ).toThrow('The selected action allowance changed before settlement.')
    }
  })

  it('walks unused -> used -> overused -> refreshed at the start of the next turn', async () => {
    let actor = fresh()
    const first = await economy({ actor, activation: ACTION })
    expect(first?.available).toBe(true)
    actor = consumeEncounterActionEconomy({
      actor,
      consumption: first!.consumption,
      overridden: false
    })
    const second = await economy({ actor, activation: ACTION })
    expect(second?.available).toBe(false)
    const warnings = encounterActionEconomyWarnings(second, 'ACTION')
    actor = consumeEncounterActionEconomy({
      actor,
      consumption: second!.consumption,
      overridden: overridesActionEconomy(warnings)
    })
    expect(encounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(2)

    const { state } = creatureEncounter([actor])
    const refreshed = await stageEncounterActionEconomyRefreshes({
      actor,
      state,
      definitions: srdDefinitions
    })
    expect(refreshed.refreshes).toEqual([
      {
        ordinal: 0,
        actorId: ACTOR_ID,
        capabilityDefinitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
        definitionVersion: 1,
        definitionChecksum: allowanceChecksum(SRD_ACTION_ALLOWANCE_DEFINITION_ID),
        beforeUsed: 2,
        afterUsed: 0
      }
    ])
    expect(
      encounterRuleUsageUsed(refreshed.refreshedActor!, SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(0)
    await expect(
      economy({ actor: refreshed.refreshedActor!, activation: ACTION })
    ).resolves.toMatchObject({ available: true })
  })
})

describe('encounter action rule warning gate', () => {
  const economyWarning: EncounterRuleWarningDto = {
    code: 'ACTION_ECONOMY_UNAVAILABLE',
    message: 'No action left this turn.'
  }
  const resourceWarning: EncounterRuleWarningDto = {
    code: 'RESOURCE_UNAVAILABLE',
    message: 'Not enough charges left: needs 1, has 0.'
  }
  const dispositionWarning: EncounterRuleWarningDto = {
    code: 'TARGET_DISPOSITION',
    message: 'This action needs a willing target.'
  }
  const rangeWarning: EncounterRuleWarningDto = {
    code: 'TARGET_OUT_OF_RANGE',
    message: 'The target is out of range.'
  }

  const grid = {
    kind: 'SQUARE' as const,
    cellSize: 100,
    diagonalPolicy: 'EQUAL' as const,
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET' as const
  }
  const square = (column: number) => ({
    position: { x: column * 100 + 50, y: 50 },
    width: 100,
    height: 100,
    rotationDegrees: 0
  })
  /** Two tokens eleven empty squares apart: beyond a 30-foot range by any grid count. */
  const farApart = { grid, sourceToken: square(0), targetToken: square(12) }

  /** A spent action, an exhausted charged 30-foot attack, and a target out of range. */
  async function preparedWarningGate() {
    const actor = withUsage(
      creatureActor({
        id: ACTOR_ID,
        label: 'Quill Beast',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 30 })],
        featureChargesUsed: { [QUILL_VOLLEY_ID]: 1 }
      }),
      SRD_ACTION_ALLOWANCE_DEFINITION_ID,
      1
    )
    const target = creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] })
    const prepared = await prepareCreatureAction({
      actor,
      target,
      featureId: QUILL_VOLLEY_ID,
      overridable: true
    })
    const actionEconomy = await evaluateEncounterActionEconomy({
      actor: prepared.actor,
      state: prepared.state,
      activation: ACTION,
      target: prepared.movementTargets.get(ACTOR_ID),
      loadTarget: async () => prepared.movementTargets.get(ACTOR_ID),
      definitions: srdDefinitions
    })
    return {
      prepared,
      actionEconomy,
      gate: (acknowledged: EncounterRuleWarningDto['code'][]) =>
        evaluateEncounterActionRuleWarnings({
          preparedWarnings: prepared.ruleWarnings,
          target: {
            actor: prepared.actor,
            target: prepared.target,
            targetPolicy: prepared.targetPolicy,
            sceneContext: farApart
          },
          actionEconomy,
          activationCode: 'ACTION',
          acknowledged
        })
    }
  }

  it('lists allowance, resource, then range warnings of a prepared action until all are acknowledged', async () => {
    const { gate } = await preparedWarningGate()
    const all = [economyWarning, resourceWarning, rangeWarning]
    expect(gate([])).toEqual({ kind: 'UNACKNOWLEDGED', warnings: all })
    expect(gate(['ACTION_ECONOMY_UNAVAILABLE', 'RESOURCE_UNAVAILABLE'])).toEqual({
      kind: 'UNACKNOWLEDGED',
      warnings: all
    })
    expect(
      gate(['TARGET_OUT_OF_RANGE', 'RESOURCE_UNAVAILABLE', 'ACTION_ECONOMY_UNAVAILABLE'])
    ).toEqual({ kind: 'ACCEPTED', overrides: all })
  })

  it('records only current warnings as overrides, and the allowance override lets it overuse', async () => {
    const { gate, prepared, actionEconomy } = await preparedWarningGate()
    const accepted = gate([
      'ACTION_ECONOMY_UNAVAILABLE',
      'RESOURCE_UNAVAILABLE',
      'SOURCE_NOT_EQUIPPED',
      'TARGET_DISPOSITION',
      'TARGET_OUT_OF_RANGE',
      'TARGET_RANGE_UNCHECKED'
    ])
    expect(accepted).toEqual({
      kind: 'ACCEPTED',
      overrides: [economyWarning, resourceWarning, rangeWarning]
    })
    if (accepted.kind !== 'ACCEPTED' || !actionEconomy) throw new Error('Expected overrides.')
    expect(overridesActionEconomy(accepted.overrides)).toBe(true)
    expect(overridesActionEconomy([resourceWarning, dispositionWarning, rangeWarning])).toBe(false)
    const settled = consumeEncounterActionEconomy({
      actor: prepared.actor,
      consumption: actionEconomy.consumption,
      overridden: overridesActionEconomy(accepted.overrides)
    })
    expect(encounterRuleUsageUsed(settled, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(2)
  })

  it('orders a disposition warning between the prepared and range warnings', () => {
    expect(
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: [resourceWarning],
        target: {
          actor: { id: ACTOR_ID, disposition: 'HOSTILE' },
          target: { id: TARGET_ID, disposition: 'FRIENDLY' },
          targetPolicy: {
            range: { id: 'range', rangeKind: 'DISTANCE', amount: 30, unit: 'FEET' },
            targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'WILLING' },
            shape: null,
            pathOverrides: []
          },
          sceneContext: farApart
        },
        actionEconomy: {
          consumption: {
            definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
            definitionVersion: 1,
            definitionChecksum: allowanceChecksum(SRD_ACTION_ALLOWANCE_DEFINITION_ID),
            maximum: 1,
            beforeUsed: 1,
            afterUsed: 2
          },
          available: false
        },
        activationCode: 'ACTION',
        acknowledged: []
      })
    ).toEqual({
      kind: 'UNACKNOWLEDGED',
      warnings: [economyWarning, resourceWarning, dispositionWarning, rangeWarning]
    })
  })

  it('accepts a clean action with no overrides and refuses an unsupported target policy', () => {
    const actor = { id: ACTOR_ID, disposition: 'HOSTILE' as const }
    const target = { id: TARGET_ID, disposition: 'FRIENDLY' as const }
    const targetPolicy = {
      range: { id: 'range', rangeKind: 'UNLIMITED' as const },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const },
      shape: null,
      pathOverrides: []
    }
    expect(
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: [],
        target: { actor, target, targetPolicy, sceneContext: null },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged: []
      })
    ).toEqual({ kind: 'ACCEPTED', overrides: [] })
    expect(
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: [resourceWarning],
        target: {
          actor,
          target,
          targetPolicy: { ...targetPolicy, targeting: null },
          sceneContext: null
        },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged: ['RESOURCE_UNAVAILABLE']
      })
    ).toEqual({ kind: 'UNSUPPORTED_TARGET' })
  })
})
