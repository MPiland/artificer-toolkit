import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { rayOfFrost } from '@artificer-toolkit/source-data/srd/spells/ray-of-frost.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { shockingGrasp } from '@artificer-toolkit/source-data/srd/spells/shocking-grasp.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { attackRollConsumableGrants, planEncounterGrantTicks } from '../encounterGrantLifetimes.js'
import { isTurnEffectEligible } from '../encounterTurnEffectState.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ENCOUNTER_ID,
  TIMESTAMP,
  characterActor,
  creatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { ACTION_EFFECT_ID, characterActionDescriptor } from './characterActionDescriptor.js'

const SOURCE_ID = testUuid(0xc301)
const TARGET_ID = testUuid(0xc302)
const OTHER_ID = testUuid(0xc303)
const CHARACTER_ID = testUuid(0xc304)

type AuthoredEffect = EffectAuthored

type TurnAnchor = NonNullable<PathLifecycleAuthored['turnAnchor']>

/** The authored effect with its grant path(s) carrying the lifecycle, other paths dropped. */
function grantOnly(effect: AuthoredEffect, lifecycle: PathLifecycleAuthored): AuthoredEffect {
  return {
    ...effect,
    paths: effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' &&
      path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'APPLY_GRANT')
        ? [
            {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                lifecycle: { ...path.resultBlock.lifecycle, ...lifecycle }
              }
            }
          ]
        : []
    )
  }
}

function onlyEffect(effects: readonly AuthoredEffect[] | undefined): AuthoredEffect {
  const effect = effects?.[0]
  if (!effect) throw new Error('The SRD record has no effect.')
  return effect
}

/** Grant plans never read the published graph beyond its identity (their graph is their own). */
function identityOnly(): ServerPublishedRuleDefinitionDto {
  return { id: ACTION_EFFECT_ID, checksum: 'a'.repeat(64) } as ServerPublishedRuleDefinitionDto
}

function plansFor(effect: AuthoredEffect, lifecycle: PathLifecycleAuthored) {
  const action = characterActionDescriptor(
    compileEffect({ ...grantOnly(effect, lifecycle), id: ACTION_EFFECT_ID })
  )
  return dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
    action,
    published: identityOnly()
  })
}

const antitoxin = () => onlyEffect(antitoxinVial.effects)

function srdPlan(effect: AuthoredEffect, lifecycle: PathLifecycleAuthored) {
  const plans = plansFor(effect, lifecycle) ?? []
  expect(plans).toHaveLength(1)
  return plans[0]!
}

function execution() {
  return {
    status: 'COMPLETE',
    outputs: {},
    evidence: {
      source: {
        definitionId: ACTION_EFFECT_ID,
        gameSystemId: ENCOUNTER_ID,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum: 'd'.repeat(64)
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: {}
    }
  } satisfies ServerCompletedRuleExecutionDto
}

/** The Encounter effect the real planner stores for the Antitoxin carrying this lifecycle. */
function storedGrant(input: {
  lifecycle: PathLifecycleAuthored
  currentActorId: string | null
  holderId?: string
}) {
  const action = characterActionDescriptor(
    compileEffect({ ...grantOnly(antitoxin(), input.lifecycle), id: ACTION_EFFECT_ID })
  )
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  const [activeEffectPlan] =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
  const holderId = input.holderId ?? TARGET_ID
  const { recurringEffect } = prepareEncounterActionEffectPlans({
    encounterId: ENCOUNTER_ID,
    occurrenceId: testUuid(0xc310),
    commandId: testUuid(0xc311),
    sourceActorId: SOURCE_ID,
    sourceLabel: 'Antitoxin (vial)',
    sourceHidden: false,
    currentActorId: input.currentActorId,
    target: {
      actorId: holderId,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan: activeEffectPlan ?? null,
    published,
    execution: execution(),
    d20: null,
    applications: []
  })
  if (!recurringEffect) throw new Error('No grant effect was planned.')
  return recurringEffect
}

/** The persisted record for a stored grant, with the lifecycle the planner gave it. */
function grantRecord(
  stored: ReturnType<typeof storedGrant>,
  input: { id: number; holderId: string; remainingTicks?: number; createdOrdinal?: number }
): ActiveRuleEffectRecord {
  const record = prepareActiveRuleEffectRecord({
    id: testUuid(input.id),
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: input.holderId },
    definition: stored.definition,
    lifecycle: {
      schemaVersion: 1,
      remainingTicks: input.remainingTicks ?? stored.lifecycle.remainingTicks
    },
    currentEffects: [],
    occurredAt: TIMESTAMP
  })
  return { ...record, createdOrdinal: input.createdOrdinal ?? record.createdOrdinal }
}

const holder = (id: string) => ({ actor: creatureActor({ id, snapshot: {} }), id })

describe('grant plans', () => {
  it.each([
    ['TARGET', 'START_OF_TURN', 'HOLDER'],
    ['TARGET', 'END_OF_TURN', 'HOLDER'],
    ['SOURCE', 'START_OF_TURN', 'SOURCE'],
    ['SOURCE', 'END_OF_TURN', 'SOURCE']
  ] as const)('counts the %s actor at %s', (actor, boundary, tickAnchor) => {
    const turnAnchor: TurnAnchor = { actor, boundary }
    expect(srdPlan(antitoxin(), { turnAnchor })).toMatchObject({
      recurrenceStage: boundary,
      initialRemaining: 600,
      modifierGrantContribution: { tickAnchor }
    })
  })

  it('counts the holder at the end of its turn when nothing says otherwise', () => {
    expect(srdPlan(antitoxin(), {})).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      modifierGrantContribution: { tickAnchor: 'HOLDER', consumeOnFirstEvent: null }
    })
  })

  it('carries a consume-on-attack-roll lifecycle into the plan', () => {
    expect(srdPlan(antitoxin(), { consumeOnFirstEvent: 'ON_ATTACK_ROLL' })).toMatchObject({
      modifierGrantContribution: { consumeOnFirstEvent: 'ON_ATTACK_ROLL' }
    })
  })

  it.each<[string, PathLifecycleAuthored]>([
    ['an end event', { endOnEvents: ['ON_CAST_SPELL'] }],
    ['a recurring kind', { recurringKind: 'NONE' }],
    ['a spell-cast consume event', { consumeOnFirstEvent: 'ON_CAST_SPELL' }]
  ])('stays manual with %s', (_label, lifecycle) => {
    expect(plansFor(antitoxin(), lifecycle)).toEqual([])
  })

  it.each([
    ['Shield', shield, { actor: 'SOURCE', boundary: 'START_OF_TURN' }],
    ['Shocking Grasp', shockingGrasp, { actor: 'TARGET', boundary: 'START_OF_TURN' }],
    ['Ray of Frost', rayOfFrost, { actor: 'SOURCE', boundary: 'START_OF_TURN' }],
    ['Vicious Mockery', viciousMockery, { actor: 'TARGET', boundary: 'END_OF_TURN' }]
  ] as const)(
    'compiles the real %s record once its anchor is authored',
    (_label, spell, anchor) => {
      const plan = srdPlan(onlyEffect(spell.effects), { turnAnchor: anchor })
      expect(plan).toMatchObject({
        recurrenceStage: anchor.boundary,
        modifierGrantContribution: { tickAnchor: anchor.actor === 'SOURCE' ? 'SOURCE' : 'HOLDER' }
      })
      expect(plan.modifierGrantContribution?.modifiers.length).toBeGreaterThan(0)
    }
  )

  it('consumes the real Vicious Mockery grant on the first attack roll', () => {
    expect(
      srdPlan(onlyEffect(viciousMockery.effects), {
        turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' }
      }).modifierGrantContribution?.consumeOnFirstEvent
    ).toBe('ON_ATTACK_ROLL')
  })

  it('compiles the real Unicorn Shimmering Shield once its anchor is authored', () => {
    const effect = onlyEffect(
      unicorn.features
        ?.flatMap((feature) => feature.options ?? [])
        .find((option) => option.label.startsWith('Shimmering Shield'))?.effects
    )
    expect(
      srdPlan(effect, { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } })
    ).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 1,
      modifierGrantContribution: { tickAnchor: 'SOURCE' }
    })
  })
})

describe('stored grants', () => {
  it('are not selected by the turn-effect kernel at either boundary', () => {
    const { definition, lifecycle } = storedGrant({ lifecycle: {}, currentActorId: SOURCE_ID })
    const record = grantRecord({ definition, lifecycle }, { id: 0xc320, holderId: TARGET_ID })
    const state = { id: ENCOUNTER_ID } as Parameters<typeof isTurnEffectEligible>[2]
    const actor = creatureActor({ id: TARGET_ID, snapshot: {} })
    expect(definition.recurrence.recurrenceStage).toBe('NONE')
    expect(isTurnEffectEligible(record, actor, state, 'START_OF_TURN')).toBe(false)
    expect(isTurnEffectEligible(record, actor, state, 'END_OF_TURN')).toBe(false)
  })

  it('store the authored decrement boundary and anchor without a recurrence stage', () => {
    const { definition } = storedGrant({
      lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } },
      currentActorId: OTHER_ID
    })
    expect(definition.recurrence).toMatchObject({
      recurrenceStage: 'NONE',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 600,
        decrementStage: 'START_OF_TURN',
        anchor: 'SOURCE'
      }
    })
  })

  it('store the consume-on-attack-roll event', () => {
    const { definition } = storedGrant({
      lifecycle: { consumeOnFirstEvent: 'ON_ATTACK_ROLL' },
      currentActorId: null
    })
    expect(definition.recurrence.consumeOnFirstEvent).toBe('ON_ATTACK_ROLL')
  })

  describe('created on the anchor actor’s own turn', () => {
    it.each([
      ['TARGET', 'END_OF_TURN', TARGET_ID, 601],
      ['TARGET', 'END_OF_TURN', OTHER_ID, 600],
      ['TARGET', 'START_OF_TURN', TARGET_ID, 600],
      ['SOURCE', 'END_OF_TURN', SOURCE_ID, 601],
      ['SOURCE', 'END_OF_TURN', OTHER_ID, 600],
      ['SOURCE', 'START_OF_TURN', SOURCE_ID, 600],
      ['TARGET', 'END_OF_TURN', null, 600]
    ] as const)(
      'counts %s at %s on the turn of %s as %s ticks',
      (actor, boundary, currentActorId, ticks) => {
        const { definition, lifecycle } = storedGrant({
          lifecycle: { turnAnchor: { actor, boundary } },
          currentActorId
        })
        expect(lifecycle.remainingTicks).toBe(ticks)
        expect(definition.recurrence.expiration).toMatchObject({
          kind: 'TICKS',
          initialRemaining: ticks
        })
      }
    )
  })
})

describe('planEncounterGrantTicks', () => {
  const grant = (
    lifecycle: PathLifecycleAuthored,
    input: { id: number; holderId: string; remainingTicks?: number; createdOrdinal?: number }
  ) =>
    grantRecord(storedGrant({ lifecycle, currentActorId: null, holderId: input.holderId }), input)

  const plan = (
    stage: 'START_OF_TURN' | 'END_OF_TURN',
    turnActorId: string,
    holders: Parameters<typeof planEncounterGrantTicks>[0]['holders']
  ) => planEncounterGrantTicks({ encounterId: ENCOUNTER_ID, stage, turnActorId, holders })

  it('counts a holder-anchored grant down at the holder’s boundary only', () => {
    const effect = grant({}, { id: 0xc330, holderId: TARGET_ID, remainingTicks: 3 })
    const holders = [{ actor: holder(TARGET_ID).actor, effects: [effect] }]
    expect(plan('END_OF_TURN', TARGET_ID, holders)).toMatchObject([
      { kind: 'UPDATE', effect: { id: effect.id }, remainingTicks: 2 }
    ])
    expect(plan('END_OF_TURN', OTHER_ID, holders)).toEqual([])
    expect(plan('START_OF_TURN', TARGET_ID, holders)).toEqual([])
  })

  it('expires a grant on its last counted boundary', () => {
    const effect = grant({}, { id: 0xc331, holderId: TARGET_ID, remainingTicks: 1 })
    expect(
      plan('END_OF_TURN', TARGET_ID, [{ actor: holder(TARGET_ID).actor, effects: [effect] }])
    ).toMatchObject([{ kind: 'EXPIRE', effect: { id: effect.id } }])
  })

  it('counts a source-anchored grant on the source’s turn, whoever holds it', () => {
    const effect = grant(
      { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } },
      { id: 0xc332, holderId: TARGET_ID, remainingTicks: 1 }
    )
    const holders = [
      { actor: holder(TARGET_ID).actor, effects: [effect] },
      { actor: holder(SOURCE_ID).actor, effects: [] }
    ]
    expect(plan('START_OF_TURN', SOURCE_ID, holders)).toMatchObject([
      { kind: 'EXPIRE', effect: { id: effect.id }, owner: { targetActorId: TARGET_ID } }
    ])
    expect(plan('START_OF_TURN', TARGET_ID, holders)).toEqual([])
    expect(plan('END_OF_TURN', SOURCE_ID, holders)).toEqual([])
  })

  it('counts Character-held grants against the Character’s own owner', () => {
    const stored = storedGrant({ lifecycle: {}, currentActorId: null, holderId: CHARACTER_ID })
    const effect = prepareActiveRuleEffectRecord({
      id: testUuid(0xc333),
      owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
      definition: stored.definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 5 },
      currentEffects: [],
      occurredAt: TIMESTAMP
    })
    const actor = characterActor({ id: TARGET_ID, characterId: CHARACTER_ID })
    expect(plan('END_OF_TURN', TARGET_ID, [{ actor, effects: [effect] }])).toMatchObject([
      {
        kind: 'UPDATE',
        remainingTicks: 4,
        owner: { kind: 'CHARACTER', characterId: CHARACTER_ID }
      }
    ])
  })

  it('leaves another Encounter’s Character-held grant alone', () => {
    const stored = storedGrant({ lifecycle: {}, currentActorId: null, holderId: CHARACTER_ID })
    const foreign = prepareActiveRuleEffectRecord({
      id: testUuid(0xc334),
      owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
      definition: {
        ...stored.definition,
        origin: {
          ...stored.definition.origin,
          sourceAggregateId: testUuid(0xc3ff)
        }
      },
      lifecycle: { schemaVersion: 1, remainingTicks: 5 },
      currentEffects: [],
      occurredAt: TIMESTAMP
    })
    const actor = characterActor({ id: TARGET_ID, characterId: CHARACTER_ID })
    expect(plan('END_OF_TURN', TARGET_ID, [{ actor, effects: [foreign] }])).toEqual([])
  })

  it('orders ticks by creation and skips effects the kernel owns', () => {
    const later = grant(
      {},
      { id: 0xc335, holderId: TARGET_ID, remainingTicks: 4, createdOrdinal: 7 }
    )
    const earlier = grant(
      {},
      { id: 0xc336, holderId: TARGET_ID, remainingTicks: 4, createdOrdinal: 2 }
    )
    const kernelOwned = {
      ...grant({}, { id: 0xc337, holderId: TARGET_ID, remainingTicks: 4 }),
      definition: {
        ...later.definition,
        recurrence: { ...later.definition.recurrence, recurrenceStage: 'END_OF_TURN' as const }
      }
    }
    const result = plan('END_OF_TURN', TARGET_ID, [
      { actor: holder(TARGET_ID).actor, effects: [later, kernelOwned, earlier] }
    ])
    expect(result.map(({ effect }) => effect.id)).toEqual([earlier.id, later.id])
  })
})

describe('attackRollConsumableGrants', () => {
  it('lists only the grants an attack roll uses up', () => {
    const consumable = grantRecord(
      storedGrant({ lifecycle: { consumeOnFirstEvent: 'ON_ATTACK_ROLL' }, currentActorId: null }),
      { id: 0xc340, holderId: TARGET_ID }
    )
    const plain = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id: 0xc341,
      holderId: TARGET_ID
    })
    expect(attackRollConsumableGrants([plain, consumable]).map(({ id }) => id)).toEqual([
      consumable.id
    ])
  })
})
