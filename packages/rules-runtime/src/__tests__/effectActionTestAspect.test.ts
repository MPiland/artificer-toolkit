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
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  compileDnd5eTest,
  dnd5eTestHoldPaths,
  dnd5eTestKind
} from '../systems/dnd5e/effectActionTest.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

type Invocation = EffectAuthored['invocation']

const FIRE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')?.id ?? ''
const ATTACK_TRIGGERS = [
  TRIGGER.MELEE_WEAPON_ATTACK,
  TRIGGER.RANGED_WEAPON_ATTACK,
  TRIGGER.UNARMED_ATTACK,
  TRIGGER.MELEE_SPELL_ATTACK,
  TRIGGER.RANGED_SPELL_ATTACK
]
const ONE_SKILL = { skillIds: [SRD_ATHLETICS_SKILL_ID], abilityDefinitionIds: [] }

/**
 * An action authored from core options: 3 fire damage to a single creature within 30 feet, on
 * `pathCode`, taken by the trigger and invocation fields `change` names.
 */
function action(change: Partial<Record<string, unknown>>, pathCode: string): EffectAuthored {
  return {
    id: ACTION_EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: {
        id: testUuid(0x15b02),
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
        id: testUuid(0x15b03),
        order: 1,
        pathCode,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: testUuid(0x15b04),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: testUuid(0x15b05),
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
  } as EffectAuthored
}

const SAVING_THROW = {
  id: testUuid(0x15b01),
  dcMethod: 'FIXED_DC',
  abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
  baseDc: 13
}

function saveAction(change: Partial<Record<string, unknown>> = {}): EffectAuthored {
  return action(
    { triggerCode: TRIGGER.SAVING_THROW, savingThrow: SAVING_THROW, ...change },
    PATH_CODE.ON_SAVE_FAIL
  )
}

/** SRD First Aid with its authored check replaced by `check`. */
function firstAidWithCheck(check: unknown): EffectAuthored {
  const effect = SRD_BASIC_ACTION_DEFINITIONS.find(
    ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
  )?.document.effects[0]
  if (!effect) throw new Error('First Aid has no authored effect.')
  return {
    ...effect,
    id: ACTION_EFFECT_ID,
    invocation: { ...effect.invocation, check }
  } as EffectAuthored
}

function checkAction(dc: unknown, checks: unknown = ONE_SKILL): EffectAuthored {
  return firstAidWithCheck({ checks, dc })
}

function compiledInvocation(effect: EffectAuthored) {
  return characterActionDescriptor(compileEffect(effect)).compiledEffect.invocation
}

function actionInvocation(effect: EffectAuthored) {
  const invocation = compiledInvocation(effect)
  if (invocation.kind !== 'ACTION') throw new Error('The fixture is not an activated action.')
  return invocation
}

function compile(effect: EffectAuthored) {
  return dnd5eCharacterRuleActionSystemAdapter.compile({
    action: {
      ...characterActionDescriptor(compileEffect(effect)),
      conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id)
    }
  })
}

const FIXED_DC = { kind: 'FIXED', value: 12 }
const CONTEST_DC = { kind: 'CONTEST', checks: ONE_SKILL }

describe('the test aspect decides what an action rolls (QUALITY-15.T1b)', () => {
  it('rolls an attack for each attack trigger, a save for a saving throw and nothing on activation', () => {
    for (const triggerCode of ATTACK_TRIGGERS)
      expect(compileDnd5eTest(actionInvocation(action({ triggerCode }, PATH_CODE.ON_HIT)))).toEqual(
        { kind: 'ATTACK' }
      )
    expect(compileDnd5eTest(actionInvocation(saveAction()))).toEqual({ kind: 'SAVE' })
    expect(
      compileDnd5eTest(
        actionInvocation(action({ triggerCode: TRIGGER.ACTIVATED }, PATH_CODE.ON_USE))
      )
    ).toEqual({ kind: 'NONE' })
  })

  it('rolls a check against the DC it names: fixed, contest, passive or concealment', () => {
    for (const dc of [
      FIXED_DC,
      CONTEST_DC,
      { kind: 'PASSIVE', passiveDefinitionId: testUuid(0x15b06) },
      { kind: 'CONCEALMENT' }
    ])
      expect(compileDnd5eTest(actionInvocation(checkAction(dc)))).toEqual({
        kind: 'CHECK',
        dc: dc.kind
      })
  })

  it('refuses a check that lists no check, or more than one, for its user to roll', () => {
    for (const checks of [
      { skillIds: [], abilityDefinitionIds: [] },
      {
        skillIds: [SRD_ATHLETICS_SKILL_ID],
        abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH]
      }
    ])
      expect(() => compileDnd5eTest(actionInvocation(checkAction(FIXED_DC, checks)))).toThrow(
        'D&D check action must list exactly one check.'
      )
  })

  it('refuses a contest that lists no check its target may roll against it', () => {
    const contest = checkAction({
      kind: 'CONTEST',
      checks: { skillIds: [], abilityDefinitionIds: [] }
    })
    expect(() => compileDnd5eTest(actionInvocation(contest))).toThrow(
      'D&D contest check action must list the checks its target may roll.'
    )
    expect(() => compile(contest)).toThrow(
      'D&D contest check action must list the checks its target may roll.'
    )
  })

  it('classifies no test for a trigger it does not roll, and refuses to compile one', () => {
    const entering = action({ triggerCode: TRIGGER.ENTER_AREA }, PATH_CODE.ON_USE)
    expect(dnd5eTestKind(compiledInvocation(entering))).toBeNull()
    expect(() => compileDnd5eTest(actionInvocation(entering))).toThrow(
      'D&D action trigger is not a test the Effect action compiler runs.'
    )
  })

  it('holds a target under a relationship on a hit, a failed save, a contest win or its use', () => {
    const holdPaths = (effect: EffectAuthored) => dnd5eTestHoldPaths(compiledInvocation(effect))
    expect(
      holdPaths(action({ triggerCode: TRIGGER.MELEE_WEAPON_ATTACK }, PATH_CODE.ON_HIT))
    ).toEqual(['ON_HIT', 'ON_CRIT'])
    expect(holdPaths(saveAction())).toEqual(['ON_SAVE_FAIL'])
    expect(holdPaths(action({ triggerCode: TRIGGER.ACTIVATED }, PATH_CODE.ON_USE))).toEqual([
      'ON_USE'
    ])
    expect(holdPaths(checkAction(CONTEST_DC))).toEqual(['ON_CHECK_SUCCESS'])
    expect(holdPaths(checkAction(FIXED_DC))).toEqual([])
    expect(holdPaths(action({ triggerCode: TRIGGER.ENTER_AREA }, PATH_CODE.ON_USE))).toEqual([])
  })
})

describe('the test aspect composes with targeting in the activated action', () => {
  it('compiles a save on any single creature', () => {
    expect(() => compile(saveAction())).not.toThrow()
  })

  it('refuses a save that may target only a willing creature', () => {
    const willing = saveAction({
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.WILLING
      }
    })
    expect(() => compile(willing)).toThrow('D&D test targets any creature, not only a willing one.')
  })

  it('refuses a save on its user alone whose distance range only a teleport may read', () => {
    const selfSave = saveAction({ targeting: { selectionKind: TARGET_SELECTION_KIND.SELF } })
    expect(() => compile(selfSave)).toThrow(
      'D&D Self action range of distance bounds only its user teleporting.'
    )
  })

  it('refuses an attack on its user alone', () => {
    const selfAttack = action(
      {
        triggerCode: TRIGGER.MELEE_SPELL_ATTACK,
        targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
      },
      PATH_CODE.ON_HIT
    )
    expect(() => compile(selfAttack)).toThrow('D&D attack roll needs a target other than its user.')
  })

  it('refuses a save list that names a creature twice, though an attack list may', () => {
    const repeatedList = {
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY,
        maxTargets: 3,
        allowRepeatedTargets: true
      }
    }
    expect(() => compile(saveAction(repeatedList))).toThrow(
      'D&D save list must name each creature once.'
    )
    expect(() =>
      compile(
        action({ triggerCode: TRIGGER.RANGED_SPELL_ATTACK, ...repeatedList }, PATH_CODE.ON_HIT)
      )
    ).not.toThrow()
  })
})
