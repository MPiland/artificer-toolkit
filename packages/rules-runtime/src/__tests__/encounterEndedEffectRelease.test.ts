import { describe, expect, it } from 'vitest'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  ENDED_EFFECT_CONDITION_OPERATION_KEY,
  actionEndedEffects,
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
      makesAttackRoll: true
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
        makesAttackRoll: false
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
  })

  it('leaves an effect that does not end on an attack roll', () => {
    expect(
      actionEndedEffects({
        holderActorId: HOLDER_ID,
        held: [rollerEffect(FIRST_ID, undefined)],
        makesAttackRoll: true
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
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
        castsSpell: true
      })
    ).toEqual({ consumedGrants: [], sourceReleases: [] })
  })

  it('ends nothing when the action is no cast', () => {
    expect(
      actionEndedEffects({
        holderActorId: HOLDER_ID,
        held: [invisibility(FIRST_ID)],
        makesAttackRoll: false
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
