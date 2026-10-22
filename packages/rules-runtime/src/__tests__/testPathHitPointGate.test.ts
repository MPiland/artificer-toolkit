import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'

import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId,
  srdConditionId,
  srdDamageTypeId,
  type CreatureFeature
} from './encounterCreatureAction.js'

type FeatureEffect = NonNullable<CreatureFeature['effects']>[number]
type FeatureOutcome = Extract<
  FeatureEffect['paths'][number],
  { selectionKind: 'FIXED' }
>['resultBlock']['outcomes'][number]

const SOURCE_ID = testUuid(0x6e221)
const TARGET_ID = testUuid(0x6e222)
const FEATURE_ID = testUuid(0x6e223)
const POISONED = srdConditionId('POISONED')
const FAILED = 0

/** A DC 13 Constitution save whose failed result block applies `outcome` only to a target at 10 hit points or fewer. */
function gatedSaveFeature(outcome: FeatureOutcome): CreatureFeature {
  return {
    id: FEATURE_ID,
    label: 'Gated Save',
    description: 'Fixture: a hit-point gate on a saving throw result block.',
    order: 1,
    effects: [
      {
        id: testUuid(0x6e230),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.SAVING_THROW,
          savingThrow: {
            id: testUuid(0x6e231),
            dcMethod: 'FIXED_DC',
            abilityDefinitionId: srdAbilityId('CONSTITUTION'),
            baseDc: 13
          },
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: testUuid(0x6e232), rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: testUuid(0x6e233),
            order: 1,
            pathCode: PATH_CODE.ON_SAVE_FAIL,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(0x6e234),
              resultKind: 'SINGLE',
              gate: { kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 10 },
              outcomes: [outcome]
            }
          }
        ]
      }
    ]
  }
}

const poisoned: FeatureOutcome = {
  id: testUuid(0x6e235),
  effectKind: EFFECT_KIND.CONDITION,
  conditionId: POISONED
}

async function prepare(feature: CreatureFeature, targetHitPoints: number) {
  return prepareCreatureAction({
    actor: creatureActor({ id: SOURCE_ID, label: 'Source', features: [feature] }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Target',
      features: [],
      hitPoints: targetHitPoints
    }),
    featureId: FEATURE_ID,
    overridable: true
  })
}

describe('a hit-point gate on a saving throw result block', () => {
  it.each([
    [10, [expect.objectContaining({ kind: 'CONDITION_APPLY', conditionId: POISONED })]],
    [11, []]
  ])('a target at %i hit points that fails the save takes %j', async (hitPoints, applications) => {
    const { execution } = await settleCreatureAction({
      prepared: await prepare(gatedSaveFeature(poisoned), hitPoints),
      rolls: [FAILED]
    })
    expect(execution.d20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
    expect(execution.applications).toEqual(applications)
  })

  it('refuses a gate on a dice outcome, which binds none, rather than skip it', async () => {
    const gatedDamage = gatedSaveFeature({
      id: testUuid(0x6e236),
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: srdDamageTypeId('POISON'),
      valueKind: 'DICE',
      scalingKind: 'NONE',
      diceConfig: '2d6'
    })
    await expect(
      (async () =>
        settleCreatureAction({ prepared: await prepare(gatedDamage, 10), rolls: [FAILED] }))()
    ).rejects.toThrow('D&D hit-point gate belongs to a kill, condition or heal outcome.')
  })
})
