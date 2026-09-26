import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '@artificer-toolkit/schema/api/healthDisplay'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import {
  planEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '../encounterMechanicsBatchPlan.js'
import { characterActor, creatureActor, ENCOUNTER_ID, TIMESTAMP } from './encounterStateFixtures.js'

const ACTOR_ID = '00000000-0000-4000-8000-00000000e101'
const CHARACTER_ID = '00000000-0000-4000-8000-00000000e102'
const USER_ID = '00000000-0000-4000-8000-00000000e103'
const ACTIVE_EFFECT_ID = '00000000-0000-4000-8000-00000000e104'
const DAMAGE_OUTCOME_ID = '00000000-0000-4000-8000-00000000e105'
const STREAM_VERSION = 4

const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const PRONE = conditionId('PRONE')
const POISONED = conditionId('POISONED')
const RESTRAINED = conditionId('RESTRAINED')
const FRIGHTENED = conditionId('FRIGHTENED')
const NECROTIC = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'NECROTIC')!.id

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
    sourceCommandId: '00000000-0000-4000-8000-00000000e107',
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
}): CharacterRuleActionApplication {
  return {
    ...origin,
    kind: 'DAMAGE',
    targetActorId: ACTOR_ID,
    damageTypeId: NECROTIC,
    damageDisposition: input.disposition ?? 'NORMAL',
    requestedAmount: input.requested,
    resolvedAmount: input.resolved ?? input.requested,
    appliedAmount:
      input.before.current - input.after.current + input.before.temporary - input.after.temporary,
    beforeCurrentHitPoints: input.before.current,
    afterCurrentHitPoints: input.after.current,
    beforeTemporaryHitPoints: input.before.temporary,
    afterTemporaryHitPoints: input.after.temporary,
    maximumHitPoints: input.maximum
  }
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
    before: withScalars(before),
    after: withScalars(after)
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
        conditions: []
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
      stateChanged: true,
      shouldAdvance: false,
      characterUpdate: null
    })
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
      conditions: []
    })
    expect(plan.targetTransition.after).toEqual({
      currentHitPoints: 6,
      temporaryHitPoints: 0,
      maximumHitPoints: 7,
      conditionIds: [],
      scalarValues: {}
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
      name: 'spell slot usage',
      overrides: { spellSlotUsage: [{ slotKey: 'STANDARD:1', used: 1 }] },
      message: 'Encounter non-Character actors cannot use spell slots.'
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
      hitpoints: { current: 10, temp: 0, hitDice: [] },
      conditions: [{ conditionTypeId: PRONE }]
    }
  }
  const characterFacts = {
    active: { id: CHARACTER_ID, streamVersion: STREAM_VERSION },
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
          hitpoints: { current: 6, temp: 0, hitDice: [] },
          conditions: [{ conditionTypeId: RESTRAINED }]
        }
      },
      sheetState: null
    })
    // The Campaign's own condition counts toward the target state but is not written to the Sheet.
    expect(plan.targetTransition.before.conditionIds).toEqual([PRONE, FRIGHTENED])
    expect(plan.targetTransition.after.conditionIds).toEqual([FRIGHTENED, RESTRAINED])
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
})
