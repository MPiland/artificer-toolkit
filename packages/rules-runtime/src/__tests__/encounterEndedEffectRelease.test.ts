import { describe, expect, it } from 'vitest'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { ENDED_EFFECT_RELEASE_OPERATION_KEY } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import {
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  actionEndedEffects,
  actionUsedOnHolderEndedEffects,
  endedEffectReleases,
  expiredEffectReleases,
  moveEndHolds,
  endEffectsCandidates,
  endEffectsChoice,
  offerEndEffects,
  selectedEndedEffects,
  targetEndedEffects,
  withOwnedTemporaryHitPoints
} from '../encounterEndedEffectRelease.js'
import { effectEventScope, isInEffectEventScope } from '../events/encounterEventHooks.js'
import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const creatureTypeId = (code: string) => SRD_CREATURE_TYPES.find((entry) => entry.code === code)!.id
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

function owning(
  id: string,
  conditions: Record<string, boolean>,
  createdOrdinal = 1,
  linkedEffectId: string | null = null,
  sourceActorId: string | null = null
) {
  const [first, ...rest] = Object.entries(conditions).map(
    ([conditionIdValue, baselinePresent]) => ({
      kind: 'CONDITION_OWNERSHIP' as const,
      conditionId: conditionIdValue,
      baselinePresent
    })
  )
  if (!first) throw new Error('An owning effect needs at least one condition.')
  return activeEffect({
    id,
    owner,
    createdOrdinal,
    linkedEffectId,
    sourceActorId,
    stateContributions: [first, ...rest]
  })
}

describe('conditions released with the effects an event ended', () => {
  it('releases the condition the ended effect alone held, naming the effect that owned it', () => {
    const ended = owning(FIRST_ID, { [INVISIBLE]: false })
    expect(
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [ended], ended: [ended] })
    ).toEqual([
      {
        kind: 'CONDITION_REMOVE',
        conditionId: INVISIBLE,
        sourceActiveEffectId: FIRST_ID,
        targetActorId: HOLDER_ID,
        sourceNodeId: ended.definition.frozenGraphNodeId,
        sourceOperationKey: ENDED_EFFECT_RELEASE_OPERATION_KEY,
        authoredPath: null,
        resolvedPath: null
      }
    ])
  })

  it('keeps a condition the holder had before the effect', () => {
    const ended = owning(FIRST_ID, { [INVISIBLE]: true })
    expect(
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [ended], ended: [ended] })
    ).toEqual([])
  })

  it('keeps a condition another effect on the holder still owns', () => {
    const ended = owning(FIRST_ID, { [INVISIBLE]: false })
    const remaining = owning(SECOND_ID, { [INVISIBLE]: false }, 2)
    expect(
      endedEffectReleases({
        holderActorId: HOLDER_ID,
        held: [ended, remaining],
        ended: [ended]
      })
    ).toEqual([])
  })

  it('releases several conditions in a stable order, each citing its own owner', () => {
    const first = owning(FIRST_ID, { [INVISIBLE]: false })
    const second = owning(SECOND_ID, { [CHARMED]: false }, 2)
    const released = endedEffectReleases({
      holderActorId: HOLDER_ID,
      held: [first, second],
      ended: [second, first]
    })
    const conditionIdOf = (entry: (typeof released)[number]) =>
      entry.kind === 'CONDITION_REMOVE' ? entry.conditionId : entry.kind
    expect(released.map(conditionIdOf)).toEqual([INVISIBLE, CHARMED].sort())
    expect(
      Object.fromEntries(
        released.map((entry) => [conditionIdOf(entry), entry.sourceActiveEffectId])
      )
    ).toEqual({ [INVISIBLE]: FIRST_ID, [CHARMED]: SECOND_ID })
  })

  it('releases nothing when no effect ended or the ended effect owns no condition', () => {
    const held = owning(FIRST_ID, { [INVISIBLE]: false })
    expect(endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [] })).toEqual([])
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
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [plain], ended: [plain] })
    ).toEqual([])
  })
})

describe('temporary hit points released with the effects that gave them (D156)', () => {
  const owningTemporary = (id: string) =>
    activeEffect({
      id,
      owner,
      createdOrdinal: 1,
      stateContributions: [{ kind: 'TEMPORARY_HIT_POINTS_OWNERSHIP' }]
    })
  const release = (effect: ReturnType<typeof owningTemporary>) => ({
    kind: 'TEMPORARY_HIT_POINTS_RELEASE',
    sourceActiveEffectId: effect.id,
    targetActorId: HOLDER_ID,
    sourceNodeId: effect.definition.frozenGraphNodeId,
    sourceOperationKey: ENDED_EFFECT_RELEASE_OPERATION_KEY,
    authoredPath: null,
    resolvedPath: null
  })

  it('releases the temporary hit points of each event-ended effect that owns them, after its conditions', () => {
    const conditions = owning(FIRST_ID, { [INVISIBLE]: false })
    const temporary = owningTemporary(SECOND_ID)
    expect(
      endedEffectReleases({
        holderActorId: HOLDER_ID,
        held: [conditions, temporary],
        ended: [temporary, conditions]
      }).map(({ kind, sourceActiveEffectId }) => [kind, sourceActiveEffectId])
    ).toEqual([
      ['CONDITION_REMOVE', FIRST_ID],
      ['TEMPORARY_HIT_POINTS_RELEASE', SECOND_ID]
    ])
  })

  it('releases only the temporary hit points of an effect that expires at a turn boundary', () => {
    const conditions = owning(FIRST_ID, { [INVISIBLE]: false })
    const temporary = owningTemporary(SECOND_ID)
    expect(expiredEffectReleases(temporary, HOLDER_ID)).toEqual([release(temporary)])
    expect(expiredEffectReleases(conditions, HOLDER_ID)).toEqual([])
  })

  it('marks the temporary hit points an owning effect gives as its own, and no other application', () => {
    const base = {
      sourceNodeId: 'entry',
      sourceOperationKey: 'dnd5e.temporary-hit-points-proposal',
      authoredPath: null,
      resolvedPath: null,
      requestedAmount: 3,
      resolvedAmount: 3,
      appliedAmount: 3,
      beforeCurrentHitPoints: 5,
      afterCurrentHitPoints: 5,
      beforeTemporaryHitPoints: 0,
      afterTemporaryHitPoints: 3,
      targetActorId: HOLDER_ID
    }
    const applications = [
      { ...base, kind: 'TEMPORARY_HIT_POINTS' },
      { ...base, kind: 'HEAL' }
    ] as CharacterRuleActionApplication[]
    expect(withOwnedTemporaryHitPoints(applications, owningTemporary(SECOND_ID))).toEqual([
      { ...applications[0], sourceActiveEffectId: SECOND_ID },
      applications[1]
    ])
    expect(
      withOwnedTemporaryHitPoints(applications, owning(FIRST_ID, { [INVISIBLE]: false }))
    ).toEqual(applications)
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
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
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

describe('what an action ends on its target', () => {
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
    targetEndedEffects({
      holderActorId: HOLDER_ID,
      held,
      attacked: false,
      testEvidence: [],
      turnActorId: null,
      applications,
      damagerActorId,
      dispositions
    })

  it('ends the effect when anyone damages its holder, and releases the condition it owned', () => {
    const held = sleeper(FIRST_ID, anyDamage)
    const { endedEffects, releases } = taken([held], [damage(FIRE)])
    expect(endedEffects).toEqual([held])
    expect(releases).toEqual(
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
    )
    expect(releases).toHaveLength(1)
  })

  it('ends nothing when no damage is dealt or all of it is resisted away', () => {
    const held = sleeper(FIRST_ID, anyDamage)
    expect(taken([held], [])).toEqual({ endedEffects: [], releases: [], grants: [] })
    expect(taken([held], [damage(FIRE, 0)])).toEqual({
      endedEffects: [],
      releases: [],
      grants: []
    })
  })

  it('ignores damage dealt to another actor', () => {
    const held = sleeper(FIRST_ID, anyDamage)
    expect(taken([held], [{ ...damage(FIRE), targetActorId: STRANGER_ID }])).toEqual({
      endedEffects: [],
      releases: [],
      grants: []
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

  describe('an attack roll against the holder (ON_ATTACKED, SPELLS-4.T2a3)', () => {
    const marked = (consumeOnFirstEvents: readonly ('ON_ATTACKED' | 'ON_ATTACK_ROLL')[]) =>
      activeEffect({
        id: FIRST_ID,
        owner,
        createdOrdinal: 1,
        consumeOnFirstEvents,
        endOnTriggers: anyDamage,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
        ]
      })
    const attackedBy = (
      held: ReturnType<typeof marked>[],
      attacked: boolean,
      applications: CharacterRuleActionApplication[] = []
    ) =>
      targetEndedEffects({
        holderActorId: HOLDER_ID,
        held,
        attacked,
        testEvidence: [],
        turnActorId: null,
        applications,
        damagerActorId: STRANGER_ID,
        dispositions
      })

    it('uses the effect up on a miss, and releases the condition it owned', () => {
      const held = marked(['ON_ATTACKED'])
      const { endedEffects, releases } = attackedBy([held], true)
      expect(endedEffects).toEqual([held])
      expect(releases).toEqual(
        endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
      )
      expect(releases).toHaveLength(1)
    })

    it('ends the effect once when the attack also damages the holder', () => {
      const held = marked(['ON_ATTACKED'])
      const { endedEffects, releases } = attackedBy([held], true, [damage(FIRE)])
      expect(endedEffects).toEqual([held])
      expect(releases).toHaveLength(1)
    })

    it('leaves the effect for an action without an attack roll, or one the holder makes', () => {
      expect(attackedBy([marked(['ON_ATTACKED'])], false)).toEqual({
        endedEffects: [],
        releases: [],
        grants: []
      })
      expect(attackedBy([marked(['ON_ATTACK_ROLL'])], true)).toEqual({
        endedEffects: [],
        releases: [],
        grants: []
      })
    })
  })

  describe('an attack consume scoped to the effect’s source and its final turn (SPELLS-4.T2k1)', () => {
    const SOURCE_ID = '00000000-0000-4000-8000-00000000f304'
    // A True Strike-style mark: met only by its source, and only on the source's final counted turn.
    const scoped = (remainingTicks: number, sourceActorId: string | null = SOURCE_ID) => {
      const base = activeEffect({
        id: FIRST_ID,
        owner,
        createdOrdinal: 1,
        consumeOnFirstEvents: ['ON_ATTACKED'],
        sourceActorId,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
        ]
      })
      return {
        ...base,
        definition: {
          ...base.definition,
          recurrence: {
            ...base.definition.recurrence,
            recurrenceStage: 'END_OF_TURN' as const,
            fromSourceOnly: true as const,
            activeOnlyOnFinalAnchorTurn: true as const,
            expiration: {
              kind: 'TICKS' as const,
              initialRemaining: 2,
              decrementStage: 'END_OF_TURN' as const,
              anchor: 'SOURCE' as const
            }
          }
        },
        lifecycle: { schemaVersion: 1 as const, remainingTicks }
      }
    }
    const attackBy = (
      held: ReturnType<typeof scoped>,
      damagerActorId: string,
      turnActorId: string | null
    ) =>
      targetEndedEffects({
        holderActorId: HOLDER_ID,
        held: [held],
        attacked: true,
        testEvidence: [],
        turnActorId,
        applications: [],
        damagerActorId,
        dispositions
      }).endedEffects

    it('admits only the source, and only on its final counted turn', () => {
      expect(effectEventScope(scoped(2), HOLDER_ID)).toBeNull()
      expect(effectEventScope(scoped(1), HOLDER_ID)).toEqual({
        actorId: SOURCE_ID,
        turnActorId: SOURCE_ID
      })
      expect(effectEventScope(scoped(1, null), HOLDER_ID)).toBeNull()
      expect(
        isInEffectEventScope(
          { actorId: null, turnActorId: null },
          { actorId: STRANGER_ID, turnActorId: null }
        )
      ).toBe(true)
    })

    it('is used up by the source’s attack on its final turn', () => {
      const held = scoped(1)
      expect(attackBy(held, SOURCE_ID, SOURCE_ID)).toEqual([held])
    })

    it('is not used up by another attacker, by the source on another turn, or before its final turn', () => {
      expect(attackBy(scoped(1), STRANGER_ID, SOURCE_ID)).toEqual([])
      expect(attackBy(scoped(1), SOURCE_ID, STRANGER_ID)).toEqual([])
      expect(attackBy(scoped(2), SOURCE_ID, SOURCE_ID)).toEqual([])
    })
  })
})

describe('what another creature rousing the holder ends (SPELLS-27.T12)', () => {
  const ROUSE_ID = '00000000-0000-4000-8000-000000000b0a'
  const STRANGER_ID = '00000000-0000-4000-8000-00000000f2b1'
  const sleeper = (id: string, actionDefinitionIds: string[], createdOrdinal = 1) =>
    activeEffect({
      id,
      owner,
      createdOrdinal,
      endOnTriggers: [{ event: 'ACTION_USED_ON_HOLDER', actionDefinitionIds }],
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
  const roused = (
    held: ReturnType<typeof sleeper>[],
    basicActionDefinitionId: string,
    usedByActorId = STRANGER_ID
  ) =>
    actionUsedOnHolderEndedEffects({
      holderActorId: HOLDER_ID,
      held,
      usedByActorId,
      basicActionDefinitionId
    })

  it('ends the effect naming the action and releases the condition it owned', () => {
    const held = sleeper(FIRST_ID, [ROUSE_ID])
    const { endedEffects, releases } = roused([held], ROUSE_ID)
    expect(endedEffects).toEqual([held])
    expect(releases).toEqual(
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
    )
    expect(releases).toHaveLength(1)
  })

  it('ends nothing for an action the trigger does not name', () => {
    const held = sleeper(FIRST_ID, [ROUSE_ID])
    expect(roused([held], '00000000-0000-4000-8000-000000000b04')).toEqual({
      endedEffects: [],
      releases: []
    })
  })

  it('ends nothing when the holder uses the action on itself', () => {
    const held = sleeper(FIRST_ID, [ROUSE_ID])
    expect(roused([held], ROUSE_ID, HOLDER_ID)).toEqual({ endedEffects: [], releases: [] })
  })

  it('leaves an effect with no such trigger and keeps a condition another effect owns', () => {
    const ended = sleeper(FIRST_ID, [ROUSE_ID])
    const untriggered = activeEffect({
      id: SECOND_ID,
      owner,
      createdOrdinal: 2,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
    const { endedEffects, releases } = roused([ended, untriggered], ROUSE_ID)
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
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
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
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
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

describe('what taking an action or moving ends for the holder', () => {
  const hiding = (id: string, endOnEvents: readonly ('ON_MOVE' | 'ON_TAKE_ACTION')[]) =>
    activeEffect({
      id,
      owner,
      createdOrdinal: 1,
      endOnEvents,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
  const taking = (held: ReturnType<typeof hiding>[]) =>
    actionEndedEffects({
      holderActorId: HOLDER_ID,
      held,
      makesAttackRoll: false,
      againstEnemy: false
    })

  it('ends an effect that lasts until its holder takes an action, releasing the condition it owned', () => {
    const held = hiding(FIRST_ID, ['ON_MOVE', 'ON_TAKE_ACTION'])
    const { consumedGrants, sourceReleases } = taking([held])
    expect(consumedGrants).toEqual([held])
    expect(sourceReleases).toEqual(
      endedEffectReleases({ holderActorId: HOLDER_ID, held: [held], ended: [held] })
    )
    expect(sourceReleases).toHaveLength(1)
  })

  it('leaves an effect that ends only when its holder moves', () => {
    expect(taking([hiding(FIRST_ID, ['ON_MOVE'])])).toEqual({
      consumedGrants: [],
      sourceReleases: []
    })
  })

  it('names the holders whose effects a voluntary move ends, and no others', () => {
    const moving = hiding(FIRST_ID, ['ON_MOVE', 'ON_TAKE_ACTION'])
    const staying = hiding(SECOND_ID, ['ON_TAKE_ACTION'])
    expect(
      moveEndHolds([
        { actor: { id: HOLDER_ID }, activeEffects: [moving, staying] },
        { actor: { id: SECOND_ID }, activeEffects: [staying] }
      ])
    ).toEqual([{ actorId: HOLDER_ID, effectId: FIRST_ID }])
  })

  it('accepts both events on a condition-owning effect, whose consumers release the condition', () => {
    const { definition } = hiding(FIRST_ID, [])
    expect(
      activeRuleEffectDefinitionDtoSchema.safeParse({
        ...definition,
        recurrence: { ...definition.recurrence, endOnEvents: ['ON_MOVE', 'ON_TAKE_ACTION'] }
      }).success
    ).toBe(true)
  })
})

describe('effects an authored END_EFFECTS outcome ends (SPELLS-4.T2f)', () => {
  const THIRD_ID = '00000000-0000-4000-8000-00000000f2a3'
  const POISONED = conditionId('POISONED')
  const select = (input: {
    held: ReturnType<typeof owning>[]
    scope: 'ALL' | 'ONE_CHOSEN'
    chosenEffectId?: string
    conditionIds: string[]
  }) =>
    selectedEndedEffects({
      holderActorId: HOLDER_ID,
      held: input.held,
      selectors: [{ kind: 'CONDITION', conditionIds: input.conditionIds }],
      actorCreatureTypeIds: new Map(),
      scope: input.scope,
      chosenEffectId: input.chosenEffectId
    })

  it('ends every held effect owning a selected condition, and releases what only they held', () => {
    const charm = owning(FIRST_ID, { [CHARMED]: false })
    const poison = owning(SECOND_ID, { [POISONED]: false })
    const { endedEffects, releases } = select({
      held: [charm, poison],
      scope: 'ALL',
      conditionIds: [CHARMED]
    })
    expect(endedEffects.map(({ id }) => id)).toEqual([FIRST_ID])
    expect(releases.map((release) => release.kind)).toEqual(['CONDITION_REMOVE'])
  })

  it('ends only the chosen effect under ONE_CHOSEN, and nothing for a choice that does not match', () => {
    const first = owning(FIRST_ID, { [POISONED]: false })
    const second = owning(SECOND_ID, { [POISONED]: false })
    const base = { held: [first, second], scope: 'ONE_CHOSEN' as const, conditionIds: [POISONED] }
    expect(select({ ...base, chosenEffectId: SECOND_ID }).endedEffects.map(({ id }) => id)).toEqual(
      [SECOND_ID]
    )
    expect(select({ ...base, chosenEffectId: THIRD_ID }).endedEffects).toEqual([])
  })

  it('lists the candidates and auto-picks a sole match, flags none, and demands a legal pick for several', () => {
    const first = owning(FIRST_ID, { [POISONED]: false })
    const second = owning(SECOND_ID, { [POISONED]: false })
    const selectors = [{ kind: 'CONDITION' as const, conditionIds: [POISONED] }]
    const none = endEffectsCandidates(
      [owning(THIRD_ID, { [CHARMED]: false })],
      selectors,
      new Map()
    )
    expect(endEffectsChoice(none, undefined)).toEqual({ kind: 'NONE' })
    const one = endEffectsCandidates(
      [first, owning(THIRD_ID, { [CHARMED]: false })],
      selectors,
      new Map()
    )
    expect(endEffectsChoice(one, undefined)).toEqual({ kind: 'CHOSEN', effectId: FIRST_ID })
    const many = endEffectsCandidates([first, second], selectors, new Map())
    expect(endEffectsChoice(many, undefined)).toEqual({ kind: 'UNCHOSEN' })
    expect(endEffectsChoice(many, THIRD_ID)).toEqual({ kind: 'UNCHOSEN' })
    expect(endEffectsChoice(many, SECOND_ID)).toEqual({ kind: 'CHOSEN', effectId: SECOND_ID })
  })

  it('offers nothing for an action that ends no effects, and a pick only under ONE_CHOSEN', () => {
    const held = [owning(FIRST_ID, { [POISONED]: false }), owning(SECOND_ID, { [POISONED]: false })]
    expect(
      offerEndEffects({
        endEffects: undefined,
        held,
        actorCreatureTypeIds: new Map(),
        chosenEffectId: FIRST_ID
      })
    ).toMatchObject({ candidates: [], pick: null })
    const all = { scope: 'ALL' as const, conditionIds: [POISONED] }
    const offeredAll = offerEndEffects({
      endEffects: all,
      held,
      actorCreatureTypeIds: new Map(),
      chosenEffectId: undefined
    })
    expect(offeredAll.candidates).toHaveLength(2)
    expect(offeredAll.pick).toBeNull()
    const oneChosen = { scope: 'ONE_CHOSEN' as const, conditionIds: [POISONED] }
    expect(
      offerEndEffects({
        endEffects: oneChosen,
        held,
        actorCreatureTypeIds: new Map(),
        chosenEffectId: SECOND_ID
      }).pick
    ).toEqual({ kind: 'CHOSEN', effectId: SECOND_ID })
  })

  it('narrows the candidates to effects whose origin creature is of the selected types', () => {
    const FIEND_ORIGIN = '00000000-0000-4000-8000-00000000f2b1'
    const HUMANOID_ORIGIN = '00000000-0000-4000-8000-00000000f2b2'
    const fiend = creatureTypeId('FIEND')
    const fiendCharm = owning(FIRST_ID, { [CHARMED]: false }, 1, null, FIEND_ORIGIN)
    const humanoidCharm = owning(SECOND_ID, { [CHARMED]: false }, 2, null, HUMANOID_ORIGIN)
    const unsourcedCharm = owning(THIRD_ID, { [CHARMED]: false })
    const held = [fiendCharm, humanoidCharm, unsourcedCharm]
    const types = new Map([
      [FIEND_ORIGIN, fiend],
      [HUMANOID_ORIGIN, creatureTypeId('HUMANOID')]
    ])
    const narrowed = [
      { kind: 'CONDITION' as const, conditionIds: [CHARMED], originCreatureTypeIds: [fiend] }
    ]
    expect(endEffectsCandidates(held, narrowed, types).map(({ id }) => id)).toEqual([FIRST_ID])
    expect(
      endEffectsCandidates(held, [{ kind: 'CONDITION', conditionIds: [CHARMED] }], types)
    ).toHaveLength(3)
    expect(
      selectedEndedEffects({
        holderActorId: HOLDER_ID,
        held,
        selectors: narrowed,
        actorCreatureTypeIds: types,
        scope: 'ALL'
      }).endedEffects.map(({ id }) => id)
    ).toEqual([FIRST_ID])
  })

  it('ends the effects linked to a selected effect in the same result', () => {
    const poison = owning(FIRST_ID, { [POISONED]: false })
    const rider = owning(SECOND_ID, { [INVISIBLE]: false }, 2, FIRST_ID)
    expect(
      select({ held: [poison, rider], scope: 'ALL', conditionIds: [POISONED] }).endedEffects.map(
        ({ id }) => id
      )
    ).toEqual([FIRST_ID, SECOND_ID])
  })
})
