import { describe, expect, it } from 'vitest'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import {
  SRD_CREATURE_TYPES,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  evaluateEncounterActionEconomy,
  prepareEncounterActionEconomy,
  stageEncounterActionEconomyRefreshes
} from '../encounterActionEconomy.js'
import { consumeEncounterActionEconomy } from '../encounterActionEconomyConsumption.js'
import type { isEncounterTargetDying } from '../encounterActorDefeat.js'
import { dnd5eOutcomeTargetPreconditions } from '../systems/dnd5e/effectActionOutcomes.js'
import {
  encounterActionEconomyWarnings,
  evaluateEncounterActionRuleWarnings,
  evaluateEncounterActorsRuleWarnings,
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

  it('binds a reaction to the unused SRD reaction allowance (REACTION-4.T1 premise change: reactions are metered)', async () => {
    await expect(
      economy({ actor: fresh(), activation: { code: 'REACTION', amount: 1 } })
    ).resolves.toMatchObject({
      consumption: { definitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID, beforeUsed: 0 },
      available: true
    })
  })

  it('tracks no allowance in Manual mode or for activations the System does not meter', async () => {
    await expect(
      economy({ actor: fresh(), activation: ACTION, automationMode: 'MANUAL' })
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
            makesAttackRoll: prepared.makesAttackRoll,
            sceneContext: farApart
          },
          targetDefeated: false,
          targetPreconditions: { declared: [], target: undefined },
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
          makesAttackRoll: false,
          sceneContext: farApart
        },
        targetDefeated: false,
        targetPreconditions: { declared: [], target: undefined },
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

  describe('a size limit above the actor (D152)', () => {
    const tooLarge: EncounterRuleWarningDto = {
      code: 'TARGET_TOO_LARGE',
      message: 'The target is too large for this action.'
    }
    const gate = (
      sizes: { actorSize: string | null; targetSize: string | null },
      acknowledged: EncounterRuleWarningDto['code'][] = []
    ) =>
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: [],
        target: {
          actor: { id: ACTOR_ID, disposition: 'FRIENDLY' },
          target: { id: TARGET_ID, disposition: 'HOSTILE' },
          targetPolicy: {
            range: { id: 'range', rangeKind: 'TOUCH' },
            targeting: {
              selectionKind: 'SINGLE_TARGET',
              dispositionKind: 'HOSTILE',
              sizeLimit: { stepsAboveActor: 1 }
            },
            shape: null,
            pathOverrides: []
          },
          makesAttackRoll: false,
          sceneContext: null
        },
        sizes: { gameSystemId: SRD_SYSTEM_ID, actor: sizes.actorSize, target: sizes.targetSize },
        targetDefeated: false,
        targetPreconditions: { declared: [], target: undefined },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged: ['TARGET_RANGE_UNCHECKED', ...acknowledged]
      })

    it('allows a target up to the limit above the actor', () => {
      expect(gate({ actorSize: 'MEDIUM', targetSize: 'LARGE' })).toMatchObject({
        kind: 'ACCEPTED'
      })
      expect(gate({ actorSize: 'MEDIUM', targetSize: 'TINY' })).toMatchObject({
        kind: 'ACCEPTED'
      })
    })

    it('warns for a larger target, which only an override proceeds against', () => {
      expect(gate({ actorSize: 'MEDIUM', targetSize: 'HUGE' })).toEqual({
        kind: 'UNACKNOWLEDGED',
        warnings: [tooLarge, expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })]
      })
      expect(gate({ actorSize: 'MEDIUM', targetSize: 'HUGE' }, ['TARGET_TOO_LARGE'])).toMatchObject(
        { kind: 'ACCEPTED', overrides: expect.arrayContaining([tooLarge]) }
      )
    })

    it('raises nothing when either size is unknown', () => {
      expect(gate({ actorSize: null, targetSize: 'GARGANTUAN' })).toMatchObject({
        kind: 'ACCEPTED'
      })
      expect(gate({ actorSize: 'TINY', targetSize: null })).toMatchObject({ kind: 'ACCEPTED' })
    })
  })

  describe('a list of chosen creatures', () => {
    const undeadId = '00000000-0000-4000-8000-0000000b00aa'
    const excludedWarning: EncounterRuleWarningDto = {
      code: 'TARGET_CREATURE_TYPE_EXCLUDED',
      message: 'This action has no effect on this creature type.'
    }
    const areaWarning: EncounterRuleWarningDto = {
      code: 'TARGET_OUT_OF_SIGHT',
      message: 'The area origin is out of sight.'
    }
    const chosenPolicy = (
      shape: CompiledActionTargetPolicy['shape']
    ): CompiledActionTargetPolicy => ({
      range: { id: 'range', rangeKind: 'DISTANCE' as const, amount: 30, unit: 'FEET' as const },
      targeting: {
        selectionKind: 'CHOSEN_CREATURES' as const,
        dispositionKind: 'ANY' as const,
        maxTargets: 3,
        excludedCreatureTypeIds: [undeadId]
      },
      shape,
      pathOverrides: []
    })
    const entry = (
      id: string,
      sceneContext: typeof farApart | null,
      targetCreatureTypeId: string | null,
      shape: CompiledActionTargetPolicy['shape'] = null
    ) => ({
      target: {
        actor: { id: ACTOR_ID, disposition: 'FRIENDLY' as const },
        target: { id, disposition: 'FRIENDLY' as const },
        targetPolicy: chosenPolicy(shape),
        makesAttackRoll: false,
        sceneContext
      },
      targetDefeated: false,
      targetCreatureTypeId
    })
    const gate = (
      targets: ReturnType<typeof entry>[],
      areaWarnings: EncounterRuleWarningDto[] = []
    ) =>
      evaluateEncounterActorsRuleWarnings({
        preparedWarnings: [resourceWarning],
        targets,
        areaWarnings,
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged: []
      })

    it('reports a warning that applies to several creatures once, and one that is theirs alone', () => {
      expect(
        gate([
          entry(TARGET_ID, farApart, undeadId),
          entry('00000000-0000-4000-8000-0000000b0004', farApart, null)
        ])
      ).toEqual({
        kind: 'UNACKNOWLEDGED',
        warnings: [resourceWarning, excludedWarning, rangeWarning]
      })
    })

    it('warns once for each bonded creature whose Intelligence is at or under the floor (SPELLS-28)', () => {
      const nextDoor = { grid, sourceToken: square(0), targetToken: square(1) }
      const bond = (intelligences: (number | null)[]) =>
        evaluateEncounterActorsRuleWarnings({
          preparedWarnings: [],
          targets: intelligences.map((targetIntelligence, index) => ({
            ...entry(`00000000-0000-4000-8000-0000000b01${index}0`, nextDoor, null),
            targetIntelligence
          })),
          areaWarnings: [],
          actionEconomy: null,
          activationCode: 'ACTION',
          linkIntelligenceFloor: 2,
          acknowledged: []
        })
      const dullWarning: EncounterRuleWarningDto = {
        code: 'TARGET_INTELLIGENCE_EXCLUDED',
        message: 'This creature has too little Intelligence to join the bond.'
      }
      expect(bond([2, 1, 3, null])).toEqual({ kind: 'UNACKNOWLEDGED', warnings: [dullWarning] })
      expect(bond([3, null])).toEqual({ kind: 'ACCEPTED', overrides: [] })
    })

    it('holds a creature in an area to the area’s own warnings, not to the spell’s range', () => {
      const sphere = {
        id: 'sphere',
        shapeKind: 'SPHERE' as const,
        radius: { amount: 30, unit: 'FEET' as const }
      }
      expect(gate([entry(TARGET_ID, farApart, null, sphere)], [areaWarning])).toEqual({
        kind: 'UNACKNOWLEDGED',
        warnings: [areaWarning, resourceWarning]
      })
    })

    it('accepts every warning once the table acknowledges each code', () => {
      expect(
        evaluateEncounterActorsRuleWarnings({
          preparedWarnings: [resourceWarning],
          targets: [entry(TARGET_ID, farApart, undeadId)],
          areaWarnings: [],
          actionEconomy: null,
          activationCode: 'ACTION',
          acknowledged: [
            'RESOURCE_UNAVAILABLE',
            'TARGET_CREATURE_TYPE_EXCLUDED',
            'TARGET_OUT_OF_RANGE'
          ]
        })
      ).toEqual({
        kind: 'ACCEPTED',
        overrides: [resourceWarning, excludedWarning, rangeWarning]
      })
    })

    it('refuses the whole list when one creature breaks a rule no override covers', () => {
      const refused = entry(TARGET_ID, farApart, null)
      expect(
        gate([
          entry('00000000-0000-4000-8000-0000000b0004', farApart, null),
          {
            ...refused,
            target: { ...refused.target, targetPolicy: { ...chosenPolicy(null), targeting: null } }
          }
        ])
      ).toEqual({ kind: 'UNSUPPORTED_TARGET' })
    })
  })

  it("treats the SRD Unicorn's Healing Touch as a 5-foot range that warns, not refuses", async () => {
    const healingTouch = unicorn.features?.find(({ label }) => label.startsWith('Healing Touch'))
    if (!healingTouch) throw new Error('The SRD Healing Touch Feature is missing.')
    const prepared = await prepareCreatureAction({
      actor: creatureActor({ id: ACTOR_ID, label: 'Unicorn', features: [healingTouch] }),
      target: creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] }),
      featureId: healingTouch.id,
      overridable: true
    })
    const gate = (targetColumn: number) =>
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: prepared.ruleWarnings,
        target: {
          actor: prepared.actor,
          target: prepared.target,
          targetPolicy: prepared.targetPolicy,
          makesAttackRoll: false,
          sceneContext: { grid, sourceToken: square(0), targetToken: square(targetColumn) }
        },
        targetDefeated: false,
        targetPreconditions: { declared: [], target: undefined },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged: []
      })
    expect(gate(1)).toEqual({ kind: 'ACCEPTED', overrides: [] })
    expect(gate(2)).toEqual({ kind: 'UNACKNOWLEDGED', warnings: [rangeWarning] })
  })

  it('treats a ranged single-target ON_USE action out of range as a warning, not a refusal', async () => {
    const volley = quillVolley({ charges: 3, cost: 1 })
    const [effect] = volley.effects ?? []
    if (!effect || effect.invocation.kind !== 'ACTION') throw new Error('Expected an action.')
    // Quill Volley simply happens to one target within 30 feet.
    const ranged: typeof volley = {
      ...volley,
      effects: [
        {
          ...effect,
          invocation: {
            ...effect.invocation,
            range: {
              id: effect.invocation.range.id,
              rangeKind: 'DISTANCE',
              amount: 30,
              unit: 'FEET'
            }
          }
        }
      ]
    }
    const prepared = await prepareCreatureAction({
      actor: creatureActor({ id: ACTOR_ID, label: 'Quill Beast', features: [ranged] }),
      target: creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true
    })
    const gate = (targetColumn: number) =>
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: prepared.ruleWarnings,
        target: {
          actor: prepared.actor,
          target: prepared.target,
          targetPolicy: prepared.targetPolicy,
          makesAttackRoll: false,
          sceneContext: { grid, sourceToken: square(0), targetToken: square(targetColumn) }
        },
        targetDefeated: false,
        targetPreconditions: { declared: [], target: undefined },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged: []
      })
    expect(gate(6)).toEqual({ kind: 'ACCEPTED', overrides: [] })
    expect(gate(7)).toEqual({ kind: 'UNACKNOWLEDGED', warnings: [rangeWarning] })
  })

  it('warns, overridably, when the chosen target is defeated (D63)', () => {
    const gate = (acknowledged: EncounterRuleWarningDto['code'][]) =>
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: [],
        target: {
          actor: { id: ACTOR_ID, disposition: 'HOSTILE' },
          target: { id: TARGET_ID, disposition: 'FRIENDLY' },
          targetPolicy: {
            range: { id: 'range', rangeKind: 'UNLIMITED' },
            targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
            shape: null,
            pathOverrides: []
          },
          makesAttackRoll: false,
          sceneContext: null
        },
        targetDefeated: true,
        targetPreconditions: { declared: [], target: undefined },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged
      })
    const defeated = { code: 'TARGET_DEFEATED', message: 'The target is defeated.' }
    expect(gate([])).toEqual({ kind: 'UNACKNOWLEDGED', warnings: [defeated] })
    expect(gate(['TARGET_DEFEATED'])).toEqual({ kind: 'ACCEPTED', overrides: [defeated] })
  })

  it("warns, overridably, when a target fails its outcome's declared precondition (D96, D173 Q1)", () => {
    const character = (current: number, stable: boolean) => ({
      actor: { kind: 'CHARACTER' as const },
      state: { current, deathSaves: { successes: 0, failures: 0, stable } }
    })
    type Target = Parameters<typeof isEncounterTargetDying>[0]
    const gate = (
      effectKinds: string[],
      target: Target,
      acknowledged: EncounterRuleWarningDto['code'][]
    ) =>
      evaluateEncounterActionRuleWarnings({
        preparedWarnings: [],
        target: {
          actor: { id: ACTOR_ID, disposition: 'FRIENDLY' },
          target: { id: TARGET_ID, disposition: 'FRIENDLY' },
          targetPolicy: {
            range: { id: 'range', rangeKind: 'UNLIMITED' },
            targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
            shape: null,
            pathOverrides: []
          },
          makesAttackRoll: false,
          sceneContext: null
        },
        targetDefeated: true,
        targetPreconditions: {
          declared: dnd5eOutcomeTargetPreconditions(effectKinds),
          target
        },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged
      })
    const notDying = { code: 'TARGET_NOT_DYING', message: 'The target is not dying.' }
    const dying = character(0, false)
    const stable = character(0, true)
    expect(gate(['STABILIZE'], dying, [])).toEqual({ kind: 'ACCEPTED', overrides: [] })
    expect(gate(['STABILIZE'], stable, [])).toEqual({
      kind: 'UNACKNOWLEDGED',
      warnings: [notDying]
    })
    expect(gate(['STABILIZE'], stable, ['TARGET_NOT_DYING'])).toEqual({
      kind: 'ACCEPTED',
      overrides: [notDying]
    })
    // A Character above 0 hit points has no death saves to stabilize.
    const healthy = {
      actor: { kind: 'CHARACTER' as const },
      state: { current: 4, deathSaves: null }
    }
    expect(gate(['STABILIZE'], healthy, [])).toEqual({
      kind: 'UNACKNOWLEDGED',
      warnings: [notDying]
    })
    // A Creature at 0 hit points is defeated rather than dying.
    const creature = {
      actor: { kind: 'CREATURE' as const },
      state: { current: 0, deathSaves: null }
    }
    expect(gate(['STABILIZE'], creature, [])).toEqual({
      kind: 'UNACKNOWLEDGED',
      warnings: [notDying]
    })
    // An outcome that declares no precondition keeps the defeated-target warning.
    expect(gate(['DAMAGE'], dying, [])).toEqual({
      kind: 'UNACKNOWLEDGED',
      warnings: [{ code: 'TARGET_DEFEATED', message: 'The target is defeated.' }]
    })
  })

  describe('an action restricted by creature type', () => {
    const creatureTypeId = (code: string) =>
      SRD_CREATURE_TYPES.find((type) => type.code === code)!.id
    const undead = creatureTypeId('UNDEAD')
    const construct = creatureTypeId('CONSTRUCT')
    const humanoid = creatureTypeId('HUMANOID')
    const beast = creatureTypeId('BEAST')
    const gateFor =
      (restriction: { allowedCreatureTypeIds?: string[]; excludedCreatureTypeIds?: string[] }) =>
      (targetCreatureTypeId: string | null, acknowledged: EncounterRuleWarningDto['code'][]) =>
        evaluateEncounterActionRuleWarnings({
          preparedWarnings: [],
          target: {
            actor: { id: ACTOR_ID, disposition: 'FRIENDLY' },
            target: { id: TARGET_ID, disposition: 'FRIENDLY' },
            targetPolicy: {
              range: { id: 'range', rangeKind: 'TOUCH' },
              targeting: {
                selectionKind: 'SINGLE_TARGET',
                dispositionKind: 'ANY',
                ...restriction
              },
              shape: null,
              pathOverrides: []
            },
            makesAttackRoll: false,
            sceneContext: null
          },
          targetCreatureTypeId,
          targetDefeated: false,
          targetPreconditions: { declared: [], target: undefined },
          actionEconomy: null,
          activationCode: 'ACTION',
          acknowledged
        })
    const excluded = {
      code: 'TARGET_CREATURE_TYPE_EXCLUDED',
      message: 'This action has no effect on this creature type.'
    }

    it('warns, overridably, when the target creature type is excluded by the action', () => {
      const gate = gateFor({ excludedCreatureTypeIds: [undead, construct] })
      expect(gate(undead, [])).toEqual({
        kind: 'UNACKNOWLEDGED',
        warnings: [excluded, expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })]
      })
      expect(gate(construct, [])).toMatchObject({ kind: 'UNACKNOWLEDGED' })
      expect(gate(humanoid, ['TARGET_RANGE_UNCHECKED'])).toEqual({
        kind: 'ACCEPTED',
        overrides: [expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })]
      })
      expect(gate(null, ['TARGET_RANGE_UNCHECKED'])).toMatchObject({ kind: 'ACCEPTED' })
      expect(gate(undead, ['TARGET_CREATURE_TYPE_EXCLUDED', 'TARGET_RANGE_UNCHECKED'])).toEqual({
        kind: 'ACCEPTED',
        overrides: [excluded, expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })]
      })
    })

    it('warns, overridably, when the target creature type is not one the action affects', () => {
      const gate = gateFor({ allowedCreatureTypeIds: [humanoid] })
      expect(gate(beast, [])).toEqual({
        kind: 'UNACKNOWLEDGED',
        warnings: [excluded, expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })]
      })
      expect(gate(humanoid, ['TARGET_RANGE_UNCHECKED'])).toMatchObject({ kind: 'ACCEPTED' })
      expect(gate(null, ['TARGET_RANGE_UNCHECKED'])).toMatchObject({ kind: 'ACCEPTED' })
      expect(gate(beast, ['TARGET_CREATURE_TYPE_EXCLUDED', 'TARGET_RANGE_UNCHECKED'])).toEqual({
        kind: 'ACCEPTED',
        overrides: [excluded, expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })]
      })
    })

    it('shares the one warning between the allowed and the excluded types', () => {
      const gate = gateFor({
        allowedCreatureTypeIds: [humanoid, beast],
        excludedCreatureTypeIds: [beast]
      })
      expect(gate(beast, ['TARGET_RANGE_UNCHECKED'])).toMatchObject({ kind: 'UNACKNOWLEDGED' })
      expect(gate(undead, ['TARGET_RANGE_UNCHECKED'])).toMatchObject({ kind: 'UNACKNOWLEDGED' })
      expect(gate(humanoid, ['TARGET_RANGE_UNCHECKED'])).toMatchObject({ kind: 'ACCEPTED' })
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
        target: { actor, target, targetPolicy, makesAttackRoll: false, sceneContext: null },
        targetDefeated: false,
        targetPreconditions: { declared: [], target: undefined },
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
          makesAttackRoll: false,
          sceneContext: null
        },
        targetDefeated: false,
        targetPreconditions: { declared: [], target: undefined },
        actionEconomy: null,
        activationCode: 'ACTION',
        acknowledged: ['RESOURCE_UNAVAILABLE']
      })
    ).toEqual({ kind: 'UNSUPPORTED_TARGET' })
  })
})
