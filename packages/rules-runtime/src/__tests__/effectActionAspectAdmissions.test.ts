import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_DAMAGE_PROPOSAL_OPERATION_KEY } from '../systems/dnd5e/effectActionContracts.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

type Invocation = Extract<EffectAuthored['invocation'], { triggerCode: 'SAVING_THROW' }>
type InvocationChange = Partial<Omit<Invocation, 'triggerCode' | 'savingThrow'>>

const FIRE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')?.id ?? ''

/** Every operation key the compiled output names, wherever it nests. */
function operationKeys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []
  const own =
    'operation' in value &&
    typeof value.operation === 'object' &&
    value.operation !== null &&
    'key' in value.operation &&
    typeof value.operation.key === 'string'
      ? [value.operation.key]
      : []
  return [...own, ...Object.values(value).flatMap(operationKeys)]
}

/**
 * An action authored from core options: a DC 13 Dexterity save against a fixed 3 fire damage on a
 * failed save, as one action on a single creature within 30 feet unless `change` says otherwise.
 */
function saveAction(change: InvocationChange = {}): EffectAuthored {
  return {
    id: ACTION_EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.SAVING_THROW,
      savingThrow: {
        id: testUuid(0x15a01),
        dcMethod: 'FIXED_DC',
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
        baseDc: 13
      },
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: {
        id: testUuid(0x15a02),
        rangeKind: RANGE_KIND.DISTANCE,
        amount: 30,
        unit: MEASUREMENT_UNIT_CODE.FEET
      },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      },
      ...change
    } as Invocation,
    paths: [
      {
        id: testUuid(0x15a03),
        order: 1,
        pathCode: PATH_CODE.ON_SAVE_FAIL,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: testUuid(0x15a04),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: testUuid(0x15a05),
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: FIRE_ID,
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 3
            }
          ]
        }
      }
    ]
  }
}

function planOf(effect: EffectAuthored) {
  const action = characterActionDescriptor(compileEffect(effect))
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

/** The save the room rolls, and the graph it runs on the failed-save path. */
function failedSaveGraph(effect: EffectAuthored) {
  const plan = planOf(effect)
  if (plan?.kind !== 'TEST_OUTCOME') throw new Error(`Expected a save, got ${plan?.kind}.`)
  const failed = dnd5eCharacterRuleActionSystemAdapter.specializeOutcomeTemplate?.({
    compilerSource: plan.compilerSource,
    testTemplate: plan.test,
    selectedPath: 'ON_SAVE_FAIL',
    facts: {},
    testRollMode: 'NORMAL'
  })
  return {
    paths: plan.outcomes.map(({ pathCode }) => pathCode),
    operations: operationKeys(failed?.published)
  }
}

const SAVE_FAILED_FOR_DAMAGE = {
  paths: ['ON_SAVE_FAIL'],
  operations: expect.arrayContaining([DND5E_DAMAGE_PROPOSAL_OPERATION_KEY])
}

const selfRange = { id: testUuid(0x15a06), rangeKind: RANGE_KIND.SELF }
const selfTarget = { selectionKind: TARGET_SELECTION_KIND.SELF }
const reactionToAnAttack = {
  activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
  reactionTrigger: { kind: 'ATTACKED_SELF' }
} as InvocationChange

describe('a save its user makes is taken by any activation (QUALITY-15.T1)', () => {
  it.each<[string, InvocationChange]>([
    ['as a reaction to its trigger', reactionToAnAttack],
    [
      'as a free action its Feature charge pays for',
      {
        activation: { code: ACTIVATION_CODE.FREE },
        resourceUse: { chargeId: testUuid(0x15a07), cost: 1 }
      }
    ],
    ['as a free action with no charge', { activation: { code: ACTIVATION_CODE.FREE } }]
  ])('%s', (_name, activation) => {
    expect(
      failedSaveGraph(saveAction({ range: selfRange, targeting: selfTarget, ...activation }))
    ).toEqual(SAVE_FAILED_FOR_DAMAGE)
  })
})

describe('a save over an area is taken as a bonus action (QUALITY-15.T1)', () => {
  it('rolls each caught creature’s save and runs the damage on a failure', () => {
    expect(
      failedSaveGraph(
        saveAction({
          activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
          range: { ...selfRange, rangeKind: RANGE_KIND.DISTANCE, amount: 150, unit: 'FEET' },
          targeting: {
            selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
            dispositionKind: TARGET_DISPOSITION_KIND.ANY
          },
          shape: {
            id: testUuid(0x15a08),
            shapeKind: 'SPHERE',
            radius: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
          }
        } as InvocationChange)
      )
    ).toEqual(SAVE_FAILED_FOR_DAMAGE)
  })

  it('is refused as a reaction, whose trigger aims no area', () => {
    expect(() =>
      planOf(
        saveAction({
          ...reactionToAnAttack,
          range: selfRange,
          targeting: {
            selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
            dispositionKind: TARGET_DISPOSITION_KIND.ANY
          },
          shape: {
            id: testUuid(0x15a08),
            shapeKind: 'CONE',
            length: { amount: 15, unit: MEASUREMENT_UNIT_CODE.FEET }
          }
        } as InvocationChange)
      )
    ).toThrow('D&D reaction resolves on its trigger and aims no area.')
  })
})

describe('a save on one creature takes any range the room measures (QUALITY-15.T1)', () => {
  const range = (rangeKind: 'SIGHT' | 'TOUCH' | 'UNLIMITED') => ({
    range: { id: testUuid(0x15a02), rangeKind }
  })

  it('a Sight range, which bounds no distance', () => {
    expect(failedSaveGraph(saveAction(range('SIGHT')))).toEqual(SAVE_FAILED_FOR_DAMAGE)
  })

  it.each(['SIGHT', 'TOUCH', 'UNLIMITED'] as const)(
    'a reaction’s save at a %s range',
    (rangeKind) => {
      expect(failedSaveGraph(saveAction({ ...reactionToAnAttack, ...range(rangeKind) }))).toEqual(
        SAVE_FAILED_FOR_DAMAGE
      )
    }
  )
})

describe('a creature target’s disposition (QUALITY-15.T1)', () => {
  it('a save on one hostile creature', () => {
    expect(
      failedSaveGraph(
        saveAction({
          targeting: {
            selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
            dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
          }
        })
      )
    ).toEqual(SAVE_FAILED_FOR_DAMAGE)
  })

  it('a save on a list of hostile creatures', () => {
    expect(
      failedSaveGraph(
        saveAction({
          targeting: {
            selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
            dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE,
            maxTargets: 2
          }
        })
      )
    ).toEqual(SAVE_FAILED_FOR_DAMAGE)
  })

  it('is refused when the target names none, since the room cannot evaluate it', () => {
    expect(() =>
      planOf(saveAction({ targeting: { selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET } }))
    ).toThrow('D&D creature target must name its disposition.')
  })

  it('is refused for a list at a Sight range, since the room measures each creature by distance', () => {
    expect(() =>
      planOf(
        saveAction({
          range: { id: testUuid(0x15a02), rangeKind: RANGE_KIND.SIGHT },
          targeting: {
            selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
            dispositionKind: TARGET_DISPOSITION_KIND.ANY,
            maxTargets: 2
          }
        })
      )
    ).toThrow('D&D chosen-creature list needs a measured range, not Sight.')
  })
})
