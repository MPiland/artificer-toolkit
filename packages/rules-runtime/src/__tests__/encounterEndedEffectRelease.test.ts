import { describe, expect, it } from 'vitest'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { ENDED_EFFECT_CONDITION_OPERATION_KEY } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import {
  actionEndedEffects,
  damageTakenEndedEffects,
  endedEffectConditionReleases
} from '../encounterEndedEffectRelease.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const INVISIBLE = conditionId('INVISIBLE')
const CHARMED = conditionId('CHARMED')

const HOLDER_ID = '00000000-0000-4000-8000-00000000f201'
const FIRST_ID = '00000000-0000-4000-8000-00000000f2a1'
const SECOND_ID = '00000000-0000-4000-8000-00000000f2a2'

const owner = {
  kind: 'ENCOUNTER_ACTOR' as const,
  encounterId: ENCOUNTER_ID,
  targetActorId: HOLDER_ID
}

function owning(id: string, conditions: Record<string, boolean>, createdOrdinal = 1) {
  const [first, ...rest] = Object.entries(conditions).map(
    ([conditionIdValue, baselinePresent]) => ({
      kind: 'CONDITION_OWNERSHIP' as const,
      conditionId: conditionIdValue,
      baselinePresent
    })
  )
  if (!first) throw new Error('An owning effect needs at least one condition.')
  return activeEffect({ id, owner, createdOrdinal, stateContributions: [first, ...rest] })
}

describe('conditions released with the effects an event ended', () => {
  it('releases the condition the ended effect alone held, naming the effect that owned it', () => {
    const ended = owning(FIRST_ID, { [INVISIBLE]: false })
    expect(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [ended], ended: [ended] })
    ).toEqual([
      {
        kind: 'CONDITION_REMOVE',
        conditionId: INVISIBLE,
        sourceActiveEffectId: FIRST_ID,
        targetActorId: HOLDER_ID,
        sourceNodeId: ended.definition.frozenGraphNodeId,
        sourceOperationKey: ENDED_EFFECT_CONDITION_OPERATION_KEY,
        authoredPath: null,
        resolvedPath: null
      }
    ])
  })

  it('keeps a condition the holder had before the effect', () => {
    const ended = owning(FIRST_ID, { [INVISIBLE]: true })
    expect(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [ended], ended: [ended] })
    ).toEqual([])
  })

  it('keeps a condition another effect on the holder still owns', () => {
    const ended = owning(FIRST_ID, { [INVISIBLE]: false })
    const remaining = owning(SECOND_ID, { [INVISIBLE]: false }, 2)
    expect(
      endedEffectConditionReleases({
        holderActorId: HOLDER_ID,
        held: [ended, remaining],
        ended: [ended]
      })
    ).toEqual([])
  })

  it('releases several conditions in a stable order, each citing its own owner', () => {
    const first = owning(FIRST_ID, { [INVISIBLE]: false })
    const second = owning(SECOND_ID, { [CHARMED]: false }, 2)
    const released = endedEffectConditionReleases({
      holderActorId: HOLDER_ID,
      held: [first, second],
      ended: [second, first]
    })
    expect(released.map(({ conditionId: id }) => id)).toEqual([INVISIBLE, CHARMED].sort())
    expect(
      Object.fromEntries(released.map((entry) => [entry.conditionId, entry.sourceActiveEffectId]))
    ).toEqual({ [INVISIBLE]: FIRST_ID, [CHARMED]: SECOND_ID })
  })

  it('releases nothing when no effect ended or the ended effect owns no condition', () => {
    const held = owning(FIRST_ID, { [INVISIBLE]: false })
    expect(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [held], ended: [] })
    ).toEqual([])
    const plain = activeEffect({
      id: SECOND_ID,
      owner,
      createdOrdinal: 2,
      stateContributions: [
        {
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          amount: 3,
          sourceDamageOutcomeId: '00000000-0000-4000-8000-00000000f2a9',
          sourceDamageNodeId: 'damage',
          sourceDamageOperationKey: 'damage',
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'],
          sourceLabel: 'Slam',
          sourceHidden: false
        }
      ]
    })
    expect(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [plain], ended: [plain] })
    ).toEqual([])
  })
})

describe('what an attack roll ends for its roller', () => {
  const rollerEffect = (
    id: string,
    consumeOnFirstEvents: readonly 'ON_ATTACK_ROLL'[] | undefined
  ) =>
    activeEffect({
      id,
      owner,
      createdOrdinal: 1,
      consumeOnFirstEvents,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })

  it('ends the one-roll effect and releases the condition it owned', () => {
    const held = rollerEffect(FIRST_ID, ['ON_ATTACK_ROLL'])
    const { consumedGrants, sourceReleases } = actionEndedEffects({
      holderActorId: HOLDER_ID,
      held: [held],
      makesAttackRoll: true,
      againstEnemy: false
    })
    expect(consumedGrants).toEqual([held])
    expect(sourceReleases).toEqual(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
    )
    expect(sourceReleases).toHaveLength(1)
  })

  it('ends and releases nothing when the action rolls no attack', () => {
    expect(
      actionEndedEffects({
        holderActorId: HOLDER_ID,
        held: [rollerEffect(FIRST_ID, ['ON_ATTACK_ROLL'])],
        makesAttackRoll: false,
        againstEnemy: false
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
  })

  it('leaves an effect that does not end on an attack roll', () => {
    expect(
      actionEndedEffects({
        holderActorId: HOLDER_ID,
        held: [rollerEffect(FIRST_ID, undefined)],
        makesAttackRoll: true,
        againstEnemy: false
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
  })
})

describe('what damage ends on its target', () => {
  const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
  const COLD = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'COLD')!.id
  const SOURCE_ID = '00000000-0000-4000-8000-00000000f301'
  const SOURCE_ALLY_ID = '00000000-0000-4000-8000-00000000f302'
  const STRANGER_ID = '00000000-0000-4000-8000-00000000f303'
  const dispositions = new Map<string, 'FRIENDLY' | 'HOSTILE' | 'NEUTRAL'>([
    [HOLDER_ID, 'HOSTILE'],
    [SOURCE_ID, 'FRIENDLY'],
    [SOURCE_ALLY_ID, 'FRIENDLY'],
    [STRANGER_ID, 'HOSTILE']
  ])

  const damage = (damageTypeId: string, resolvedAmount = 4): CharacterRuleActionApplication => ({
    kind: 'DAMAGE',
    damageTypeId,
    damageDisposition: 'NORMAL',
    critical: false,
    sourceNodeId: 'damage',
    sourceOperationKey: 'damage',
    authoredPath: null,
    resolvedPath: null,
    requestedAmount: 4,
    resolvedAmount,
    appliedAmount: resolvedAmount,
    beforeCurrentHitPoints: 20,
    afterCurrentHitPoints: 20 - resolvedAmount,
    beforeTemporaryHitPoints: 0,
    afterTemporaryHitPoints: 0,
    maximumHitPoints: 20,
    targetActorId: HOLDER_ID
  })

  const sleeper = (
    id: string,
    endOnTriggers: Parameters<typeof activeEffect>[0]['endOnTriggers'],
    createdOrdinal = 1
  ) =>
    activeEffect({
      id,
      owner,
      createdOrdinal,
      endOnTriggers,
      sourceActorId: SOURCE_ID,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
  const anyDamage = [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }] as const
  const sourceSideDamage = [
    { event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null }
  ] as const

  const taken = (
    held: ReturnType<typeof sleeper>[],
    applications: CharacterRuleActionApplication[],
    damagerActorId = STRANGER_ID
  ) =>
    damageTakenEndedEffects({
      holderActorId: HOLDER_ID,
      held,
      applications,
      damagerActorId,
      dispositions
    })

  it('ends the effect when anyone damages its holder, and releases the condition it owned', () => {
    const held = sleeper(FIRST_ID, anyDamage)
    const { endedEffects, releases } = taken([held], [damage(FIRE)])
    expect(endedEffects).toEqual([held])
    expect(releases).toEqual(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
    )
    expect(releases).toHaveLength(1)
  })

  it('ends nothing when no damage is dealt or all of it is resisted away', () => {
    const held = sleeper(FIRST_ID, anyDamage)
    expect(taken([held], [])).toEqual({ endedEffects: [], releases: [] })
    expect(taken([held], [damage(FIRE, 0)])).toEqual({ endedEffects: [], releases: [] })
  })

  it('ignores damage dealt to another actor', () => {
    const held = sleeper(FIRST_ID, anyDamage)
    expect(taken([held], [{ ...damage(FIRE), targetActorId: STRANGER_ID }])).toEqual({
      endedEffects: [],
      releases: []
    })
  })

  it('ends only on the damage types the trigger names', () => {
    const held = sleeper(FIRST_ID, [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: [FIRE] }])
    expect(taken([held], [damage(COLD)]).endedEffects).toEqual([])
    expect(taken([held], [damage(COLD), damage(FIRE)]).endedEffects).toEqual([held])
  })

  it('counts the source and its allies as the source side, and no one else', () => {
    const held = sleeper(FIRST_ID, sourceSideDamage)
    expect(taken([held], [damage(FIRE)], SOURCE_ID).endedEffects).toEqual([held])
    expect(taken([held], [damage(FIRE)], SOURCE_ALLY_ID).endedEffects).toEqual([held])
    expect(taken([held], [damage(FIRE)], STRANGER_ID).endedEffects).toEqual([])
  })

  it('leaves an effect with no damage trigger and keeps a condition another effect owns', () => {
    const ended = sleeper(FIRST_ID, anyDamage)
    const untriggered = sleeper(SECOND_ID, [], 2)
    const { endedEffects, releases } = taken([ended, untriggered], [damage(FIRE)])
    expect(endedEffects).toEqual([ended])
    expect(releases).toEqual([])
  })
})

describe('what a spell cast ends for its caster (SPELLS-27.T3)', () => {
  const invisibility = (id: string) =>
    activeEffect({
      id,
      owner,
      createdOrdinal: 1,
      endOnEvents: ['ON_ATTACK_ROLL', 'ON_CAST_SPELL'],
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })

  it('ends an effect that lasts until a cast, and releases the condition it owned', () => {
    const held = invisibility(FIRST_ID)
    const { consumedGrants, sourceReleases } = actionEndedEffects({
      holderActorId: HOLDER_ID,
      held: [held],
      makesAttackRoll: false,
      againstEnemy: false,
      castsSpell: true
    })
    expect(consumedGrants).toEqual([held])
    expect(sourceReleases).toEqual(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
    )
  })

  it('ends an effect once when the cast is also an attack roll', () => {
    const held = invisibility(FIRST_ID)
    const { consumedGrants, sourceReleases } = actionEndedEffects({
      holderActorId: HOLDER_ID,
      held: [held],
      makesAttackRoll: true,
      againstEnemy: false,
      castsSpell: true
    })
    expect(consumedGrants).toEqual([held])
    expect(sourceReleases).toHaveLength(1)
  })

  it('leaves an effect that ends only on an attack roll when a spell is cast without one', () => {
    const rollOnly = activeEffect({
      id: FIRST_ID,
      owner,
      createdOrdinal: 1,
      consumeOnFirstEvents: ['ON_ATTACK_ROLL'],
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
    expect(
      actionEndedEffects({
        holderActorId: HOLDER_ID,
        held: [rollOnly],
        makesAttackRoll: false,
        againstEnemy: false,
        castsSpell: true
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
  })

  it('ends nothing when the action is no cast', () => {
    expect(
      actionEndedEffects({
        holderActorId: HOLDER_ID,
        held: [invisibility(FIRST_ID)],
        makesAttackRoll: false,
        againstEnemy: false
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
  })
})

describe('what an attack roll or cast against an enemy ends (SPELLS-27.T4b)', () => {
  const sanctuary = (trigger: { event: 'ATTACK_ROLL' | 'SPELL_CAST'; against: 'ENEMY' }) =>
    activeEffect({
      id: FIRST_ID,
      owner,
      createdOrdinal: 1,
      endOnTriggers: [trigger],
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
  const attackEnds = { event: 'ATTACK_ROLL', against: 'ENEMY' } as const
  const castEnds = { event: 'SPELL_CAST', against: 'ENEMY' } as const

  it.each([
    ['an attack roll against an enemy', attackEnds, { makesAttackRoll: true, againstEnemy: true }],
    ['a cast that affects an enemy', castEnds, { castsSpell: true, againstEnemy: true }],
    [
      'a spell attack against an enemy, for a cast trigger',
      castEnds,
      { makesAttackRoll: true, castsSpell: true, againstEnemy: true }
    ]
  ])('ends and releases on %s', (_label, trigger, action) => {
    const held = sanctuary(trigger)
    const { consumedGrants, sourceReleases } = actionEndedEffects({
      holderActorId: HOLDER_ID,
      held: [held],
      makesAttackRoll: false,
      castsSpell: false,
      ...action
    })
    expect(consumedGrants).toEqual([held])
    expect(sourceReleases).toEqual(
      endedEffectConditionReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
    )
  })

  it.each([
    ['an attack roll against no enemy', attackEnds, { makesAttackRoll: true, againstEnemy: false }],
    ['a cast that affects no enemy', castEnds, { castsSpell: true, againstEnemy: false }],
    [
      'a cast, for an effect ending on an attack roll',
      attackEnds,
      { castsSpell: true, againstEnemy: true }
    ],
    [
      'an attack roll, for an effect ending on a cast',
      castEnds,
      { makesAttackRoll: true, againstEnemy: true }
    ]
  ])('keeps the effect on %s', (_label, trigger, action) => {
    expect(
      actionEndedEffects({
        holderActorId: HOLDER_ID,
        held: [sanctuary(trigger)],
        makesAttackRoll: false,
        castsSpell: false,
        ...action
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
  })
})

describe('a condition-owning effect’s end events', () => {
  const definitionEnding = (field: 'consumeOnFirstEvents' | 'endOnEvents', events: string[]) => {
    const { definition } = activeEffect({
      id: FIRST_ID,
      owner,
      createdOrdinal: 1,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
    return { ...definition, recurrence: { ...definition.recurrence, [field]: events } }
  }

  it('may end on an attack roll, whose consumer releases the condition', () => {
    for (const field of ['consumeOnFirstEvents', 'endOnEvents'] as const)
      expect(
        activeRuleEffectDefinitionDtoSchema.safeParse(definitionEnding(field, ['ON_ATTACK_ROLL']))
          .success
      ).toBe(true)
  })

  it.each([
    ['consumeOnFirstEvents', 'ON_ABILITY_CHECK'],
    ['endOnEvents', 'ON_HIT_POINTS_REGAINED'],
    ['endOnEvents', 'ON_INCAPACITATED']
  ] as const)('cannot list %s %s, whose consumer would strand the condition', (field, event) => {
    const parsed = activeRuleEffectDefinitionDtoSchema.safeParse(definitionEnding(field, [event]))
    expect(parsed.success).toBe(false)
    expect(JSON.stringify(parsed.error?.issues)).toContain(
      `Condition-owning effects cannot end on ${event}`
    )
  })
})
