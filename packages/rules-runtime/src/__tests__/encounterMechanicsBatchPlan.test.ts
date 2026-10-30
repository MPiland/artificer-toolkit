import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '@artificer-toolkit/schema/api/healthDisplay'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import {
  createCharacterResourceOwnerKey,
  createEmptyCharacterAuthored
} from '@artificer-toolkit/shared/character'
import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import { enterActorForm, revertActorForm } from '../encounterActorForm.js'
import { buildEncounterSummon } from '../encounterSummon.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from '../systems/dnd5e/identity.js'
import {
  planEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '../encounterMechanicsBatchPlan.js'
import {
  characterActor,
  creatureActor,
  ENCOUNTER_ID,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'

type EncounterActorWithForm = ReturnType<typeof planEncounterMechanicsBatch>['updatedActor']

const ACTOR_ID = '00000000-0000-4000-8000-00000000e101'
const CHARACTER_ID = '00000000-0000-4000-8000-00000000e102'
const USER_ID = '00000000-0000-4000-8000-00000000e103'
const ACTIVE_EFFECT_ID = '00000000-0000-4000-8000-00000000e104'
const SOURCE_COMMAND_ID = '00000000-0000-4000-8000-00000000e107'
const DAMAGE_OUTCOME_ID = '00000000-0000-4000-8000-00000000e105'
const STREAM_VERSION = 4
const SPELL_ID = '00000000-0000-4000-8000-00000000e109'

const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const PRONE = conditionId('PRONE')
const POISONED = conditionId('POISONED')
const RESTRAINED = conditionId('RESTRAINED')
const FRIGHTENED = conditionId('FRIGHTENED')
const NECROTIC = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'NECROTIC')!.id
/** What every NECROTIC hit in this file leaves in the target's damage record (T4i1b1). */
const NECROTIC_TAKEN = { damageTypeId: NECROTIC, commandId: SOURCE_COMMAND_ID }

const ward = {
  effectId: '00000000-0000-4000-8000-00000000e106',
  dropToHitPoints: 1,
  negatesKill: true
}

const origin = {
  sourceNodeId: 'outcome',
  sourceOperationKey: 'dnd5e.damage',
  authoredPath: null,
  resolvedPath: 'ON_HIT'
}

function batch(
  applications: CharacterRuleActionApplication[],
  overrides: Partial<EncounterMechanicsBatchInput> = {}
): EncounterMechanicsBatchInput {
  return {
    encounterId: ENCOUNTER_ID,
    targetActorId: ACTOR_ID,
    expectedEncounterVersion: 3,
    occurrenceId: '00000000-0000-4000-8000-00000000e106',
    sourceCommandId: SOURCE_COMMAND_ID,
    commandId: '00000000-0000-4000-8000-00000000e108',
    occurredAt: TIMESTAMP,
    applications,
    expectedCharacterStreamVersion: null,
    effectiveMaximumHitPoints: 11,
    forceVersionAdvance: false,
    ...overrides
  }
}

function damage(input: {
  requested: number
  disposition?: 'NORMAL' | 'IMMUNE' | 'RESISTANT' | 'VULNERABLE'
  resolved?: number
  before: { current: number; temporary: number }
  after: { current: number; temporary: number }
  maximum: number
  critical?: boolean
}): CharacterRuleActionApplication {
  return {
    ...origin,
    kind: 'DAMAGE',
    targetActorId: ACTOR_ID,
    damageTypeId: NECROTIC,
    damageDisposition: input.disposition ?? 'NORMAL',
    incomingHalved: false,
    requestedAmount: input.requested,
    resolvedAmount: input.resolved ?? input.requested,
    appliedAmount:
      input.before.current - input.after.current + input.before.temporary - input.after.temporary,
    beforeCurrentHitPoints: input.before.current,
    afterCurrentHitPoints: input.after.current,
    beforeTemporaryHitPoints: input.before.temporary,
    afterTemporaryHitPoints: input.after.temporary,
    maximumHitPoints: input.maximum,
    critical: input.critical ?? false
  }
}

const depart: CharacterRuleActionApplication = {
  sourceNodeId: origin.sourceNodeId,
  sourceOperationKey: 'dnd5e.depart-proposal',
  authoredPath: null,
  resolvedPath: null,
  kind: 'DEPART',
  targetActorId: ACTOR_ID
}

const kill: CharacterRuleActionApplication = {
  sourceNodeId: origin.sourceNodeId,
  sourceOperationKey: 'dnd5e.kill-proposal',
  authoredPath: null,
  resolvedPath: null,
  kind: 'KILL',
  targetActorId: ACTOR_ID
}

function conditionApply(conditionIdValue: string): CharacterRuleActionApplication {
  return {
    ...origin,
    kind: 'CONDITION_APPLY',
    conditionId: conditionIdValue,
    targetActorId: ACTOR_ID
  }
}

function conditionRemove(conditionIdValue: string): CharacterRuleActionApplication {
  return {
    ...origin,
    kind: 'CONDITION_REMOVE',
    conditionId: conditionIdValue,
    sourceActiveEffectId: ACTIVE_EFFECT_ID,
    targetActorId: ACTOR_ID
  }
}

function creature(input: {
  current: number
  temporary: number
  max: number
  conditions?: unknown[]
}) {
  return creatureActor({
    id: ACTOR_ID,
    currentHitPoints: input.current,
    tempHitPoints: input.temporary,
    maxHitPoints: input.max,
    conditions: input.conditions ?? [],
    snapshot: {}
  })
}

function transition(
  before: {
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    conditionIds: string[]
  },
  after: {
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    conditionIds: string[]
  }
) {
  const withScalars = <T extends object>(state: T) => ({ ...state, scalarValues: {} })
  return {
    checksum: checksumRuleDocument({ targetActorId: ACTOR_ID, ...withScalars(before) }),
    before: { ...withScalars(before), deathSaves: null },
    after: { ...withScalars(after), deathSaves: null }
  }
}

describe('Creature mechanics batch plan', () => {
  it('spends temporary hit points first, then current, and writes both to the Run actor', () => {
    const actor = creature({ current: 11, temporary: 2, max: 11 })
    const hit = damage({
      requested: 5,
      before: { current: 11, temporary: 2 },
      after: { current: 8, temporary: 0 },
      maximum: 11
    })
    // Resistance halves 7 to 3 (rounded down).
    const resisted = damage({
      requested: 7,
      disposition: 'RESISTANT',
      resolved: 3,
      before: { current: 8, temporary: 0 },
      after: { current: 5, temporary: 0 },
      maximum: 11
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([hit, resisted]),
      actor,
      userId: USER_ID
    })
    const { targetActorId: _hitTarget, ...hitReceipt } = hit
    const { targetActorId: _resistedTarget, ...resistedReceipt } = resisted
    expect(plan).toEqual({
      updatedActor: {
        ...actor,
        currentHitPoints: 5,
        tempHitPoints: 0,
        maxHitPoints: 11,
        conditions: [],
        damageTypesSinceTurnStart: [NECROTIC_TAKEN]
      },
      receiptApplications: [
        { ...hitReceipt, ordinal: 0 },
        { ...resistedReceipt, ordinal: 1 }
      ],
      targetTransition: transition(
        { currentHitPoints: 11, temporaryHitPoints: 2, maximumHitPoints: 11, conditionIds: [] },
        { currentHitPoints: 5, temporaryHitPoints: 0, maximumHitPoints: 11, conditionIds: [] }
      ),
      characterStreamVersion: null,
      itemUseStateTransition: null,
      itemDegradationTransition: null,
      itemDrawTransition: null,
      itemReleaseTransition: null,
      stateChanged: true,
      shouldAdvance: false,
      characterUpdate: null
    })
  })

  it('applies a held interception to lethal damage in the plan, naming the ward (SPELLS-4.T2i2b)', () => {
    const actor = creature({ current: 5, temporary: 0, max: 11 })
    const lethal = damage({
      requested: 9,
      before: { current: 5, temporary: 0 },
      after: { current: 0, temporary: 0 },
      maximum: 11
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([lethal], { damageInterceptions: [ward] }),
      actor,
      userId: USER_ID
    })
    expect(plan.updatedActor).toMatchObject({ currentHitPoints: 1 })
    expect(plan.receiptApplications).toMatchObject([
      { kind: 'DAMAGE', afterCurrentHitPoints: 1, appliedAmount: 4, interceptedBy: ward.effectId }
    ])
  })

  it('settles an area that damages a creature and an invulnerable summon beside it: the summon takes none (SPELLS-4.T2v2a3c)', () => {
    const summon = (damageabilityKind: 'NORMAL' | 'INVULNERABLE') => ({
      ...buildEncounterSummon({
        summon: {
          kind: 'STAT_BLOCK',
          statBlock: { damageabilityKind, hitPoints: { kind: 'FIXED', value: 10 } }
        },
        spellSummon: null,
        caster: creatureActor({ id: CHARACTER_ID, snapshot: {} }),
        casterHitPointMaximum: 20,
        label: 'Conjured',
        sourceEffectId: ACTIVE_EFFECT_ID,
        point: { x: 0, y: 0 },
        edgeLength: 100,
        occurredAt: TIMESTAMP
      }).actor,
      id: ACTOR_ID
    })
    // The area's two hits, planned against each target's pools as they stood.
    const area = (current: number, maximum: number) => [
      damage({
        requested: 8,
        before: { current, temporary: 0 },
        after: { current: Math.max(current - 8, 0), temporary: 0 },
        maximum
      }),
      damage({
        requested: 5,
        before: { current: Math.max(current - 8, 0), temporary: 0 },
        after: { current: Math.max(current - 13, 0), temporary: 0 },
        maximum
      })
    ]
    const plan = (actor: EncounterRunActorState, current: number, maximum: number) =>
      planEncounterMechanicsBatch({
        batch: batch(area(current, maximum), {
          effectiveMaximumHitPoints: maximum
        }),
        actor,
        userId: USER_ID
      })

    const creaturePlan = plan(creature({ current: 11, temporary: 0, max: 11 }), 11, 11)
    expect(creaturePlan.updatedActor).toMatchObject({ currentHitPoints: 0, defeated: true })

    const invulnerablePlan = plan(summon('INVULNERABLE'), 10, 10)
    expect(invulnerablePlan.updatedActor).toMatchObject({ currentHitPoints: 10, defeated: false })
    const untouched = {
      kind: 'DAMAGE',
      damageDisposition: 'IMMUNE',
      resolvedAmount: 0,
      appliedAmount: 0,
      beforeCurrentHitPoints: 10,
      afterCurrentHitPoints: 10
    }
    expect(invulnerablePlan.receiptApplications).toMatchObject([
      { ...untouched, requestedAmount: 8 },
      { ...untouched, requestedAmount: 5 }
    ])
    expect(invulnerablePlan.stateChanged).toBe(false)

    // A summon whose stat block is damageable takes the area like any creature.
    expect(plan(summon('NORMAL'), 10, 10).updatedActor).toMatchObject({ currentHitPoints: 0 })
  })

  it('refuses a damage application whose resolved amount ignores its disposition', () => {
    expect(() =>
      planEncounterMechanicsBatch({
        batch: batch([
          damage({
            requested: 7,
            disposition: 'VULNERABLE',
            resolved: 7,
            before: { current: 11, temporary: 0 },
            after: { current: 4, temporary: 0 },
            maximum: 11
          })
        ]),
        actor: creature({ current: 11, temporary: 0, max: 11 }),
        userId: USER_ID
      })
    ).toThrow('The Character damage application is invalid.')
  })

  it('refuses an application planned against an earlier hit-point state', () => {
    expect(() =>
      planEncounterMechanicsBatch({
        batch: batch([
          damage({
            requested: 2,
            before: { current: 10, temporary: 0 },
            after: { current: 8, temporary: 0 },
            maximum: 11
          })
        ]),
        actor: creature({ current: 11, temporary: 0, max: 11 }),
        userId: USER_ID
      })
    ).toThrow('The Character rule action application order is stale.')
  })

  it('replaces one condition with another, keeping existing rows and their details', () => {
    const actor = creature({
      current: 11,
      temporary: 0,
      max: 11,
      conditions: [{ conditionTypeId: PRONE, note: 'Shoved' }, POISONED]
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([conditionRemove(PRONE), conditionApply(RESTRAINED), conditionApply(POISONED)]),
      actor,
      userId: USER_ID
    })
    expect(plan.updatedActor).toEqual({
      ...actor,
      conditions: [POISONED, { conditionTypeId: RESTRAINED }]
    })
    expect(plan.receiptApplications).toEqual([
      {
        ...origin,
        ordinal: 0,
        kind: 'CONDITION_REMOVE',
        conditionId: PRONE,
        sourceActiveEffectId: ACTIVE_EFFECT_ID,
        beforePresent: true,
        afterPresent: false,
        applied: true
      },
      {
        ...origin,
        ordinal: 1,
        kind: 'CONDITION_APPLY',
        conditionId: RESTRAINED,
        beforePresent: false,
        afterPresent: true,
        applied: true
      },
      // Already poisoned: the application is recorded but changes nothing.
      {
        ...origin,
        ordinal: 2,
        kind: 'CONDITION_APPLY',
        conditionId: POISONED,
        beforePresent: true,
        afterPresent: true,
        applied: false
      }
    ])
    expect(plan.targetTransition.after.conditionIds).toEqual([POISONED, RESTRAINED])
    expect(plan.stateChanged).toBe(true)
  })

  it('keeps a condition another active effect still owns when one source removes it', () => {
    const actor = creature({ current: 11, temporary: 0, max: 11, conditions: [FRIGHTENED] })
    const plan = planEncounterMechanicsBatch({
      batch: batch([conditionRemove(FRIGHTENED)], { retainedConditionIds: [FRIGHTENED] }),
      actor,
      userId: USER_ID
    })
    expect(plan.updatedActor).toEqual(actor)
    expect(plan.receiptApplications).toEqual([
      {
        ...origin,
        ordinal: 0,
        kind: 'CONDITION_REMOVE',
        conditionId: FRIGHTENED,
        sourceActiveEffectId: ACTIVE_EFFECT_ID,
        beforePresent: true,
        afterPresent: true,
        applied: false
      }
    ])
    expect(plan.stateChanged).toBe(false)
  })

  it('kills a Run creature: no hit points of either kind, defeated, and a receipt of what it lost (SPELLS-4.T2i)', () => {
    const actor = creature({ current: 7, temporary: 3, max: 11 })
    const plan = planEncounterMechanicsBatch({
      batch: batch([kill]),
      actor,
      userId: USER_ID
    })
    expect(plan.targetTransition.after).toMatchObject({
      currentHitPoints: 0,
      temporaryHitPoints: 0
    })
    expect(plan.updatedActor).toMatchObject({ currentHitPoints: 0, tempHitPoints: 0 })
    expect(plan.receiptApplications).toEqual([
      expect.objectContaining({
        ordinal: 0,
        kind: 'KILL',
        beforeCurrentHitPoints: 7,
        afterCurrentHitPoints: 0,
        beforeTemporaryHitPoints: 3,
        afterTemporaryHitPoints: 0
      })
    ])
  })

  it('drops a Run creature to 0 hit points, defeated, without dealing damage (ATTACK-16.T1d)', () => {
    const actor = creature({ current: 7, temporary: 3, max: 11 })
    const plan = planEncounterMechanicsBatch({
      batch: batch([
        {
          ...origin,
          sourceOperationKey: 'dnd5e.hit-points-to-zero-proposal',
          kind: 'HIT_POINTS_TO_ZERO',
          targetActorId: ACTOR_ID
        }
      ]),
      actor,
      userId: USER_ID
    })
    expect(plan.updatedActor).toMatchObject({
      currentHitPoints: 0,
      tempHitPoints: 0,
      defeated: true
    })
    expect(plan.receiptApplications).toEqual([
      expect.objectContaining({
        ordinal: 0,
        kind: 'HIT_POINTS_TO_ZERO',
        beforeCurrentHitPoints: 7,
        afterCurrentHitPoints: 0,
        beforeTemporaryHitPoints: 3,
        afterTemporaryHitPoints: 0
      })
    ])
  })

  it('marks the actor departed and leaves its hit points, conditions and place in the Run alone (D128)', () => {
    const actor = creature({ current: 11, temporary: 0, max: 11, conditions: [POISONED] })
    const plan = planEncounterMechanicsBatch({
      batch: batch([depart]),
      actor,
      userId: USER_ID
    })
    expect(plan.updatedActor).toEqual({ ...actor, absence: 'DEPARTED' })
    expect(plan.receiptApplications).toEqual([
      {
        sourceNodeId: origin.sourceNodeId,
        sourceOperationKey: 'dnd5e.depart-proposal',
        authoredPath: null,
        resolvedPath: null,
        ordinal: 0,
        kind: 'DEPART',
        applied: true
      }
    ])
    expect(plan.targetTransition.before).toEqual(plan.targetTransition.after)
    expect(plan.stateChanged).toBe(true)
  })

  it('records a departure of an actor already away without changing it', () => {
    const away = {
      ...creature({ current: 11, temporary: 0, max: 11 }),
      absence: 'GM_REMOVED' as const
    }
    const plan = planEncounterMechanicsBatch({
      batch: batch([depart]),
      actor: away,
      userId: USER_ID
    })
    expect(plan.updatedActor).toEqual(away)
    expect(plan.receiptApplications).toMatchObject([{ kind: 'DEPART', applied: false }])
    expect(plan.stateChanged).toBe(false)
  })

  it('lowers the hit point maximum, clamps current hit points, and bounds later damage by it', () => {
    const actor = creature({ current: 9, temporary: 3, max: 11 })
    const reduction: CharacterRuleActionApplication = {
      ...origin,
      kind: 'HIT_POINT_MAXIMUM_REDUCTION',
      targetActorId: ACTOR_ID,
      sourceDamageNodeId: 'damage',
      sourceDamageOperationKey: 'dnd5e.damage',
      sourceDamageOutcomeId: DAMAGE_OUTCOME_ID,
      reductionAmount: 4,
      recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
    }
    const followUp = damage({
      requested: 4,
      before: { current: 7, temporary: 3 },
      after: { current: 6, temporary: 0 },
      maximum: 7
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([reduction, followUp]),
      actor,
      userId: USER_ID
    })
    const { targetActorId: _followUpTarget, ...followUpReceipt } = followUp
    expect(plan.receiptApplications).toEqual([
      {
        ...origin,
        ordinal: 0,
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        reductionAmount: 4,
        sourceDamageOutcomeId: DAMAGE_OUTCOME_ID,
        sourceDamageNodeId: 'damage',
        sourceDamageOperationKey: 'dnd5e.damage',
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'],
        requestedAmount: 4,
        resolvedAmount: 4,
        appliedAmount: 4,
        beforeMaximumHitPoints: 11,
        afterMaximumHitPoints: 7,
        beforeCurrentHitPoints: 9,
        afterCurrentHitPoints: 7,
        beforeTemporaryHitPoints: 3,
        afterTemporaryHitPoints: 3,
        maximumHitPoints: 11
      },
      { ...followUpReceipt, ordinal: 1 }
    ])
    expect(plan.updatedActor).toEqual({
      ...actor,
      currentHitPoints: 6,
      tempHitPoints: 0,
      maxHitPoints: 7,
      conditions: [],
      damageTypesSinceTurnStart: [NECROTIC_TAKEN]
    })
    expect(plan.targetTransition.after).toEqual({
      currentHitPoints: 6,
      temporaryHitPoints: 0,
      maximumHitPoints: 7,
      conditionIds: [],
      scalarValues: {},
      deathSaves: null
    })
  })

  it('never lowers the hit point maximum below 0', () => {
    const plan = planEncounterMechanicsBatch({
      batch: batch(
        [
          {
            ...origin,
            kind: 'HIT_POINT_MAXIMUM_REDUCTION',
            targetActorId: ACTOR_ID,
            sourceDamageNodeId: 'damage',
            sourceDamageOperationKey: 'dnd5e.damage',
            sourceDamageOutcomeId: DAMAGE_OUTCOME_ID,
            reductionAmount: 20,
            recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
          }
        ],
        { effectiveMaximumHitPoints: 6 }
      ),
      actor: creature({ current: 6, temporary: 0, max: 6 }),
      userId: USER_ID
    })
    expect(plan.receiptApplications[0]).toMatchObject({
      requestedAmount: 20,
      appliedAmount: 6,
      afterMaximumHitPoints: 0,
      afterCurrentHitPoints: 0
    })
    expect(plan.updatedActor).toMatchObject({ currentHitPoints: 0, maxHitPoints: 0 })
  })

  it.each([
    {
      name: 'a Character stream version',
      overrides: { expectedCharacterStreamVersion: 1 },
      message: 'Encounter non-Character actors have no Character stream version.'
    },
    {
      name: 'a spell slot consumption',
      overrides: {
        characterSpellConsumptions: [
          {
            characterId: CHARACTER_ID,
            spellId: SPELL_ID,
            candidateId: 'candidate',
            slotKey: 'STANDARD:1',
            beforeUsed: 0,
            afterUsed: 1,
            expectedStreamVersion: STREAM_VERSION
          }
        ]
      },
      message: 'Encounter non-Character actors cannot spend Character spell slots.'
    },
    {
      name: 'a resource restore',
      overrides: {
        characterResourceRestores: [
          {
            poolId: 'AUTHORED_GRANT:ki',
            chargeId: 'ki',
            owner: { kind: 'AUTHORED_GRANT' as const, resourceGrantId: 'ki' },
            beforeUsed: 20,
            afterUsed: 16,
            beforeRemaining: 0,
            afterRemaining: 4
          }
        ]
      },
      message: 'Encounter non-Character actors cannot restore Character resources.'
    },
    {
      name: 'an item to stow',
      overrides: { stowEquippedItemInstanceId: 'item-0' },
      message: 'Encounter non-Character actors cannot stow Character equipment.'
    }
  ])('refuses $name for a Creature', ({ overrides, message }) => {
    expect(() =>
      planEncounterMechanicsBatch({
        batch: batch([], overrides),
        actor: creature({ current: 11, temporary: 0, max: 11 }),
        userId: USER_ID
      })
    ).toThrow(message)
  })
})

describe('Creature forms (D130)', () => {
  const FORM_EFFECT_ID = '00000000-0000-4000-8000-00000000e1f0'
  const FORM_SOURCE_ID = '00000000-0000-4000-8000-00000000e1f1'
  const formCreature = {
    systemId: SRD_SYSTEM_ID,
    sourceId: FORM_SOURCE_ID,
    sourceRevision: 7,
    snapshot: { label: 'Giant Centipede' },
    maxHitPoints: 4
  }
  const plain = () => creature({ current: 11, temporary: 2, max: 11, conditions: [POISONED] })
  const inForm = (excessDamageCarriesOver: boolean) => {
    const actor = plain()
    if (actor.kind === 'CHARACTER') throw new Error('The fixture actor is a Creature.')
    return enterActorForm(actor, {
      effectId: FORM_EFFECT_ID,
      excessDamageCarriesOver,
      retainedAbilityIds: [],
      creature: formCreature
    })
  }
  const hitForm = (
    actor: ReturnType<typeof inForm>,
    requested: number,
    before: number,
    after: number
  ) =>
    planEncounterMechanicsBatch({
      batch: batch(
        [
          damage({
            requested,
            before: { current: before, temporary: 0 },
            after: { current: after, temporary: 0 },
            maximum: 4
          })
        ],
        { effectiveMaximumHitPoints: 4 }
      ),
      actor,
      userId: USER_ID
    })

  it("swaps the form in, keeping the origin whole and the actor's conditions", () => {
    const plan = planEncounterMechanicsBatch({
      batch: batch([], {
        enterForm: {
          effectId: FORM_EFFECT_ID,
          excessDamageCarriesOver: false,
          retainedAbilityIds: [],
          creature: formCreature
        }
      }),
      actor: plain(),
      userId: USER_ID
    })
    expect(plan.updatedActor).toMatchObject({
      sourceId: FORM_SOURCE_ID,
      sourceRevision: 7,
      currentHitPoints: 4,
      maxHitPoints: 4,
      tempHitPoints: 0,
      conditions: [POISONED],
      form: {
        effectId: FORM_EFFECT_ID,
        excessDamageCarriesOver: false,
        origin: { currentHitPoints: 11, maxHitPoints: 11, tempHitPoints: 2 }
      }
    })
    expect(plan.stateChanged).toBe(true)
  })

  it('keeps the Creature’s own retained scores from its stat block (Animal Shapes on an NPC)', () => {
    const abilityId = (code: string) => DND5E_ABILITY_DEFINITION_ID_BY_CODE[code]!
    const ally = creatureActor({
      id: ACTOR_ID,
      currentHitPoints: 11,
      tempHitPoints: 0,
      maxHitPoints: 11,
      conditions: [],
      snapshot: { ruleFacts: { abilityScores: { [abilityId('WISDOM')]: 16 } } }
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([], {
        enterForm: {
          effectId: FORM_EFFECT_ID,
          excessDamageCarriesOver: true,
          retainedAbilityIds: [abilityId('WISDOM')],
          creature: {
            ...formCreature,
            snapshot: {
              payload: { abilityScores: { STRENGTH: 18, WISDOM: 12 } },
              ruleFacts: {
                abilityScores: { [abilityId('STRENGTH')]: 18, [abilityId('WISDOM')]: 12 }
              }
            }
          }
        }
      }),
      actor: ally,
      userId: USER_ID
    })
    expect(plan.updatedActor).toMatchObject({
      snapshot: {
        payload: { abilityScores: { STRENGTH: 18, WISDOM: 16 } },
        ruleFacts: { abilityScores: { [abilityId('STRENGTH')]: 18, [abilityId('WISDOM')]: 16 } }
      }
    })
  })

  it('refuses to enter a form while in one', () => {
    expect(() =>
      planEncounterMechanicsBatch({
        batch: batch([], {
          enterForm: {
            effectId: FORM_EFFECT_ID,
            excessDamageCarriesOver: false,
            retainedAbilityIds: [],
            creature: formCreature
          }
        }),
        actor: inForm(false),
        userId: USER_ID
      })
    ).toThrow('The actor already has a form.')
  })

  it('keeps the form while it has hit points, damaging only the form', () => {
    const plan = hitForm(inForm(false), 3, 4, 1)
    expect(plan.updatedActor).toMatchObject({
      sourceId: FORM_SOURCE_ID,
      currentHitPoints: 1,
      form: { origin: { currentHitPoints: 11, tempHitPoints: 2 } }
    })
  })

  it('reverts at 0 hit points and loses the excess when the form does not carry it over (Giant Insect)', () => {
    const plan = hitForm(inForm(false), 9, 4, 0)
    expect(plan.updatedActor).toEqual({ ...plain(), damageTypesSinceTurnStart: [NECROTIC_TAKEN] })
  })

  it('reverts at 0 hit points and spends the excess on the origin when the form carries it over (Polymorph)', () => {
    // 9 damage: 4 end the form, 5 spend the origin's 2 temporary then 3 of its 11 current.
    const plan = hitForm(inForm(true), 9, 4, 0)
    expect(plan.updatedActor).toMatchObject({
      sourceId: null,
      currentHitPoints: 8,
      tempHitPoints: 0,
      defeated: false,
      form: null
    })
  })

  it('defeats the origin when carried excess damage takes it to 0', () => {
    const plan = hitForm(inForm(true), 30, 4, 0)
    expect(plan.updatedActor).toMatchObject({
      currentHitPoints: 0,
      tempHitPoints: 0,
      defeated: true,
      form: null
    })
  })

  it('ends a form once through the one revert, however the form ends', () => {
    const reverted = revertActorForm(inForm(false))
    expect(reverted).toEqual(plain())
    expect(revertActorForm(reverted)).toBe(reverted)
  })
})

describe('Character mechanics batch plan', () => {
  const empty = createEmptyCharacterAuthored({
    id: CHARACTER_ID,
    systemId: SRD_SYSTEM_ID,
    userId: USER_ID
  })
  const document = {
    ...empty,
    state: {
      ...empty.state,
      hitpoints: { current: 10, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
      conditions: [{ conditionTypeId: PRONE }]
    }
  }
  const characterFacts = {
    active: { id: CHARACTER_ID, play: { streamVersion: STREAM_VERSION } },
    character: document,
    sheetState: characterSheetStateSchema.parse({
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY
    }),
    campaignContext: { conditions: [{ conditionTypeId: FRIGHTENED }] }
  }
  const actor = characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID })

  it('writes hit points and conditions to the Character in its next stream version', () => {
    const hit = damage({
      requested: 4,
      before: { current: 10, temporary: 0 },
      after: { current: 6, temporary: 0 },
      maximum: 12
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([hit, conditionRemove(PRONE), conditionApply(RESTRAINED)], {
        expectedCharacterStreamVersion: STREAM_VERSION,
        effectiveMaximumHitPoints: 12
      }),
      actor,
      userId: USER_ID,
      characterFacts
    })
    expect(plan.updatedActor).toBe(actor)
    expect(plan.characterStreamVersion).toBe(STREAM_VERSION + 1)
    expect(plan.shouldAdvance).toBe(true)
    expect(plan.characterUpdate).toEqual({
      character: {
        ...document,
        state: {
          ...document.state,
          hitpoints: { current: 6, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
          conditions: [{ conditionTypeId: RESTRAINED }]
        }
      },
      sheetState: null
    })
    // The Campaign's own condition counts toward the target state but is not written to the Sheet.
    expect(plan.targetTransition.before.conditionIds).toEqual([PRONE, FRIGHTENED])
    expect(plan.targetTransition.after.conditionIds).toEqual([FRIGHTENED, RESTRAINED])
  })

  it('applies a held interception to lethal damage in the plan, leaving the Character at 1 hit point (SPELLS-4.T2i2b)', () => {
    const lethal = damage({
      requested: 14,
      before: { current: 10, temporary: 0 },
      after: { current: 0, temporary: 0 },
      maximum: 12
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([lethal], {
        expectedCharacterStreamVersion: STREAM_VERSION,
        effectiveMaximumHitPoints: 12,
        damageInterceptions: [ward]
      }),
      actor,
      userId: USER_ID,
      characterFacts
    })
    expect(plan.characterUpdate?.character.state.hitpoints.current).toBe(1)
    expect(plan.receiptApplications).toMatchObject([
      { kind: 'DAMAGE', afterCurrentHitPoints: 1, interceptedBy: ward.effectId }
    ])
  })

  it('clears the Sheet copy of a condition the Campaign also holds and reports it applied', () => {
    const plan = planEncounterMechanicsBatch({
      batch: batch([conditionRemove(FRIGHTENED)], {
        expectedCharacterStreamVersion: STREAM_VERSION,
        effectiveMaximumHitPoints: 12
      }),
      actor,
      userId: USER_ID,
      characterFacts: {
        ...characterFacts,
        character: {
          ...document,
          state: {
            ...document.state,
            conditions: [{ conditionTypeId: PRONE }, { conditionTypeId: FRIGHTENED }]
          }
        }
      }
    })
    expect(plan.characterUpdate?.character.state.conditions).toEqual([{ conditionTypeId: PRONE }])
    // The Campaign still holds it, so it stays present, but the removal did change the Sheet.
    expect(plan.receiptApplications).toEqual([
      {
        ...origin,
        ordinal: 0,
        kind: 'CONDITION_REMOVE',
        conditionId: FRIGHTENED,
        sourceActiveEffectId: ACTIVE_EFFECT_ID,
        beforePresent: true,
        afterPresent: true,
        applied: true
      }
    ])
    expect(plan.targetTransition.after.conditionIds).toEqual([PRONE, FRIGHTENED])
  })

  describe('Creature forms (D130 amendment)', () => {
    const FORM_EFFECT_ID = '00000000-0000-4000-8000-00000000e1f2'
    const abilityId = (code: string) => DND5E_ABILITY_DEFINITION_ID_BY_CODE[code]!
    const SHEET_MAXIMUM = 12
    const formSnapshot = {
      label: 'Giant Centipede',
      payload: { abilityScores: { STRENGTH: 5, INTELLIGENCE: 1, WISDOM: 7, CHARISMA: 3 } },
      ruleFacts: {
        abilityScores: {
          [abilityId('STRENGTH')]: 5,
          [abilityId('INTELLIGENCE')]: 1,
          [abilityId('WISDOM')]: 7,
          [abilityId('CHARISMA')]: 3
        }
      }
    }
    const MENTAL_ABILITY_IDS = ['INTELLIGENCE', 'WISDOM', 'CHARISMA'].map(abilityId)
    const enterForm = (
      excessDamageCarriesOver: boolean,
      retainedAbilityIds: readonly string[] = MENTAL_ABILITY_IDS
    ) => ({
      effectId: FORM_EFFECT_ID,
      excessDamageCarriesOver,
      retainedAbilityIds,
      creature: {
        systemId: SRD_SYSTEM_ID,
        sourceId: '00000000-0000-4000-8000-00000000e1f3',
        sourceRevision: 7,
        snapshot: formSnapshot,
        maxHitPoints: 4
      }
    })
    const play = (applications: CharacterRuleActionApplication[], form: EncounterActorWithForm) =>
      planEncounterMechanicsBatch({
        batch: batch(applications, {
          expectedCharacterStreamVersion: STREAM_VERSION,
          effectiveMaximumHitPoints: 4,
          sheetMaximumHitPoints: SHEET_MAXIMUM
        }),
        actor: form,
        userId: USER_ID,
        characterFacts
      })
    const entered = (excessDamageCarriesOver: boolean) =>
      planEncounterMechanicsBatch({
        batch: batch([], {
          expectedCharacterStreamVersion: STREAM_VERSION,
          effectiveMaximumHitPoints: SHEET_MAXIMUM,
          effectiveScalarValues: {
            [abilityId('INTELLIGENCE')]: 14,
            [abilityId('WISDOM')]: 12,
            [abilityId('CHARISMA')]: 9
          },
          enterForm: enterForm(excessDamageCarriesOver)
        }),
        actor,
        userId: USER_ID,
        characterFacts
      }).updatedActor as EncounterActorWithForm
    const hit = (requested: number, before: number, after: number) =>
      damage({
        requested,
        before: { current: before, temporary: 0 },
        after: { current: after, temporary: 0 },
        maximum: 4
      })

    it('gives the Character the form at full hit points, keeping INT/WIS/CHA and the Sheet untouched', () => {
      const plan = planEncounterMechanicsBatch({
        batch: batch([], {
          expectedCharacterStreamVersion: STREAM_VERSION,
          effectiveMaximumHitPoints: SHEET_MAXIMUM,
          effectiveScalarValues: {
            [abilityId('INTELLIGENCE')]: 14,
            [abilityId('WISDOM')]: 12,
            [abilityId('CHARISMA')]: 9
          },
          enterForm: enterForm(true)
        }),
        actor,
        userId: USER_ID,
        characterFacts
      })
      expect(plan.updatedActor).toMatchObject({
        kind: 'CHARACTER',
        form: {
          effectId: FORM_EFFECT_ID,
          excessDamageCarriesOver: true,
          currentHitPoints: 4,
          maxHitPoints: 4,
          tempHitPoints: 0,
          snapshot: {
            payload: { abilityScores: { STRENGTH: 5, INTELLIGENCE: 14, WISDOM: 12, CHARISMA: 9 } }
          }
        }
      })
      expect(plan.stateChanged).toBe(true)
      expect(plan.characterUpdate).toBeNull()
      expect(plan.characterStreamVersion).toBeNull()
    })

    it('keeps none of the Character’s scores when the form retains none (Polymorph)', () => {
      const plan = planEncounterMechanicsBatch({
        batch: batch([], {
          expectedCharacterStreamVersion: STREAM_VERSION,
          effectiveMaximumHitPoints: SHEET_MAXIMUM,
          effectiveScalarValues: {
            [abilityId('INTELLIGENCE')]: 14,
            [abilityId('WISDOM')]: 12,
            [abilityId('CHARISMA')]: 9
          },
          enterForm: enterForm(true, [])
        }),
        actor,
        userId: USER_ID,
        characterFacts
      })
      expect(plan.updatedActor).toMatchObject({
        form: {
          snapshot: {
            payload: { abilityScores: { STRENGTH: 5, INTELLIGENCE: 1, WISDOM: 7, CHARISMA: 3 } },
            ruleFacts: {
              abilityScores: {
                [abilityId('INTELLIGENCE')]: 1,
                [abilityId('WISDOM')]: 7,
                [abilityId('CHARISMA')]: 3
              }
            }
          }
        }
      })
    })

    it('refuses to enter a form while in one', () => {
      expect(() =>
        planEncounterMechanicsBatch({
          batch: batch([], {
            expectedCharacterStreamVersion: STREAM_VERSION,
            effectiveMaximumHitPoints: 4,
            sheetMaximumHitPoints: SHEET_MAXIMUM,
            enterForm: enterForm(true)
          }),
          actor: entered(true),
          userId: USER_ID,
          characterFacts
        })
      ).toThrow('already has a form')
    })

    it('damages the form and leaves the Sheet as it was', () => {
      const plan = play([hit(3, 4, 1)], entered(true))
      expect(plan.updatedActor).toMatchObject({ form: { currentHitPoints: 1, maxHitPoints: 4 } })
      expect(plan.characterUpdate).toBeNull()
      expect(plan.characterStreamVersion).toBeNull()
      expect(plan.targetTransition.after).toMatchObject({ currentHitPoints: 1 })
      // The receipt reads that the hit points were the form's (SPELLS-4.T2s2).
      expect(plan.targetTransition.inForm).toBe(true)
    })

    it('ends the form at 0 and spends the excess on the Sheet in the same batch when it carries over', () => {
      // 9 damage: 4 end the form, 5 come off the Sheet's 10.
      const plan = play([hit(9, 4, 0)], entered(true))
      expect(plan.updatedActor).toMatchObject({ kind: 'CHARACTER', form: null })
      expect(plan.characterUpdate?.character.state.hitpoints).toMatchObject({ current: 5, temp: 0 })
      expect(plan.characterStreamVersion).toBe(STREAM_VERSION + 1)
      expect(plan.receiptApplications).toEqual([
        expect.objectContaining({ ordinal: 0, kind: 'DAMAGE', appliedAmount: 4 }),
        expect.objectContaining({
          ordinal: 1,
          kind: 'DAMAGE',
          requestedAmount: 5,
          appliedAmount: 5,
          beforeCurrentHitPoints: 10,
          afterCurrentHitPoints: 5,
          maximumHitPoints: SHEET_MAXIMUM
        })
      ])
    })

    it('loses the excess when the form does not carry it over', () => {
      const plan = play([hit(9, 4, 0)], entered(false))
      expect(plan.updatedActor).toMatchObject({ form: null })
      expect(plan.characterUpdate).toBeNull()
      expect(plan.receiptApplications).toHaveLength(1)
    })

    it('can take the Sheet to 0 through the carried-over damage', () => {
      const plan = play([hit(30, 4, 0)], entered(true))
      expect(plan.characterUpdate?.character.state.hitpoints.current).toBe(0)
    })

    it('needs the Sheet maximum while in a form', () => {
      expect(() =>
        planEncounterMechanicsBatch({
          batch: batch([hit(1, 4, 3)], {
            expectedCharacterStreamVersion: STREAM_VERSION,
            effectiveMaximumHitPoints: 4
          }),
          actor: entered(true),
          userId: USER_ID,
          characterFacts
        })
      ).toThrow('needs its Sheet maximum hit points')
    })

    it('ends through the one revert, whatever the cause', () => {
      const reverted = revertActorForm(entered(true))
      expect(reverted).toEqual(actor)
      expect(revertActorForm(reverted)).toEqual(actor)
    })
  })

  describe('spell slot consumption', () => {
    const consumption = {
      characterId: CHARACTER_ID,
      spellId: SPELL_ID,
      candidateId: 'candidate',
      slotKey: 'STANDARD:1',
      beforeUsed: 1,
      afterUsed: 2,
      expectedStreamVersion: STREAM_VERSION
    }
    const withSlots = (spellSlots: { slotKey: string; used: number }[]) => ({
      ...characterFacts,
      character: { ...document, state: { ...document.state, spellSlots } }
    })
    const planForAll = (spends: (typeof consumption)[], facts: ReturnType<typeof withSlots>) =>
      planEncounterMechanicsBatch({
        batch: batch([], {
          expectedCharacterStreamVersion: STREAM_VERSION,
          effectiveMaximumHitPoints: 12,
          characterSpellConsumptions: spends
        }),
        actor,
        userId: USER_ID,
        characterFacts: facts
      })
    const planFor = (spend: typeof consumption, facts: ReturnType<typeof withSlots>) =>
      planForAll([spend], facts)

    it('spends a cast and a counter of the same Character in one batch and one stream version', () => {
      const counter = { ...consumption, beforeUsed: 2, afterUsed: 3 }
      const plan = planForAll(
        [consumption, counter],
        withSlots([{ slotKey: 'STANDARD:1', used: 1 }])
      )
      expect(plan.characterStreamVersion).toBe(STREAM_VERSION + 1)
      expect(plan.characterUpdate?.character.state.spellSlots).toEqual([
        { slotKey: 'STANDARD:1', used: 3 }
      ])
    })

    it('spends two different slots of one Character in the order given', () => {
      const counter = { ...consumption, slotKey: 'STANDARD:3', beforeUsed: 0, afterUsed: 1 }
      const plan = planForAll(
        [consumption, counter],
        withSlots([{ slotKey: 'STANDARD:1', used: 1 }])
      )
      expect(plan.characterUpdate?.character.state.spellSlots).toEqual([
        { slotKey: 'STANDARD:1', used: 2 },
        { slotKey: 'STANDARD:3', used: 1 }
      ])
    })

    it('refuses a second spend of the same slot that does not follow the first', () => {
      expect(() =>
        planForAll([consumption, consumption], withSlots([{ slotKey: 'STANDARD:1', used: 1 }]))
      ).toThrow('Encounter Character spell slot consumption is stale.')
    })

    it('spends the slot in the Character version the outcome writes, leaving other slots alone', () => {
      const plan = planFor(
        consumption,
        withSlots([
          { slotKey: 'STANDARD:1', used: 1 },
          { slotKey: 'STANDARD:2', used: 1 }
        ])
      )
      expect(plan.characterStreamVersion).toBe(STREAM_VERSION + 1)
      expect(plan.shouldAdvance).toBe(true)
      // The Sheet's own slot write: a used slot keeps its place.
      expect(plan.characterUpdate?.character.state.spellSlots).toEqual([
        { slotKey: 'STANDARD:1', used: 2 },
        { slotKey: 'STANDARD:2', used: 1 }
      ])
    })

    it('adds a slot entry the Character has not used yet', () => {
      const plan = planFor({ ...consumption, beforeUsed: 0, afterUsed: 1 }, withSlots([]))
      expect(plan.characterUpdate?.character.state.spellSlots).toEqual([
        { slotKey: 'STANDARD:1', used: 1 }
      ])
    })

    it.each([
      {
        name: 'the slot was spent since the preparation',
        spend: consumption,
        facts: withSlots([{ slotKey: 'STANDARD:1', used: 2 }])
      },
      {
        name: 'the Character version moved',
        spend: { ...consumption, expectedStreamVersion: STREAM_VERSION - 1 },
        facts: withSlots([{ slotKey: 'STANDARD:1', used: 1 }])
      },
      {
        name: 'the spend is not one slot',
        spend: { ...consumption, afterUsed: 3 },
        facts: withSlots([{ slotKey: 'STANDARD:1', used: 1 }])
      },
      {
        name: 'the spend names another Character',
        spend: { ...consumption, characterId: ACTOR_ID },
        facts: withSlots([{ slotKey: 'STANDARD:1', used: 1 }])
      }
    ])('refuses a stale spend when $name', ({ spend, facts }) => {
      expect(() => planFor(spend, facts)).toThrow(
        'Encounter Character spell slot consumption is stale.'
      )
    })
  })

  it('does not advance the Character for a batch that changes nothing', () => {
    const plan = planEncounterMechanicsBatch({
      batch: batch([], {
        expectedCharacterStreamVersion: STREAM_VERSION,
        effectiveMaximumHitPoints: 12
      }),
      actor,
      userId: USER_ID,
      characterFacts
    })
    expect(plan).toMatchObject({
      characterStreamVersion: null,
      stateChanged: false,
      shouldAdvance: false,
      characterUpdate: null,
      receiptApplications: []
    })
  })

  it('marks a departing Character absent in the Run without touching its Sheet (D128)', () => {
    const plan = planEncounterMechanicsBatch({
      batch: batch([depart], {
        expectedCharacterStreamVersion: STREAM_VERSION,
        effectiveMaximumHitPoints: 12
      }),
      actor,
      userId: USER_ID,
      characterFacts
    })
    expect(plan.updatedActor).toEqual({ ...actor, absence: 'DEPARTED' })
    expect(plan.receiptApplications).toMatchObject([{ kind: 'DEPART', applied: true }])
    expect(plan).toMatchObject({
      characterStreamVersion: null,
      shouldAdvance: false,
      characterUpdate: null
    })
  })

  it('refuses a batch planned against an older Character stream version', () => {
    expect(() =>
      planEncounterMechanicsBatch({
        batch: batch([], {
          expectedCharacterStreamVersion: STREAM_VERSION - 1,
          effectiveMaximumHitPoints: 12
        }),
        actor,
        userId: USER_ID,
        characterFacts
      })
    ).toThrow('Encounter Character changed after the outcome was planned.')
  })

  describe('an initiative resource restore', () => {
    const owner = { kind: 'AUTHORED_GRANT' as const, resourceGrantId: 'ki' }
    const restore = {
      poolId: createCharacterResourceOwnerKey(owner),
      chargeId: 'ki',
      owner,
      beforeUsed: 20,
      afterUsed: 16,
      beforeRemaining: 0,
      afterRemaining: 4
    }
    const withUsage = (used: number) => ({
      ...characterFacts,
      sheetState: {
        ...characterFacts.sheetState,
        resourceUsage: [
          {
            id: '00000000-0000-4000-8000-00000000e110',
            characterId: CHARACTER_ID,
            owner,
            used,
            createdBy: USER_ID,
            updatedBy: USER_ID,
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP
          }
        ]
      }
    })
    const planRestore = (resourceRestore: typeof restore, facts: ReturnType<typeof withUsage>) =>
      planEncounterMechanicsBatch({
        batch: batch([], {
          expectedCharacterStreamVersion: STREAM_VERSION,
          effectiveMaximumHitPoints: 12,
          characterResourceRestores: [resourceRestore]
        }),
        actor,
        userId: USER_ID,
        characterFacts: facts
      })

    it('lowers the pool usage in the next Character stream version', () => {
      const plan = planRestore(restore, withUsage(20))
      expect(plan.characterStreamVersion).toBe(STREAM_VERSION + 1)
      expect(plan.characterUpdate?.sheetState?.resourceUsage).toMatchObject([
        { owner, used: 16, updatedBy: USER_ID, updatedAt: TIMESTAMP }
      ])
    })

    it.each([
      { name: 'the usage is not what the restore read', restore, used: 19 },
      {
        name: 'the restore would not raise the pool',
        restore: { ...restore, afterUsed: 20 },
        used: 20
      },
      {
        name: 'the restore names another pool',
        restore: { ...restore, poolId: 'AUTHORED_GRANT:other' },
        used: 20
      }
    ])('refuses a stale restore when $name', ({ restore: staleRestore, used }) => {
      expect(() => planRestore(staleRestore, withUsage(used))).toThrow(
        'Encounter Character resource restore is stale.'
      )
    })

    it('refuses a restore for a pool the Character has no usage row for', () => {
      expect(() => planRestore(restore, characterFacts as ReturnType<typeof withUsage>)).toThrow(
        'Encounter Character resource restore is stale.'
      )
    })
  })

  describe('a single-use item used up', () => {
    const ITEM_ID = '00000000-0000-4000-8000-00000000e109'
    const withItem = (quantity: number, used: number) => ({
      ...characterFacts,
      character: {
        ...document,
        state: {
          ...document.state,
          equipment: {
            ...document.state.equipment,
            inventory: [{ id: ITEM_ID, equipmentId: 'antitoxin', quantity }]
          }
        }
      },
      sheetState: {
        ...characterFacts.sheetState,
        itemUsage: used > 0 ? [{ itemInstanceId: ITEM_ID, used }] : []
      }
    })
    const consumption = (beforeQuantity: number, beforeUsed: number) => ({
      characterId: CHARACTER_ID,
      itemInstanceId: ITEM_ID,
      beforeUsed,
      afterUsed: beforeUsed + 1,
      beforeQuantity,
      afterQuantity: beforeQuantity - 1,
      expectedStreamVersion: STREAM_VERSION
    })
    const plan = (facts: ReturnType<typeof withItem>, item: ReturnType<typeof consumption>) =>
      planEncounterMechanicsBatch({
        batch: batch([], {
          expectedCharacterStreamVersion: STREAM_VERSION,
          effectiveMaximumHitPoints: 12,
          characterItemConsumption: item
        }),
        actor,
        userId: USER_ID,
        characterFacts: facts
      })

    it('advances the Character and records one more use, leaving the inventory document alone', () => {
      const planned = plan(withItem(2, 3), consumption(2, 3))
      expect(planned.characterStreamVersion).toBe(STREAM_VERSION + 1)
      expect(planned.characterUpdate?.sheetState?.itemUsage).toEqual([
        { itemInstanceId: ITEM_ID, used: 4 }
      ])
      expect(planned.characterUpdate?.character.state.equipment.inventory).toEqual(
        withItem(2, 3).character.state.equipment.inventory
      )
    })

    it('refuses a consumption planned against another quantity or usage', () => {
      expect(() => plan(withItem(2, 3), consumption(3, 3))).toThrow(
        'Encounter Character item consumption is stale.'
      )
      expect(() => plan(withItem(2, 3), consumption(2, 2))).toThrow(
        'Encounter Character item consumption is stale.'
      )
    })
  })
})

describe('0 hit points (D63)', () => {
  const UNCONSCIOUS = conditionId('UNCONSCIOUS')
  const heal = (input: { amount: number; before: number; maximum: number }) =>
    ({
      ...origin,
      kind: 'HEAL',
      targetActorId: ACTOR_ID,
      requestedAmount: input.amount,
      resolvedAmount: input.amount,
      appliedAmount: Math.min(input.amount, input.maximum - input.before),
      beforeCurrentHitPoints: input.before,
      afterCurrentHitPoints: Math.min(input.before + input.amount, input.maximum),
      beforeTemporaryHitPoints: 0,
      afterTemporaryHitPoints: 0,
      maximumHitPoints: input.maximum
    }) as CharacterRuleActionApplication
  const lethal = damage({
    requested: 9,
    before: { current: 4, temporary: 0 },
    after: { current: 0, temporary: 0 },
    maximum: 11
  })

  it('defeats a Creature in the batch whose damage takes it to 0', () => {
    const plan = planEncounterMechanicsBatch({
      batch: batch([lethal]),
      actor: creature({ current: 4, temporary: 0, max: 11 }),
      userId: USER_ID
    })
    expect(plan.updatedActor).toMatchObject({ currentHitPoints: 0, defeated: true })
  })

  it('defeats a custom actor and one whose hit point maximum is drained to 0', () => {
    const custom = creatureActor({
      id: ACTOR_ID,
      kind: 'CUSTOM',
      currentHitPoints: 4,
      maxHitPoints: 11,
      snapshot: {}
    })
    expect(
      planEncounterMechanicsBatch({ batch: batch([lethal]), actor: custom, userId: USER_ID })
        .updatedActor
    ).toMatchObject({ defeated: true })
    const drained = planEncounterMechanicsBatch({
      batch: batch(
        [
          {
            ...origin,
            kind: 'HIT_POINT_MAXIMUM_REDUCTION',
            targetActorId: ACTOR_ID,
            sourceDamageNodeId: 'damage',
            sourceDamageOperationKey: 'dnd5e.damage',
            sourceDamageOutcomeId: DAMAGE_OUTCOME_ID,
            reductionAmount: 20,
            recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
          }
        ],
        { effectiveMaximumHitPoints: 6 }
      ),
      actor: creature({ current: 6, temporary: 0, max: 6 }),
      userId: USER_ID
    })
    expect(drained.updatedActor).toMatchObject({ maxHitPoints: 0, defeated: true })
  })

  it('revives a defeated Creature that regains hit points', () => {
    const actor = creatureActor({
      id: ACTOR_ID,
      currentHitPoints: 0,
      maxHitPoints: 11,
      defeated: true,
      snapshot: {}
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([heal({ amount: 3, before: 0, maximum: 11 })]),
      actor,
      userId: USER_ID
    })
    expect(plan.updatedActor).toMatchObject({ currentHitPoints: 3, defeated: false })
  })

  it('never defeats an actor that had no hit points to lose', () => {
    const lair = creatureActor({
      id: ACTOR_ID,
      kind: 'CUSTOM',
      currentHitPoints: 0,
      maxHitPoints: 0,
      snapshot: {}
    })
    const plan = planEncounterMechanicsBatch({
      batch: batch([conditionApply(PRONE)], { effectiveMaximumHitPoints: 0 }),
      actor: lair,
      userId: USER_ID
    })
    expect(plan.updatedActor).toMatchObject({ defeated: false })
  })

  describe('Characters fall unconscious instead', () => {
    const empty = createEmptyCharacterAuthored({
      id: CHARACTER_ID,
      systemId: SRD_SYSTEM_ID,
      userId: USER_ID
    })
    const sheetState = characterSheetStateSchema.parse({
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY
    })
    const facts = (
      current: number,
      conditions: { conditionTypeId: string }[],
      deathSaves: CharacterDeathSaves = NO_DEATH_SAVES
    ) => ({
      active: { id: CHARACTER_ID, play: { streamVersion: STREAM_VERSION } },
      character: {
        ...empty,
        state: {
          ...empty.state,
          hitpoints: { current, temp: 0, hitDice: [], deathSaves },
          conditions
        }
      },
      sheetState,
      campaignContext: { conditions: [] }
    })
    const actor = characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID })
    const characterBatch = (applications: CharacterRuleActionApplication[]) =>
      batch(applications, { expectedCharacterStreamVersion: STREAM_VERSION })

    it('adds Unconscious when damage drops a Character to 0, without defeating it', () => {
      const plan = planEncounterMechanicsBatch({
        batch: characterBatch([lethal]),
        actor,
        userId: USER_ID,
        characterFacts: facts(4, [{ conditionTypeId: PRONE }])
      })
      expect(plan.updatedActor).toBe(actor)
      expect(plan.characterUpdate?.character.state).toMatchObject({
        hitpoints: { current: 0 },
        conditions: [{ conditionTypeId: PRONE }, { conditionTypeId: UNCONSCIOUS }]
      })
      // The receipt records the hit point transition; Unconscious follows from it.
      expect(plan.targetTransition.after.conditionIds).toEqual([PRONE])
    })

    it('removes Unconscious when a Character regains hit points from 0', () => {
      const plan = planEncounterMechanicsBatch({
        batch: characterBatch([heal({ amount: 2, before: 0, maximum: 11 })]),
        actor,
        userId: USER_ID,
        characterFacts: facts(0, [{ conditionTypeId: UNCONSCIOUS }])
      })
      expect(plan.characterUpdate?.character.state).toMatchObject({
        hitpoints: { current: 2 },
        conditions: []
      })
    })

    it('keeps a Character already at 0 unconscious when it takes more damage', () => {
      const plan = planEncounterMechanicsBatch({
        batch: characterBatch([
          damage({
            requested: 3,
            before: { current: 0, temporary: 0 },
            after: { current: 0, temporary: 0 },
            maximum: 11
          })
        ]),
        actor,
        userId: USER_ID,
        characterFacts: facts(0, [{ conditionTypeId: UNCONSCIOUS }])
      })
      expect(plan.targetTransition.after.conditionIds).toEqual([UNCONSCIOUS])
    })

    describe('dying and death (D96)', () => {
      const dying = { successes: 1, failures: 1, stable: false }
      const stable = { successes: 3, failures: 0, stable: true }
      const dead = { successes: 0, failures: 3, stable: false }
      const hit = (input: {
        requested: number
        before: number
        after: number
        critical?: boolean
        maximum?: number
      }) =>
        damage({
          requested: input.requested,
          before: { current: input.before, temporary: 0 },
          after: { current: input.after, temporary: 0 },
          maximum: input.maximum ?? 11,
          critical: input.critical ?? false
        })
      const run = (
        application: CharacterRuleActionApplication,
        current: number,
        deathSaves = NO_DEATH_SAVES as CharacterDeathSaves
      ) =>
        planEncounterMechanicsBatch({
          batch: characterBatch([application]),
          actor,
          userId: USER_ID,
          characterFacts: facts(
            current,
            current === 0 ? [{ conditionTypeId: UNCONSCIOUS }] : [],
            deathSaves
          )
        })
      const savesOf = (plan: ReturnType<typeof run>) =>
        plan.characterUpdate?.character.state.hitpoints.deathSaves

      it('leaves a Character dropped to 0 dying, with no failures', () => {
        const plan = run(hit({ requested: 4, before: 4, after: 0 }), 4)
        expect(savesOf(plan)).toEqual(NO_DEATH_SAVES)
        expect(plan.targetTransition.after.deathSaves).toEqual(NO_DEATH_SAVES)
      })

      it('kills a Character outright when the overflow past 0 reaches its maximum', () => {
        const plan = run(hit({ requested: 15, before: 4, after: 0 }), 4)
        expect(savesOf(plan)).toEqual(dead)
        expect(plan.targetTransition.after.deathSaves).toEqual(dead)
        expect(plan.updatedActor).toBe(actor)
      })

      it('does not kill a Character whose overflow is one short of its maximum', () => {
        expect(savesOf(run(hit({ requested: 14, before: 4, after: 0 }), 4))).toEqual(NO_DEATH_SAVES)
      })

      it('adds a failure for damage at 0 and two for a critical hit', () => {
        const plain = run(hit({ requested: 3, before: 0, after: 0 }), 0, dying)
        expect(savesOf(plain)).toEqual({ successes: 1, failures: 2, stable: false })
        expect(plain.targetTransition.before.deathSaves).toEqual(dying)
        const critical = run(hit({ requested: 3, before: 0, after: 0, critical: true }), 0, dying)
        expect(savesOf(critical)).toEqual({ successes: 1, failures: 3, stable: false })
      })

      it('clears stability when a stable Character takes damage', () => {
        expect(savesOf(run(hit({ requested: 1, before: 0, after: 0 }), 0, stable))).toEqual({
          successes: 3,
          failures: 1,
          stable: false
        })
      })

      it('kills a Character at 0 when one hit is at least its maximum', () => {
        expect(savesOf(run(hit({ requested: 11, before: 0, after: 0 }), 0))).toEqual(dead)
      })

      it('resets the saves when a dying Character regains hit points', () => {
        const plan = run(heal({ amount: 2, before: 0, maximum: 11 }), 0, dying)
        expect(savesOf(plan)).toEqual(NO_DEATH_SAVES)
      })

      it('ignores healing for a dead Character', () => {
        const plan = run(heal({ amount: 5, before: 0, maximum: 11 }), 0, dead)
        expect(plan.characterUpdate).toBeNull()
        expect(plan.targetTransition.after).toMatchObject({ currentHitPoints: 0, deathSaves: dead })
      })

      describe('stabilizing', () => {
        const stabilize: CharacterRuleActionApplication = {
          ...origin,
          sourceOperationKey: 'dnd5e.stabilize-proposal',
          kind: 'STABILIZE',
          targetActorId: ACTOR_ID
        }

        it('makes a dying Character stable without changing hit points or conditions', () => {
          const plan = run(stabilize, 0, dying)
          expect(plan.characterUpdate?.character.state).toMatchObject({
            hitpoints: { current: 0, deathSaves: { successes: 0, failures: 0, stable: true } },
            conditions: [{ conditionTypeId: UNCONSCIOUS }]
          })
          expect(plan.targetTransition.before.deathSaves).toEqual(dying)
          expect(plan.targetTransition.after).toMatchObject({
            currentHitPoints: 0,
            deathSaves: { successes: 0, failures: 0, stable: true }
          })
          expect(plan.receiptApplications).toEqual([
            expect.objectContaining({ ordinal: 0, kind: 'STABILIZE', applied: true })
          ])
        })

        it.each([
          ['a Character above 0 hit points', 4, NO_DEATH_SAVES],
          ['an already stable Character', 0, stable],
          ['a dead Character', 0, dead]
        ])('changes nothing for %s', (_label, current, saves) => {
          const plan = run(stabilize, current, saves)
          expect(plan.characterUpdate).toBeNull()
          expect(plan.targetTransition.after.deathSaves).toEqual(saves)
          expect(plan.receiptApplications).toEqual([
            expect.objectContaining({ kind: 'STABILIZE', applied: false })
          ])
        })

        it('is undone by damage, which adds a failure and clears stable', () => {
          const stabilized = run(stabilize, 0, dying).characterUpdate!.character.state.hitpoints
            .deathSaves
          expect(savesOf(run(hit({ requested: 2, before: 0, after: 0 }), 0, stabilized))).toEqual({
            successes: 0,
            failures: 1,
            stable: false
          })
        })
      })

      describe('reviving (SPELLS-4.T2g1)', () => {
        const revive = (
          hitPoints: Extract<CharacterRuleActionApplication, { kind: 'REVIVE' }>['hitPoints']
        ): CharacterRuleActionApplication => ({
          ...origin,
          sourceOperationKey: 'dnd5e.revive-proposal',
          kind: 'REVIVE',
          hitPoints,
          targetActorId: ACTOR_ID
        })

        it('returns a dead Character to 1 hit point with its death saves cleared', () => {
          const plan = run(revive({ kind: 'FIXED', amount: 1 }), 0, dead)
          expect(plan.characterUpdate?.character.state).toMatchObject({
            hitpoints: { current: 1, deathSaves: NO_DEATH_SAVES }
          })
          expect(plan.targetTransition.before.deathSaves).toEqual(dead)
          expect(plan.targetTransition.after).toMatchObject({
            currentHitPoints: 1,
            deathSaves: NO_DEATH_SAVES
          })
          expect(plan.receiptApplications).toEqual([
            expect.objectContaining({
              ordinal: 0,
              kind: 'REVIVE',
              applied: true,
              beforeCurrentHitPoints: 0,
              afterCurrentHitPoints: 1
            })
          ])
        })

        it('returns a dead Character to its maximum hit points', () => {
          expect(run(revive({ kind: 'MAXIMUM' }), 0, dead).targetTransition.after).toMatchObject({
            currentHitPoints: 11,
            deathSaves: NO_DEATH_SAVES
          })
        })

        it.each([
          [5, 5],
          [20, 11]
        ])(
          'returns a dead Character to %i hit points, never above its maximum (%i)',
          (amount, restored) => {
            expect(
              run(revive({ kind: 'FIXED', amount }), 0, dead).targetTransition.after
            ).toMatchObject({ currentHitPoints: restored, deathSaves: NO_DEATH_SAVES })
          }
        )

        it.each([
          ['a dying Character', 0, dying],
          ['a stable Character', 0, stable],
          ['a Character above 0 hit points', 4, NO_DEATH_SAVES]
        ])('changes nothing for %s', (_label, current, saves) => {
          const plan = run(revive({ kind: 'FIXED', amount: 1 }), current, saves)
          expect(plan.characterUpdate).toBeNull()
          expect(plan.targetTransition.after.deathSaves).toEqual(saves)
          expect(plan.targetTransition.after.currentHitPoints).toBe(current)
          expect(plan.receiptApplications).toEqual([
            expect.objectContaining({ kind: 'REVIVE', applied: false })
          ])
        })
      })

      describe('killing (SPELLS-4.T2i)', () => {
        const kill: CharacterRuleActionApplication = {
          ...origin,
          sourceOperationKey: 'dnd5e.kill-proposal',
          kind: 'KILL',
          targetActorId: ACTOR_ID
        }

        it.each([
          ['a healthy Character', 9, NO_DEATH_SAVES],
          ['a dying Character', 0, dying],
          ['a stable Character', 0, stable]
        ])('leaves %s dead at 0 hit points', (_label, current, saves) => {
          const plan = run(kill, current, saves)
          expect(savesOf(plan)).toEqual(dead)
          expect(plan.characterUpdate?.character.state.hitpoints).toMatchObject({
            current: 0,
            temp: 0
          })
          expect(plan.targetTransition.after).toMatchObject({
            currentHitPoints: 0,
            temporaryHitPoints: 0,
            deathSaves: dead
          })
          expect(plan.receiptApplications).toEqual([
            expect.objectContaining({
              kind: 'KILL',
              beforeCurrentHitPoints: current,
              afterCurrentHitPoints: 0,
              afterTemporaryHitPoints: 0
            })
          ])
        })
      })

      describe('dropping to 0 hit points (ATTACK-16.T1d)', () => {
        const toZero: CharacterRuleActionApplication = {
          ...origin,
          sourceOperationKey: 'dnd5e.hit-points-to-zero-proposal',
          kind: 'HIT_POINTS_TO_ZERO',
          targetActorId: ACTOR_ID
        }
        const stabilize: CharacterRuleActionApplication = {
          ...origin,
          sourceOperationKey: 'dnd5e.stabilize-proposal',
          kind: 'STABILIZE',
          targetActorId: ACTOR_ID
        }

        it('leaves a healthy Character dying and unconscious at 0 hit points', () => {
          const plan = run(toZero, 9)
          expect(savesOf(plan)).toEqual(NO_DEATH_SAVES)
          expect(plan.characterUpdate?.character.state).toMatchObject({
            hitpoints: { current: 0, temp: 0 },
            conditions: [{ conditionTypeId: UNCONSCIOUS }]
          })
          expect(plan.targetTransition.after).toMatchObject({
            currentHitPoints: 0,
            temporaryHitPoints: 0
          })
          expect(plan.receiptApplications).toEqual([
            expect.objectContaining({
              kind: 'HIT_POINTS_TO_ZERO',
              beforeCurrentHitPoints: 9,
              afterCurrentHitPoints: 0,
              afterTemporaryHitPoints: 0
            })
          ])
        })

        it('leaves it stable when a stabilize follows in the same result', () => {
          const plan = planEncounterMechanicsBatch({
            batch: characterBatch([toZero, stabilize]),
            actor,
            userId: USER_ID,
            characterFacts: facts(9, [], NO_DEATH_SAVES)
          })
          expect(savesOf(plan)).toMatchObject({ stable: true })
          expect(plan.targetTransition.after).toMatchObject({ currentHitPoints: 0 })
          expect(plan.receiptApplications).toEqual([
            expect.objectContaining({ kind: 'HIT_POINTS_TO_ZERO' }),
            expect.objectContaining({ kind: 'STABILIZE', applied: true })
          ])
        })
      })

      describe('a turn-start death save', () => {
        const save = (rawDie: number, deathSaves = dying as CharacterDeathSaves) =>
          planEncounterMechanicsBatch({
            batch: {
              ...characterBatch([]),
              deathSave: { rawDie, addedTotal: 0 },
              forceVersionAdvance: true
            },
            actor,
            userId: USER_ID,
            characterFacts: facts(0, [{ conditionTypeId: UNCONSCIOUS }], deathSaves)
          })

        it('regains 1 hit point on a 20, resetting the saves and removing Unconscious', () => {
          const plan = save(20)
          expect(plan.characterUpdate?.character.state).toMatchObject({
            hitpoints: { current: 1, deathSaves: NO_DEATH_SAVES },
            conditions: []
          })
          expect(plan.targetTransition.after).toMatchObject({ currentHitPoints: 1 })
        })

        it('adds two failures on a 1', () => {
          expect(savesOf(save(1))).toEqual(dead)
          expect(savesOf(save(1, NO_DEATH_SAVES))).toEqual({
            successes: 0,
            failures: 2,
            stable: false
          })
        })

        it('is dead on the third failure and stable on the third success', () => {
          expect(savesOf(save(5, { successes: 0, failures: 2, stable: false }))).toEqual(dead)
          expect(savesOf(save(14, { successes: 2, failures: 0, stable: false }))).toEqual({
            successes: 0,
            failures: 0,
            stable: true
          })
        })

        it('refuses a Character that is not dying', () => {
          expect(() => save(12, stable)).toThrow('Only a dying Character makes a death save.')
          expect(() => save(12, dead)).toThrow('Only a dying Character makes a death save.')
        })
      })
    })
  })
})
