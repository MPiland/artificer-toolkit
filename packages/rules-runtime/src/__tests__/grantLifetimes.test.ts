import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { aid } from '@artificer-toolkit/source-data/srd/spells/aid.js'
import { darkvision } from '@artificer-toolkit/source-data/srd/spells/darkvision.js'
import { fly } from '@artificer-toolkit/source-data/srd/spells/fly.js'
import { heroism } from '@artificer-toolkit/source-data/srd/spells/heroism.js'
import { rayOfFrost } from '@artificer-toolkit/source-data/srd/spells/ray-of-frost.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { shieldOfFaith } from '@artificer-toolkit/source-data/srd/spells/shield-of-faith.js'
import { shockingGrasp } from '@artificer-toolkit/source-data/srd/spells/shocking-grasp.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import {
  consumableGrants,
  expiredCarriedOverGrants,
  grantsEndedByHolderState,
  planCarriedOverGrants,
  planConcentrationCarriedGrantEnds,
  planDepartedSourceGrantRemovals,
  planEncounterGrantTicks,
  stateBoundGrants
} from '../encounterGrantLifetimes.js'
import { isTurnEffectEligible } from '../encounterTurnEffectState.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID } from '../systems/dnd5e/identity.js'
import {
  ENCOUNTER_ID,
  TIMESTAMP,
  characterActor,
  creatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { grantPublishedIdentity } from '../testing/modifierGrantFixture.js'
import { grantOnly, protectionFromEnergyChoice } from './antitoxinEffectFixture.js'

const SOURCE_ID = testUuid(0xc301)
const TARGET_ID = testUuid(0xc302)
const OTHER_ID = testUuid(0xc303)
const CHARACTER_ID = testUuid(0xc304)

type AuthoredEffect = EffectAuthored

type TurnAnchor = NonNullable<PathLifecycleAuthored['turnAnchor']>

function onlyEffect(effects: readonly AuthoredEffect[] | undefined): AuthoredEffect {
  const effect = effects?.[0]
  if (!effect) throw new Error('The SRD record has no effect.')
  return effect
}

/** Grant plans never read the published graph beyond its identity (their graph is their own). */
function plansFor(effect: AuthoredEffect, lifecycle: PathLifecycleAuthored) {
  const action = characterActionDescriptor(
    compileEffect({ ...grantOnly(effect, lifecycle), id: ACTION_EFFECT_ID })
  )
  return dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
    action,
    published: grantPublishedIdentity()
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
  effect?: AuthoredEffect
  lifetimeScope?: 'OWNER' | 'ENCOUNTER'
}) {
  const action = characterActionDescriptor(
    compileEffect({
      ...grantOnly(input.effect ?? antitoxin(), input.lifecycle),
      id: ACTION_EFFECT_ID
    })
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
      lifetimeScope: input.lifetimeScope ?? 'ENCOUNTER',
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
      modifierGrantContribution: { tickAnchor: 'HOLDER', consumeOnFirstEvents: [] }
    })
  })

  it('carries a consume-on-attack-roll lifecycle into the plan', () => {
    expect(srdPlan(antitoxin(), { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] })).toMatchObject({
      modifierGrantContribution: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] }
    })
  })

  it('carries a sorted, unique list of consume events into the plan', () => {
    expect(
      srdPlan(antitoxin(), {
        consumeOnFirstEvents: ['ON_ATTACK_ROLL', 'ON_ABILITY_CHECK', 'ON_ATTACK_ROLL']
      })
    ).toMatchObject({
      modifierGrantContribution: { consumeOnFirstEvents: ['ON_ABILITY_CHECK', 'ON_ATTACK_ROLL'] }
    })
  })

  it.each<[string, PathLifecycleAuthored]>([
    ['an end event', { endOnEvents: ['ON_CAST_SPELL'] }],
    ['a recurring kind', { recurringKind: 'NONE' }],
    ['a spell-cast consume event', { consumeOnFirstEvents: ['ON_CAST_SPELL'] }]
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

  it('compiles the real Darkvision sense grant', () => {
    expect(srdPlan(onlyEffect(darkvision.effects), {})).toMatchObject({
      initialRemaining: 4800,
      modifierGrantContribution: { modifiers: [], senses: [{ range: { amount: 60 } }] }
    })
  })

  it('leaves the real Aid manual until casting resolves its slot-scaled bonus', () => {
    expect(plansFor(onlyEffect(aid.effects), {})).toEqual([])
  })

  it('consumes the real Vicious Mockery grant on the first attack roll', () => {
    expect(
      srdPlan(onlyEffect(viciousMockery.effects), {
        turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' }
      }).modifierGrantContribution?.consumeOnFirstEvents
    ).toEqual(['ON_ATTACK_ROLL'])
  })

  it.each([
    ['Fly', onlyEffect(fly.effects)],
    ['Heroism', onlyEffect(heroism.effects)],
    ['Shield of Faith', onlyEffect(shieldOfFaith.effects)],
    ['Protection from Energy', protectionFromEnergyChoice('Fire')]
  ])('makes the real %s grant depend on the caster’s Concentration', (_label, effect) => {
    expect(srdPlan(effect, {}).maintenance).toEqual({
      definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: null,
      owner: 'SOURCE_ACTOR',
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    })
  })

  it('leaves a grant without Concentration unmaintained', () => {
    expect(srdPlan(antitoxin(), {}).maintenance).toBeNull()
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
  it('outlast the Encounter on a Character, Concentration grants included (D99 SPELLS-5.7)', () => {
    const lifetime = (effect: AuthoredEffect, lifetimeScope: 'OWNER' | 'ENCOUNTER') =>
      storedGrant({ lifecycle: {}, currentActorId: null, effect, lifetimeScope }).definition
        .recurrence.lifetimeScope
    expect(lifetime(antitoxin(), 'OWNER')).toBe('OWNER')
    expect(lifetime(onlyEffect(shieldOfFaith.effects), 'OWNER')).toBe('OWNER')
  })

  it('stay Encounter-scoped on a Creature, Concentration or not', () => {
    const lifetime = (effect: AuthoredEffect) =>
      storedGrant({ lifecycle: {}, currentActorId: null, effect, lifetimeScope: 'ENCOUNTER' })
        .definition.recurrence.lifetimeScope
    expect(lifetime(antitoxin())).toBe('ENCOUNTER')
    expect(lifetime(onlyEffect(shieldOfFaith.effects))).toBe('ENCOUNTER')
  })

  it('keep the Run as their source only while a Concentration state maintains them', () => {
    const { definition, lifecycle } = storedGrant({
      lifecycle: {},
      currentActorId: null,
      effect: onlyEffect(shieldOfFaith.effects),
      lifetimeScope: 'OWNER'
    })
    const record = (maintainedEffectStateId: string | null) =>
      prepareActiveRuleEffectRecord({
        id: testUuid(0xc330),
        owner: { kind: 'CHARACTER', characterId: testUuid(0xc331) },
        definition,
        lifecycle,
        maintainedEffectStateId,
        currentEffects: [],
        occurredAt: TIMESTAMP
      })
    expect(record(testUuid(0xc332))).toMatchObject({
      sourceEncounterId: ENCOUNTER_ID,
      maintainedEffectStateId: testUuid(0xc332)
    })
    expect(record(null)).toMatchObject({ sourceEncounterId: null, maintainedEffectStateId: null })
  })

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
      lifecycle: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] },
      currentActorId: null
    })
    expect(definition.recurrence.consumeOnFirstEvents).toEqual(['ON_ATTACK_ROLL'])
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

describe('a basic action’s grant made on the holder’s own turn', () => {
  const basicActionEffect = (id: string) =>
    onlyEffect(SRD_BASIC_ACTION_DEFINITIONS.find((entry) => entry.id === id)?.document.effects)
  const endOfOwnTurn = { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } } as const
  const ticksOnOwnTurn = (effect: AuthoredEffect, lifecycle: PathLifecycleAuthored) =>
    storedGrant({ effect, lifecycle, currentActorId: SOURCE_ID, holderId: SOURCE_ID }).lifecycle
      .remainingTicks

  it('lasts through the end of that turn when its duration is a turn (Disengage)', () => {
    expect(ticksOnOwnTurn(basicActionEffect(SRD_BASIC_ACTION_IDS.DISENGAGE), {})).toBe(1)
  })

  it('still counts one more end of turn when its duration is a round', () => {
    expect(ticksOnOwnTurn(basicActionEffect(SRD_BASIC_ACTION_IDS.DODGE), endOfOwnTurn)).toBe(2)
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

describe('a Help made on the helper’s own turn', () => {
  const helpEffect = onlyEffect(
    SRD_BASIC_ACTION_DEFINITIONS.find((entry) => entry.id === SRD_BASIC_ACTION_IDS.HELP)?.document
      .effects
  )
  // The ally holds the grant; the helper (the source) made it on its own turn.
  const stored = storedGrant({
    effect: helpEffect,
    lifecycle: {},
    currentActorId: SOURCE_ID,
    holderId: TARGET_ID
  })
  const record = grantRecord(stored, { id: 0xc360, holderId: TARGET_ID })
  const plan = (stage: 'START_OF_TURN' | 'END_OF_TURN', turnActorId: string) =>
    planEncounterGrantTicks({
      encounterId: ENCOUNTER_ID,
      stage,
      turnActorId,
      holders: [
        { actor: holder(TARGET_ID).actor, effects: [record] },
        { actor: holder(SOURCE_ID).actor, effects: [] }
      ]
    })

  it('counts one boundary: the start of the helper’s next turn', () => {
    expect(record.lifecycle.remainingTicks).toBe(1)
  })

  it('survives the ally’s own turn coming first, and the helper’s end of turn', () => {
    expect(plan('START_OF_TURN', TARGET_ID)).toEqual([])
    expect(plan('END_OF_TURN', TARGET_ID)).toEqual([])
    expect(plan('START_OF_TURN', OTHER_ID)).toEqual([])
    expect(plan('END_OF_TURN', SOURCE_ID)).toEqual([])
  })

  it('ends at the start of the helper’s next turn, unused or not', () => {
    expect(plan('START_OF_TURN', SOURCE_ID)).toMatchObject([
      { kind: 'EXPIRE', effect: { id: record.id }, owner: { targetActorId: TARGET_ID } }
    ])
  })
})

describe('a Rage made on the Barbarian’s own turn', () => {
  const rage = onlyEffect(barbarian.features?.find(({ label }) => label === 'Rage')?.effects)
  const stored = (currentActorId: string | null) =>
    storedGrant({ effect: rage, lifecycle: {}, currentActorId, holderId: TARGET_ID })
  const record = grantRecord(stored(TARGET_ID), { id: 0xc370, holderId: TARGET_ID })
  const plan = (turnActorId: string, effects: ActiveRuleEffectRecord[]) =>
    planEncounterGrantTicks({
      encounterId: ENCOUNTER_ID,
      stage: 'END_OF_TURN',
      turnActorId,
      holders: [{ actor: holder(TARGET_ID).actor, effects }]
    })

  it('compiles to a one-minute holder-counted grant ended by Unconscious or its holder', () => {
    expect(srdPlan(rage, {})).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      modifierGrantContribution: {
        tickAnchor: 'HOLDER',
        endOnEvents: [],
        endOnConditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID],
        holderEnd: { activation: 'BONUS_ACTION' }
      }
    })
    expect(stored(TARGET_ID).definition.recurrence).toMatchObject({
      endOnEvents: [],
      endOnConditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID],
      holderEnd: { activation: 'BONUS_ACTION' }
    })
  })

  it('lasts through the end of that turn and ten more rounds', () => {
    expect(record.lifecycle.remainingTicks).toBe(11)
    expect(stored(OTHER_ID).lifecycle.remainingTicks).toBe(10)
  })

  it('counts down at the Barbarian’s end of turn only, and expires on the last one', () => {
    expect(plan(OTHER_ID, [record])).toEqual([])
    expect(plan(TARGET_ID, [record])).toMatchObject([{ kind: 'UPDATE', remainingTicks: 10 }])
    const last = grantRecord(stored(TARGET_ID), {
      id: 0xc371,
      holderId: TARGET_ID,
      remainingTicks: 1
    })
    expect(plan(TARGET_ID, [last])).toMatchObject([{ kind: 'EXPIRE', effect: { id: last.id } }])
  })

  it('is among the grants that follow their holder’s state, which an Antitoxin is not', () => {
    const antitoxinRecord = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id: 0xc372,
      holderId: TARGET_ID
    })
    expect(stateBoundGrants([antitoxinRecord, record]).map(({ id }) => id)).toEqual([record.id])
  })

  it('ends while its holder is Unconscious, and stays through Stunned and incapacitation', () => {
    const stunned = conditionTypeId('STUNNED')
    expect(
      grantsEndedByHolderState([record], {
        reason: null,
        conditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID]
      }).map(({ id }) => id)
    ).toEqual([record.id])
    expect(
      grantsEndedByHolderState([record], { reason: 'INCAPACITATED', conditionIds: [stunned] })
    ).toEqual([])
    expect(grantsEndedByHolderState([record], { reason: 'DEFEATED', conditionIds: [] })).toEqual([])
  })

  it('reads no conditions from a defeated holder, as persistence does', () => {
    expect(
      grantsEndedByHolderState([record], {
        reason: 'DEFEATED',
        conditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID]
      })
    ).toEqual([])
  })
})

describe('a grant that ends on incapacitation', () => {
  const incapacitation = grantRecord(
    storedGrant({ lifecycle: { endOnEvents: ['ON_INCAPACITATED'] }, currentActorId: null }),
    { id: 0xc373, holderId: TARGET_ID }
  )

  it.each([['INCAPACITATED' as const], ['DEFEATED' as const]])(
    'ends when its holder is %s, whatever conditions it has',
    (reason) => {
      expect(
        grantsEndedByHolderState([incapacitation], { reason, conditionIds: [] }).map(({ id }) => id)
      ).toEqual([incapacitation.id])
    }
  )

  it.each([[null], ['SPELLCASTING_LOCKED' as const]])('stays when its holder is %s', (reason) => {
    expect(
      grantsEndedByHolderState([incapacitation], {
        reason,
        conditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID]
      })
    ).toEqual([])
  })
})

describe('consumableGrants', () => {
  const held = (id: number, events: ('ON_ATTACK_ROLL' | 'ON_ABILITY_CHECK')[]) =>
    grantRecord(
      storedGrant({ lifecycle: { consumeOnFirstEvents: events }, currentActorId: null }),
      {
        id,
        holderId: TARGET_ID
      }
    )
  const plain = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
    id: 0xc341,
    holderId: TARGET_ID
  })

  it('lists only the grants an attack roll uses up', () => {
    const consumable = held(0xc340, ['ON_ATTACK_ROLL'])
    expect(consumableGrants([plain, consumable], 'ON_ATTACK_ROLL').map(({ id }) => id)).toEqual([
      consumable.id
    ])
  })

  it('lists only the grants an ability check uses up', () => {
    const check = held(0xc342, ['ON_ABILITY_CHECK'])
    const both = held(0xc343, ['ON_ABILITY_CHECK', 'ON_ATTACK_ROLL'])
    const attackOnly = held(0xc344, ['ON_ATTACK_ROLL'])
    expect(
      consumableGrants([plain, check, both, attackOnly], 'ON_ABILITY_CHECK').map(({ id }) => id)
    ).toEqual([check.id, both.id])
  })
})

describe('planDepartedSourceGrantRemovals', () => {
  const sourceAnchored = { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } } as const
  const grant = (input: { id: number; holderId: string; lifecycle?: PathLifecycleAuthored }) =>
    grantRecord(
      storedGrant({ lifecycle: input.lifecycle ?? sourceAnchored, currentActorId: null }),
      { id: input.id, holderId: input.holderId, remainingTicks: 1 }
    )
  const plan = (holders: Parameters<typeof planDepartedSourceGrantRemovals>[0]['holders']) =>
    planDepartedSourceGrantRemovals({
      encounterId: ENCOUNTER_ID,
      departedActorId: SOURCE_ID,
      holders
    })

  it('ends a grant whose source anchor left the Run, whoever holds it', () => {
    const held = grant({ id: 0xc350, holderId: TARGET_ID })
    const alsoHeld = grant({ id: 0xc351, holderId: OTHER_ID })
    expect(
      plan([
        { actor: holder(TARGET_ID).actor, effects: [held] },
        { actor: holder(OTHER_ID).actor, effects: [alsoHeld] }
      ]).map(({ id }) => id)
    ).toEqual([held.id, alsoHeld.id])
  })

  it('ends a Character-held grant anchored to the departed source', () => {
    const stored = storedGrant({ lifecycle: sourceAnchored, currentActorId: null })
    const effect = prepareActiveRuleEffectRecord({
      id: testUuid(0xc352),
      owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
      definition: stored.definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 1 },
      currentEffects: [],
      occurredAt: TIMESTAMP
    })
    const actor = characterActor({ id: TARGET_ID, characterId: CHARACTER_ID })
    expect(plan([{ actor, effects: [effect] }]).map(({ id }) => id)).toEqual([effect.id])
  })

  it('leaves a holder-anchored grant to its own lifetime', () => {
    const holderAnchored = grant({ id: 0xc353, holderId: TARGET_ID, lifecycle: {} })
    expect(plan([{ actor: holder(TARGET_ID).actor, effects: [holderAnchored] }])).toEqual([])
  })

  it('leaves a grant anchored to another source untouched', () => {
    const effect = grant({ id: 0xc354, holderId: TARGET_ID })
    const other = {
      ...effect,
      definition: {
        ...effect.definition,
        origin: { ...effect.definition.origin, sourceActorId: OTHER_ID }
      }
    }
    expect(plan([{ actor: holder(TARGET_ID).actor, effects: [other] }])).toEqual([])
  })

  it('leaves another Encounter’s grant alone', () => {
    const effect = grant({ id: 0xc355, holderId: TARGET_ID })
    const foreign = {
      ...effect,
      definition: {
        ...effect.definition,
        origin: { ...effect.definition.origin, sourceAggregateId: testUuid(0xc3fe) }
      }
    }
    expect(plan([{ actor: holder(TARGET_ID).actor, effects: [foreign] }])).toEqual([])
  })
})

describe('planCarriedOverGrants', () => {
  const grant = (id: number, remainingTicks: number) =>
    grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id,
      holderId: TARGET_ID,
      remainingTicks
    })

  it('expires a timed grant 6 seconds per remaining round after the clock, in whole minutes', () => {
    const [ten, eleven] = [grant(0xc360, 10), grant(0xc361, 11)]
    expect(planCarriedOverGrants({ effects: [ten, eleven], clockMinute: 2000 })).toEqual([
      {
        effect: ten,
        lifecycle: { schemaVersion: 1, remainingTicks: null, expiresAtCampaignMinute: 2001 }
      },
      {
        effect: eleven,
        lifecycle: { schemaVersion: 1, remainingTicks: null, expiresAtCampaignMinute: 2002 }
      }
    ])
  })

  it('stops a timed grant counting without a clock, so it lasts until the GM ends it', () => {
    const effect = grant(0xc362, 4)
    expect(planCarriedOverGrants({ effects: [effect], clockMinute: null })).toEqual([
      {
        effect,
        lifecycle: { schemaVersion: 1, remainingTicks: null, expiresAtCampaignMinute: null }
      }
    ])
  })

  it('keeps the caster stamp of a detached Concentration grant', () => {
    const stampedGrant = (id: number, caster: string | null) => {
      const effect = grant(id, 4)
      return {
        ...effect,
        lifecycle: { ...effect.lifecycle, concentrationCasterCharacterId: caster }
      }
    }
    const stamped = stampedGrant(0xc36a, CHARACTER_ID)
    const creatureCast = stampedGrant(0xc36b, null)
    expect(planCarriedOverGrants({ effects: [stamped, creatureCast], clockMinute: 2000 })).toEqual([
      {
        effect: stamped,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: null,
          concentrationCasterCharacterId: CHARACTER_ID,
          expiresAtCampaignMinute: 2001
        }
      },
      {
        effect: creatureCast,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: null,
          concentrationCasterCharacterId: null,
          expiresAtCampaignMinute: 2001
        }
      }
    ])
  })

  it('leaves an untimed grant alone', () => {
    const effect = grant(0xc363, 4)
    const untimed = { ...effect, lifecycle: { schemaVersion: 1 as const, remainingTicks: null } }
    expect(planCarriedOverGrants({ effects: [untimed], clockMinute: 2000 })).toEqual([])
  })
})

describe('planConcentrationCarriedGrantEnds', () => {
  const carried = (
    id: number,
    caster: string | null,
    ownerKind: 'CHARACTER' | 'ENCOUNTER_ACTOR'
  ) => {
    const effect = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id,
      holderId: TARGET_ID,
      remainingTicks: 4
    })
    return {
      ...effect,
      owner:
        ownerKind === 'CHARACTER'
          ? ({ kind: 'CHARACTER', characterId: CHARACTER_ID } as const)
          : effect.owner,
      lifecycle: { ...effect.lifecycle, concentrationCasterCharacterId: caster }
    }
  }

  it('picks only the Character grants stamped with the Character who started the Concentration', () => {
    const mine = carried(0xc380, CHARACTER_ID, 'CHARACTER')
    const effects = [
      mine,
      carried(0xc381, testUuid(0xc3f0), 'CHARACTER'),
      carried(0xc382, null, 'CHARACTER'),
      carried(0xc383, CHARACTER_ID, 'ENCOUNTER_ACTOR')
    ]
    expect(planConcentrationCarriedGrantEnds({ casterCharacterId: CHARACTER_ID, effects })).toEqual(
      [mine]
    )
  })

  it('never ends an unstamped grant, whichever caster starts a Concentration', () => {
    const effect = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id: 0xc384,
      holderId: TARGET_ID,
      remainingTicks: 4
    })
    const unstamped = {
      ...effect,
      owner: { kind: 'CHARACTER', characterId: CHARACTER_ID } as const
    }
    expect(
      planConcentrationCarriedGrantEnds({ casterCharacterId: CHARACTER_ID, effects: [unstamped] })
    ).toEqual([])
  })
})

describe('expiredCarriedOverGrants', () => {
  it('lists the grants whose clock expiry the clock has reached', () => {
    const effect = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id: 0xc364,
      holderId: TARGET_ID
    })
    const expiring = (id: number, expiresAtCampaignMinute?: number) => ({
      ...effect,
      id: testUuid(id),
      lifecycle: {
        schemaVersion: 1 as const,
        remainingTicks: null,
        ...(expiresAtCampaignMinute === undefined ? {} : { expiresAtCampaignMinute })
      }
    })
    const [due, reached, later, untimed, unclocked] = [
      expiring(0xc365, 1999),
      expiring(0xc366, 2000),
      expiring(0xc367, 2001),
      expiring(0xc368),
      {
        ...expiring(0xc369),
        lifecycle: {
          schemaVersion: 1 as const,
          remainingTicks: null,
          expiresAtCampaignMinute: null
        }
      }
    ]
    expect(expiredCarriedOverGrants([due, reached, later, untimed, unclocked], 2000)).toEqual([
      due,
      reached
    ])
  })
})
