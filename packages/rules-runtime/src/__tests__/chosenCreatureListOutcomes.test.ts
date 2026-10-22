import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { astralProjection } from '@artificer-toolkit/source-data/srd/spells/astral-projection.js'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { executeEncounterActorsAction } from '../encounterActorsActionExecution.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY } from '../systems/dnd5e/effectActionContracts.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  prepareCreatureAction,
  srdConditionId,
  type CreatureFeature
} from './encounterCreatureAction.js'

type FeatureEffect = NonNullable<CreatureFeature['effects']>[number]
type FeatureOutcome = Extract<
  FeatureEffect['paths'][number],
  { selectionKind: 'FIXED' }
>['resultBlock']['outcomes'][number]

const CASTER_ID = testUuid(0x6e201)
const FIRST_ID = testUuid(0x6e202)
const SECOND_ID = testUuid(0x6e203)
const FEATURE_ID = testUuid(0x6e204)
const OCCURRENCE_ID = testUuid(0x6e205)

const runtime = createPlatformRulesRuntime({
  definitions: {
    async requireCurrent() {
      throw new Error('Definitions are not used by sealed graphs.')
    }
  }
})

/** An action on up to two chosen creatures within 30 feet that resolves `outcome` on each, with no test. */
function listFeature(outcome: FeatureOutcome): CreatureFeature {
  return {
    id: FEATURE_ID,
    label: 'Chosen List',
    description: 'Fixture: one outcome on each chosen creature.',
    order: 1,
    effects: [
      {
        id: testUuid(0x6e210),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.ACTIVATED,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: {
            id: testUuid(0x6e211),
            rangeKind: RANGE_KIND.DISTANCE,
            amount: 30,
            unit: MEASUREMENT_UNIT_CODE.FEET
          },
          targeting: { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY', maxTargets: 2 }
        },
        paths: [
          {
            id: testUuid(0x6e212),
            order: 1,
            pathCode: PATH_CODE.ON_USE,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: { id: testUuid(0x6e213), resultKind: 'SINGLE', outcomes: [outcome] }
          }
        ]
      }
    ]
  }
}

/** The list's one graph run on both chosen creatures, as the Session Worker runs a chosen-creatures cast. */
async function castOnBoth(feature: CreatureFeature, currentHitPoints = 20) {
  const caster = creatureActor({ id: CASTER_ID, label: 'Caster', features: [feature] })
  const targets = [FIRST_ID, SECOND_ID].map((id, index) =>
    creatureActor({ id, label: `Target ${index + 1}`, features: [], hitPoints: 20 })
  )
  const prepared = await Promise.all(
    targets.map((target) =>
      prepareCreatureAction({ actor: caster, target, featureId: FEATURE_ID, overridable: true })
    )
  )
  const lead = prepared[0]!
  return executeEncounterActorsAction({
    runtime,
    adapter: lead.adapter,
    plan: lead.plan,
    occurrenceId: OCCURRENCE_ID,
    rollsPerTarget: false,
    targets: prepared.map(({ binding }, index) => ({
      actorId: targets[index]!.id,
      binding: { ...binding, currentHitPoints }
    })),
    random: () => {
      throw new Error('Unexpected random call.')
    }
  })
}

const outcomeId = testUuid(0x6e214)

describe('a chosen-creature list resolves an outcome that lands on its target on each creature', () => {
  it.each<[string, FeatureOutcome, number, Record<string, unknown>]>([
    [
      'a condition',
      { id: outcomeId, effectKind: EFFECT_KIND.CONDITION, conditionId: srdConditionId('POISONED') },
      20,
      { kind: 'CONDITION_APPLY', conditionId: srdConditionId('POISONED') }
    ],
    ['a kill', { id: outcomeId, effectKind: EFFECT_KIND.KILL }, 20, { kind: 'KILL' }],
    [
      'a stabilize',
      { id: outcomeId, effectKind: EFFECT_KIND.STABILIZE, requiresZeroHitPoints: true },
      0,
      { kind: 'STABILIZE' }
    ]
  ])('%s', async (_name, outcome, hitPoints, application) => {
    const settled = await castOnBoth(listFeature(outcome), hitPoints)
    expect(settled.map(({ actorId, complete }) => [actorId, complete.applications])).toEqual([
      [FIRST_ID, [expect.objectContaining({ ...application, targetActorId: FIRST_ID })]],
      [SECOND_ID, [expect.objectContaining({ ...application, targetActorId: SECOND_ID })]]
    ])
  })

  it('a GM ruling, as the SRD Astral Projection authors it', async () => {
    const [effect] = astralProjection.effects ?? []
    if (!effect) throw new Error('The SRD Astral Projection has no effect.')
    const settled = await castOnBoth({
      id: FEATURE_ID,
      label: astralProjection.label,
      description: astralProjection.description,
      order: 1,
      effects: [effect]
    })
    expect(settled.map(({ actorId, complete }) => [actorId, complete.applications])).toEqual([
      [FIRST_ID, []],
      [SECOND_ID, []]
    ])
    expect(
      settled.map(({ complete }) =>
        complete.execution.evidence.trace.some(
          ({ operation }) => operation.key === DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY
        )
      )
    ).toEqual([true, true])
  })
})

describe('a chosen-creature list refuses an outcome that lands on the actor', () => {
  it('a Dash', () => {
    const discovery = discoverEncounterFeatureActions({
      actor: creatureActor({
        id: CASTER_ID,
        label: 'Caster',
        features: [
          listFeature({
            id: outcomeId,
            effectKind: EFFECT_KIND.MOVEMENT_RULE,
            ruleKind: 'ADD_SPEED_TO_MOVEMENT'
          })
        ]
      }),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      spells: new Map()
    })
    expect(discovery.available).toEqual([])
    expect(discovery.unavailable).toEqual([
      expect.objectContaining({
        ownerFeatureId: FEATURE_ID,
        reason:
          'D&D chosen-creature action outcome must land on each chosen creature, not on the actor or a triggering event.'
      })
    ])
  })
})
