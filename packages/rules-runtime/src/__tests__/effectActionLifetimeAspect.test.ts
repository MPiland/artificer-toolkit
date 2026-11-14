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
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  dnd5eCharacterRuleActionSystemAdapter,
  relationshipPlan
} from '../systems/dnd5e/effectActionCompiler.js'
import {
  dnd5eLifetime,
  dnd5eRecurringPlan,
  holdsEntryLifetime,
  type Dnd5eLifetime,
  type Dnd5eLifetimeCandidates
} from '../systems/dnd5e/effectActionLifetimeAspect.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { catalogueBasicActionEffect } from '../testing/concealmentFixture.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const FIRE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')?.id ?? ''
const MAINTAINED_CONCEALMENT =
  'D&D concealment cannot be maintained: its check settles it with no maintenance link.'
const ONE_RESULT =
  'D&D Effect action must have one fixed direct result without lifecycle overrides.'
const TEN_ROUNDS = { duration: { id: testUuid(0x1c01), durationKind: 'ROUND', amount: 10 } }
const EACH_TURN_END = { lifecycle: { recurringKind: 'END_OF_TURN' } }

/** No plan the compiler builds holds the action: the aspect's own plans decide. */
const NO_COMPILER_PLAN: Dnd5eLifetimeCandidates = {
  sequential: () => null,
  repeatSave: () => null,
  timed: () => null,
  relationship: () => null
}

/** An action authored from core options: `outcome` on `pathCode` of one result block `block` extends. */
function authoredAction(
  trigger: Record<string, unknown>,
  pathCode: string,
  outcome: Record<string, unknown>,
  block: Record<string, unknown> = {}
): EffectAuthored {
  return {
    id: ACTION_EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: {
        id: testUuid(0x1c02),
        rangeKind: RANGE_KIND.DISTANCE,
        amount: 30,
        unit: MEASUREMENT_UNIT_CODE.FEET
      },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      },
      ...trigger
    },
    paths: [
      {
        id: testUuid(0x1c03),
        order: 1,
        pathCode,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: { id: testUuid(0x1c04), resultKind: 'SINGLE', outcomes: [outcome], ...block }
      }
    ]
  } as EffectAuthored
}

const SAVING_THROW = {
  triggerCode: TRIGGER.SAVING_THROW,
  savingThrow: {
    id: testUuid(0x1c05),
    dcMethod: 'FIXED_DC',
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    baseDc: 13
  }
}
const THREE_FIRE = {
  id: testUuid(0x1c06),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: FIRE_ID,
  valueKind: 'FIXED',
  scalingKind: 'NONE',
  amount: 3
}

/** The action as discovery pins it: its save's ability and the System's conditions. */
function pinned(compiled: ReturnType<typeof compileEffect>) {
  return {
    ...characterActionDescriptor(compiled),
    savingThrowAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id)
  }
}

/** A failed save that burns again at the end of each of the target's turns for 10 rounds. */
const burning = pinned(
  compileEffect(
    authoredAction(SAVING_THROW, PATH_CODE.ON_SAVE_FAIL, THREE_FIRE, {
      ...TEN_ROUNDS,
      ...EACH_TURN_END
    })
  )
)
const hide = catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE)
const grappleEffect = catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.GRAPPLE)
const grapple = pinned(compileEffect(grappleEffect))
const [grappleHold] = grappleEffect.paths.flatMap((path) =>
  'resultBlock' in path ? path.resultBlock.outcomes : []
)

function lasting(lifetime: Dnd5eLifetime | null) {
  if (!lifetime) throw new Error('Expected the action to hold a lifetime.')
  return lifetime
}

describe('the lifetime aspect chooses one plan for what an action leaves behind (QUALITY-15.T1c)', () => {
  it('holds a failed save that recurs each turn in a recurring plan frozen as its failure node', () => {
    const { kind, plan } = lasting(dnd5eLifetime(burning, NO_COMPILER_PLAN))
    expect(kind).toBe('RECURRING')
    expect(plan).toMatchObject({
      frozenGraphNodeId: 'proposal-on_save_fail',
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      maintenance: null
    })
  })

  it('holds a Hide in an unmaintained concealment, and nothing for an instant result', () => {
    const { kind, plan } = lasting(
      dnd5eLifetime(characterActionDescriptor(compileEffect(hide)), NO_COMPILER_PLAN)
    )
    expect(kind).toBe('CONCEALMENT')
    expect(plan).toMatchObject({ frozenGraphNodeId: 'conceal', maintenance: null })
    const instant = characterActionDescriptor(
      compileEffect(authoredAction(SAVING_THROW, PATH_CODE.ON_SAVE_FAIL, THREE_FIRE))
    )
    expect(dnd5eLifetime(instant, NO_COMPILER_PLAN)).toBeNull()
  })

  it('prefers a repeated save to a duration, and asks for no duration once it has one', () => {
    const repeat = dnd5eRecurringPlan(burning)
    const lifetime = dnd5eLifetime(burning, {
      ...NO_COMPILER_PLAN,
      repeatSave: () => repeat,
      timed: () => {
        throw new Error('A repeated save leaves no duration to plan.')
      }
    })
    expect(lifetime?.kind).toBe('REPEAT_SAVE')
  })

  it('prefers a plan the compiler builds to a recurrence of the same result', () => {
    const timed = dnd5eRecurringPlan(burning)
    expect(dnd5eLifetime(burning, { ...NO_COMPILER_PLAN, timed: () => timed })?.kind).toBe('TIMED')
  })

  it('holds a relationship in its own graph, and refuses a save or duration plan beside it', () => {
    const hold = relationshipPlan(grapple)
    const relationshipOnly = { ...NO_COMPILER_PLAN, relationship: () => hold }
    const { kind, plan } = lasting(dnd5eLifetime(grapple, relationshipOnly))
    expect(kind).toBe('RELATIONSHIP')
    expect(plan).toBe(hold)
    const timed = dnd5eRecurringPlan(burning)
    for (const beside of [{ timed: () => timed }, { repeatSave: () => timed }])
      expect(() => dnd5eLifetime(grapple, { ...relationshipOnly, ...beside })).toThrow(
        'D&D relationship cannot share an action with another lasting effect.'
      )
  })

  it('holds an entry lifetime in every plan but a relationship, whose hold ends on its own release', () => {
    const plan = dnd5eRecurringPlan(burning)
    if (!plan) throw new Error('Expected the burn to recur.')
    const hold = relationshipPlan(grapple)
    if (!hold) throw new Error('Expected Grapple to hold its target.')
    expect(holdsEntryLifetime(null)).toBe(false)
    expect(holdsEntryLifetime({ kind: 'RELATIONSHIP', plan: hold })).toBe(false)
    for (const kind of ['REPEAT_SAVE', 'TIMED', 'RECURRING', 'CONCEALMENT'] as const)
      expect(holdsEntryLifetime({ kind, plan })).toBe(true)
  })
})

describe('the compiler holds lifetimes by the aspect (QUALITY-15.T1c admissions)', () => {
  const plainHide = characterActionDescriptor(compileEffect(hide))
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action: plainHide })

  it('plans a Hide as a concealment with no maintenance link', () => {
    const [plan] =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action: plainHide, published }) ??
      []
    expect(plan?.concealmentContribution).toBeDefined()
    expect(plan?.maintenance).toBeNull()
  })

  it('refuses a Hide under Concentration, whose check would settle the concealment unmaintained', () => {
    const action = characterActionDescriptor({
      ...compileEffect(hide),
      requiresConcentration: true
    })
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published })
    ).toThrow(MAINTAINED_CONCEALMENT)
    expect(() => dnd5eCharacterRuleActionSystemAdapter.compile({ action })).toThrow(
      MAINTAINED_CONCEALMENT
    )
  })

  it('refuses a used hold whose result block authors a recurrence its relationship plan drops', () => {
    if (!grappleHold) throw new Error('Grapple holds no relationship.')
    const held = (block: Record<string, unknown>) =>
      pinned(
        compileEffect(
          authoredAction({ triggerCode: TRIGGER.ACTIVATED }, PATH_CODE.ON_USE, grappleHold, block)
        )
      )
    expect(() => dnd5eCharacterRuleActionSystemAdapter.compile({ action: held({}) })).not.toThrow()
    expect(() =>
      dnd5eCharacterRuleActionSystemAdapter.compile({
        action: held({ ...TEN_ROUNDS, ...EACH_TURN_END })
      })
    ).toThrow(ONE_RESULT)
  })
})
