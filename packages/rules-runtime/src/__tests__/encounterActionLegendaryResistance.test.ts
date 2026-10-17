import { describe, expect, it, vi } from 'vitest'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { adultBlackDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-black-dragon.js'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterActionPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/encounterActionPending'

import { advanceNativeActionGraphs } from '../encounterActionExecution.js'
import { resolveNativeActionLegendaryResistance } from '../encounterActionLegendaryResistance.js'
import { findEncounterFeatureResource } from '../encounterActorRuleOutput.js'
import { discoverEncounterLegendaryResistanceCandidate } from '../encounterLegendaryResistanceDiscovery.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { SRD_SYSTEM_ID, srdActorRules, srdDefinitions } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  prepareCreatureAction,
  srdAbilityId,
  srdDamageTypeId,
  type CreatureFeature
} from './encounterCreatureAction.js'

const SOURCE_ID = '00000000-0000-4000-8000-0000000d1001'
const DRAGON_ID = '00000000-0000-4000-8000-0000000d1002'
const FEATURE_ID = '00000000-0000-4000-8000-0000000d1003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000d1004'
const LEGENDARY_RESISTANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e4'
const FAILED = 0
const SAVED = 19

const runtime = createPlatformRulesRuntime({
  definitions: {
    async requireCurrent() {
      throw new Error('Definitions are not used by sealed graphs.')
    }
  }
})

const legendaryResistanceFeature = (() => {
  const feature = adultBlackDragon.features?.find((entry) =>
    entry.ruleDefinitionIds?.includes(LEGENDARY_RESISTANCE_DEFINITION_ID)
  )
  if (!feature) throw new Error('SRD Legendary Resistance is missing.')
  return feature
})()

/** A DC 13 Dexterity save of one target: 9 acid damage on a failure, 4 on a success. */
const acidSpray: CreatureFeature = {
  id: FEATURE_ID,
  label: 'Acid Spray',
  description: 'Fixture: a single-target saving-throw action.',
  order: 1,
  effects: [
    {
      id: '00000000-0000-4000-8000-0000000d1010',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: '00000000-0000-4000-8000-0000000d1011',
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: srdAbilityId('DEXTERITY'),
          baseDc: 13
        },
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: '00000000-0000-4000-8000-0000000d1012', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        { code: PATH_CODE.ON_SAVE_FAIL, amount: 9 },
        { code: PATH_CODE.ON_SAVE_SUCCESS, amount: 4 }
      ].map(({ code, amount }, index) => {
        const id = `00000000-0000-4000-8000-0000000d102${index}`
        return {
          id,
          order: index + 1,
          pathCode: code,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${id}__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id,
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: srdDamageTypeId('ACID'),
                scalingKind: 'NONE' as const,
                valueKind: 'FIXED' as const,
                amount
              }
            ]
          }
        }
      })
    }
  ]
}

function dragon(used = 0) {
  return creatureActor({
    id: DRAGON_ID,
    label: 'Dragon',
    features: [legendaryResistanceFeature],
    hitPoints: 100,
    ...(used > 0 ? { featureChargesUsed: { [legendaryResistanceFeature.id]: used } } : {})
  })
}

const source = () => creatureActor({ id: SOURCE_ID, label: 'Sprayer', features: [acidSpray] })

/** Real discovery of the SRD Legendary Resistance on the dragon's current pool. */
function discoverOn(target: EncounterRunActorState) {
  const actorRules = srdActorRules([source(), target])
  return {
    discover: () =>
      discoverEncounterLegendaryResistanceCandidate({
        encounter: { gameSystemId: SRD_SYSTEM_ID },
        targetActor: target,
        actorRules,
        definitions: srdDefinitions
      }),
    resource: () =>
      findEncounterFeatureResource(actorRules, DRAGON_ID, legendaryResistanceFeature.id)!
  }
}

async function prepared(target: EncounterRunActorState) {
  return prepareCreatureAction({
    actor: source(),
    target,
    featureId: FEATURE_ID,
    overridable: true
  })
}

function scripted(naturalIndexes: number[]) {
  return (maximum: number) => {
    const value = naturalIndexes.shift()
    if (value === undefined || value >= maximum) throw new Error('Unexpected random call.')
    return value
  }
}

async function advance(input: {
  target: EncounterRunActorState
  discover: () => ReturnType<ReturnType<typeof discoverOn>['discover']>
  face: number
}) {
  const action = await prepared(input.target)
  return advanceNativeActionGraphs({
    runtime,
    adapter: action.adapter,
    plan: action.plan,
    occurrenceId: OCCURRENCE_ID,
    binding: action.binding,
    autoRoll: { SOURCE: true, TARGET: true },
    afterTest: async () => undefined,
    random: scripted([input.face]),
    legendaryResistance: {
      discover: input.discover,
      targetStateChecksum: checksumRuleDocument(input.target)
    }
  })
}

describe('a failed single-target save against a creature with Legendary Resistance', () => {
  it('holds the action for the creature’s choice without running the OUTCOME', async () => {
    const target = dragon()
    const execution = await advance({ target, discover: discoverOn(target).discover, face: FAILED })
    if (execution.kind !== 'PENDING') throw new Error('Expected the held choice.')
    expect(execution.roller).toBe('TARGET')
    expect(execution.d20Policy).toBeNull()
    expect(execution.twoPhase?.phase).toBe('TEST')
    expect(execution.legendaryResistance).toMatchObject({
      resistance: { targetActorId: DRAGON_ID, ownerFeatureId: legendaryResistanceFeature.id }
    })
    expect(execution.legendaryResistance?.originalD20).toMatchObject({
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(execution).not.toHaveProperty('phaseReceipts')
  })

  it('continues to the failure OUTCOME when the creature has no Legendary Resistance', async () => {
    const execution = await advance({ target: dragon(), discover: async () => null, face: FAILED })
    if (execution.kind !== 'COMPLETE') throw new Error('Expected the completed action.')
    expect(execution.phaseReceipts?.map((receipt) => receipt.phase)).toEqual(['TEST', 'OUTCOME'])
    expect(execution.d20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
  })

  it('does not look for a Legendary Resistance after a successful save', async () => {
    const discover = vi.fn(async () => null)
    const execution = await advance({ target: dragon(), discover, face: SAVED })
    expect(discover).not.toHaveBeenCalled()
    if (execution.kind !== 'COMPLETE') throw new Error('Expected the completed action.')
    expect(execution.d20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
  })
})

describe('answering the held Legendary Resistance offer', () => {
  async function held() {
    const target = dragon()
    const { discover, resource } = discoverOn(target)
    const execution = await advance({ target, discover, face: FAILED })
    if (execution.kind !== 'PENDING' || !execution.legendaryResistance)
      throw new Error('Expected the held choice.')
    const candidate = (await discover())!
    return {
      twoPhase: execution.twoPhase,
      action: await prepared(target),
      offer: execution.legendaryResistance,
      candidate,
      currentFeatureResource: resource(),
      targetStateChecksum: checksumRuleDocument(target)
    }
  }

  const answer = (
    state: Awaited<ReturnType<typeof held>>,
    selection: Parameters<typeof resolveNativeActionLegendaryResistance>[0]['selection'],
    overrides: Partial<Parameters<typeof resolveNativeActionLegendaryResistance>[0]> = {}
  ) =>
    resolveNativeActionLegendaryResistance({
      runtime,
      adapter: state.action.adapter,
      plan: state.action.plan,
      occurrenceId: OCCURRENCE_ID,
      binding: state.action.binding,
      autoRoll: { SOURCE: true, TARGET: true },
      afterTest: async () => undefined,
      offer: state.offer,
      candidate: state.candidate,
      currentFeatureResource: state.currentFeatureResource,
      targetStateChecksum: state.targetStateChecksum,
      selection,
      random: scripted([]),
      ...overrides
    })

  it('turns the failure into a success when used, charging one use', async () => {
    const state = await held()
    const { execution, resistance } = await answer(state, {
      kind: 'OPTION',
      optionId: state.offer.resistance.useOptionId
    })
    if (execution.kind !== 'COMPLETE') throw new Error('Expected the completed action.')
    expect(execution.applications).toMatchObject([{ kind: 'DAMAGE', appliedAmount: 4 }])
    expect(resistance.charge).toMatchObject({ ownerActorId: DRAGON_ID, cost: 1, afterUsed: 1 })
  })

  it('keeps the failure when declined, charging nothing', async () => {
    const state = await held()
    const { execution, resistance } = await answer(state, { kind: 'DECLINE' })
    if (execution.kind !== 'COMPLETE') throw new Error('Expected the completed action.')
    expect(execution.applications).toMatchObject([{ kind: 'DAMAGE', appliedAmount: 9 }])
    expect(resistance.charge).toBeNull()
  })

  it('seals the offer in the pending context only for the resisting creature’s held TEST', async () => {
    const state = await held()
    const context = {
      kind: 'ENCOUNTER_ACTION' as const,
      schemaVersion: 1 as const,
      commandJson: '{}',
      commandFingerprint: 'a'.repeat(64),
      initiatorUserId: SOURCE_ID,
      rollerActorId: DRAGON_ID,
      currentnessChecksum: 'b'.repeat(64),
      d20Policy: null,
      twoPhase: state.twoPhase,
      legendaryResistance: state.offer
    }
    const parses = (value: unknown) =>
      encounterActionPendingContextDtoSchema.safeParse(value).success
    expect(parses(context)).toBe(true)
    expect(parses({ ...context, rollerActorId: SOURCE_ID })).toBe(false)
    expect(parses({ ...context, twoPhase: null })).toBe(false)
    expect(parses({ ...context, d20Policy: state.offer.d20 })).toBe(false)
  })

  it('refuses a creature whose pool changed since the offer', async () => {
    const state = await held()
    const spent = dragon(1)
    const candidate = (await discoverOn(spent).discover())!
    await expect(answer(state, { kind: 'DECLINE' }, { candidate })).rejects.toThrow(
      'Legendary Resistance evidence is stale.'
    )
  })

  it('refuses a creature whose state changed since the offer', async () => {
    const state = await held()
    await expect(
      answer(state, { kind: 'DECLINE' }, { targetStateChecksum: 'b'.repeat(64) })
    ).rejects.toThrow('Legendary Resistance evidence is stale.')
  })

  it('refuses a candidate whose pin differs from the offer', async () => {
    const state = await held()
    const candidate = { ...state.candidate, ownerFeatureId: FEATURE_ID }
    await expect(answer(state, { kind: 'DECLINE' }, { candidate })).rejects.toThrow(
      'Legendary Resistance evidence is stale.'
    )
  })
})
