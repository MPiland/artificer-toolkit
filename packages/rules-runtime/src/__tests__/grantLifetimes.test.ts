import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  EffectAuthored,
  PathLifecycleAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { aid } from '@artificer-toolkit/source-data/srd/spells/aid.js'
import { colorSpray } from '@artificer-toolkit/source-data/srd/spells/color-spray.js'
import { darkvision } from '@artificer-toolkit/source-data/srd/spells/darkvision.js'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { fly } from '@artificer-toolkit/source-data/srd/spells/fly.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { heroism } from '@artificer-toolkit/source-data/srd/spells/heroism.js'
import { invisibility } from '@artificer-toolkit/source-data/srd/spells/invisibility.js'
import { protectionFromEnergy } from '@artificer-toolkit/source-data/srd/spells/protection-from-energy.js'
import { rayOfFrost } from '@artificer-toolkit/source-data/srd/spells/ray-of-frost.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { shieldOfFaith } from '@artificer-toolkit/source-data/srd/spells/shield-of-faith.js'
import { shockingGrasp } from '@artificer-toolkit/source-data/srd/spells/shocking-grasp.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { unicorn } from '@artificer-toolkit/source-data/srd/creatures/unicorn.js'
import { youngGoldDragon } from '@artificer-toolkit/source-data/srd/creatures/young-gold-dragon.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { SRD_DAMAGE_TYPES, SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  activeRuleEffectDefinitionDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import {
  pathLifecycleConsumeEventSchema,
  pathLifecycleEndEventSchema
} from '@artificer-toolkit/schema/shared/enums'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { activeEffectEndsOnRest } from '../character/sheetRest.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { resumeCharacterForm } from '../encounterActorForm.js'
import { checksumRunActorPlayState } from '../encounterActorStorage.js'
import {
  encounterActorIdleTurnMark,
  withEncounterActorIdleTurnMark,
  withFeatureChargeUsed
} from '../encounterActorState.js'
import {
  attackedHostileCreature,
  expiredCarriedOverGrants,
  grantsEndedByHolderState,
  grantsEndedBySourceState,
  planCarriedOverEffects,
  planConcentrationCarriedGrantEnds,
  planDepartedSourceGrantRemovals,
  planEncounterGrantTicks,
  planIdleTurnCheck,
  planReinstatedConcentrations,
  planResumedCarriedEffects,
  sourceBoundGrants,
  stateBoundGrants
} from '../encounterGrantLifetimes.js'
import { endedMaintenanceConditions } from '../encounterActionMaintenance.js'
import { targetEndedEffects } from '../encounterEndedEffectRelease.js'
import { isTurnEffectEligible } from '../encounterTurnEffectState.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID
} from '../systems/dnd5e/identity.js'
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
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { grantOnly, protectionFromEnergyChoice } from './antitoxinEffectFixture.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import type { EncounterEffectRecurrence, EncounterEvent } from '../events/encounterEventTable.js'

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

/**
 * Grant plans never read the published graph beyond its identity (their graph is their own). An
 * Effect of a spell compiles with its spell, which is what makes it a Concentration Effect.
 */
function plansFor(effect: AuthoredEffect, lifecycle: PathLifecycleAuthored, spell?: SpellAuthored) {
  const authored = { ...grantOnly(effect, lifecycle), id: ACTION_EFFECT_ID }
  const compiled = spell
    ? compileSpell({ ...spell, effects: [authored] }).effects?.[0]
    : compileEffect(authored)
  if (!compiled) throw new Error('The spell compiled no Effect.')
  const action = characterActionDescriptor(compiled)
  return dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
    action,
    published: grantPublishedIdentity()
  })
}

const antitoxin = () => onlyEffect(antitoxinVial.effects)

function srdPlan(effect: AuthoredEffect, lifecycle: PathLifecycleAuthored, spell?: SpellAuthored) {
  const plans = plansFor(effect, lifecycle, spell) ?? []
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
      tickAnchor
    })
  })

  it('counts the holder at the end of its turn when nothing says otherwise', () => {
    expect(srdPlan(antitoxin(), {})).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      tickAnchor: 'HOLDER',
      modifierGrantContribution: { consumeOnFirstEvents: [] }
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
        tickAnchor: anchor.actor === 'SOURCE' ? 'SOURCE' : 'HOLDER'
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
    ['Fly', fly, onlyEffect(fly.effects)],
    ['Heroism', heroism, onlyEffect(heroism.effects)],
    ['Shield of Faith', shieldOfFaith, onlyEffect(shieldOfFaith.effects)],
    ['Protection from Energy', protectionFromEnergy, protectionFromEnergyChoice('Fire')]
  ])('makes the real %s grant depend on the caster’s Concentration', (_label, spell, effect) => {
    expect(srdPlan(effect, {}, spell).maintenance).toEqual({
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
      tickAnchor: 'SOURCE'
    })
  })

  it('keeps a source anchor on a grant its holder repeats a save against (Weakening Breath)', () => {
    const breath = youngGoldDragon.features
      ?.find(({ label }) => label.startsWith('Breath Weapons'))
      ?.effects?.find(({ paths }) =>
        paths.some(
          (path) =>
            path.selectionKind === 'FIXED' &&
            path.resultBlock.outcomes.some(({ effectKind }) => effectKind === 'FOLLOW_UP_SAVE')
        )
      )
    if (!breath) throw new Error('The Young Gold Dragon has no Weakening Breath.')
    expect(
      srdPlan(breath, { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } })
    ).toMatchObject({ frozenGraphNodeId: 'repeat-save-test', tickAnchor: 'SOURCE' })
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

  it('counts a source-anchored grant carried in from an earlier Run on its holder’s turns (D151)', () => {
    const stored = storedGrant({
      lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } },
      currentActorId: null,
      holderId: CHARACTER_ID,
      lifetimeScope: 'OWNER'
    })
    const carried = prepareActiveRuleEffectRecord({
      id: testUuid(0xc338),
      owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
      definition: {
        ...stored.definition,
        origin: { ...stored.definition.origin, sourceAggregateId: testUuid(0xc3fd) }
      },
      lifecycle: { schemaVersion: 1, remainingTicks: 5 },
      currentEffects: [],
      occurredAt: TIMESTAMP
    })
    const holders = [
      { actor: characterActor({ id: TARGET_ID, characterId: CHARACTER_ID }), effects: [carried] },
      { actor: holder(SOURCE_ID).actor, effects: [] }
    ]
    expect(plan('START_OF_TURN', TARGET_ID, holders)).toMatchObject([
      { kind: 'UPDATE', effect: { id: carried.id }, remainingTicks: 4 }
    ])
    expect(plan('START_OF_TURN', SOURCE_ID, holders)).toEqual([])
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

  it('compiles to a one-minute holder-counted grant ended by an idle turn, Unconscious or its holder', () => {
    expect(srdPlan(rage, {})).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      tickAnchor: 'HOLDER',
      modifierGrantContribution: {
        endOnEvents: ['ON_IDLE_TURN'],
        endOnConditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID],
        holderEnd: { activation: 'BONUS_ACTION' }
      }
    })
    expect(stored(TARGET_ID).definition.recurrence).toMatchObject({
      endOnEvents: ['ON_IDLE_TURN'],
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
        conditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID],
        itemInstanceIdsOnActor: []
      }).map(({ id }) => id)
    ).toEqual([record.id])
    expect(
      grantsEndedByHolderState([record], {
        reason: 'INCAPACITATED',
        conditionIds: [stunned],
        itemInstanceIdsOnActor: []
      })
    ).toEqual([])
    expect(
      grantsEndedByHolderState([record], {
        reason: 'DEFEATED',
        conditionIds: [],
        itemInstanceIdsOnActor: []
      })
    ).toEqual([])
  })

  it('reads no conditions from a defeated holder, as persistence does', () => {
    expect(
      grantsEndedByHolderState([record], {
        reason: 'DEFEATED',
        conditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID],
        itemInstanceIdsOnActor: []
      })
    ).toEqual([])
  })
})

describe('a grant that ends on an idle turn (SRD Rage)', () => {
  const idle = grantRecord(
    storedGrant({ lifecycle: { endOnEvents: ['ON_IDLE_TURN'] }, currentActorId: null }),
    { id: 0xc374, holderId: TARGET_ID }
  )
  const antitoxinRecord = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
    id: 0xc375,
    holderId: TARGET_ID
  })
  const actor = creatureActor({ id: TARGET_ID, snapshot: {} })
  const marked = (target: typeof actor, mark: 'ARMED' | 'ENGAGED' | null) =>
    encounterRunActorStateSchema.parse({
      ...target,
      resources: withEncounterActorIdleTurnMark(target, mark)
    })
  const armed = marked(actor, 'ARMED')
  const engaged = marked(actor, 'ENGAGED')

  it('reads and ends nothing for an actor that holds no idle-bound grant', () => {
    expect(
      planIdleTurnCheck({ encounterId: ENCOUNTER_ID, actor, effects: [antitoxinRecord, idle] })
    ).toEqual({ ended: [], nextMark: null })
  })

  it('ends only the idle-bound grants of an armed holder and clears the mark', () => {
    expect(
      planIdleTurnCheck({
        encounterId: ENCOUNTER_ID,
        actor: armed,
        effects: [antitoxinRecord, idle]
      })
    ).toEqual({ ended: [idle], nextMark: null })
  })

  it('keeps the grant of an engaged holder and arms it again', () => {
    expect(
      planIdleTurnCheck({ encounterId: ENCOUNTER_ID, actor: engaged, effects: [idle] })
    ).toEqual({ ended: [], nextMark: 'ARMED' })
  })

  it('stays armed while an idle-bound grant outside this encounter remains', () => {
    expect(
      planIdleTurnCheck({ encounterId: testUuid(0xc377), actor: armed, effects: [idle] })
    ).toEqual({ ended: [], nextMark: 'ARMED' })
  })

  it('sets and clears the mark without touching the other resources', () => {
    const used = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withFeatureChargeUsed(actor, testUuid(0xc376), 1)
    })
    expect(encounterActorIdleTurnMark(used)).toBeNull()
    expect(encounterActorIdleTurnMark(marked(used, 'ARMED'))).toBe('ARMED')
    expect(encounterActorIdleTurnMark(marked(used, 'ENGAGED'))).toBe('ENGAGED')
    expect(withEncounterActorIdleTurnMark(marked(used, 'ENGAGED'), null)).toEqual(used.resources)
  })

  it('hashes the mark into the actor state checksum', () => {
    expect(checksumRunActorPlayState(armed)).not.toBe(checksumRunActorPlayState(actor))
    expect(checksumRunActorPlayState(engaged)).not.toBe(checksumRunActorPlayState(armed))
    expect(checksumRunActorPlayState(marked(engaged, null))).toBe(checksumRunActorPlayState(actor))
  })

  describe('attacking a hostile creature', () => {
    const attacker = { disposition: 'FRIENDLY' as const }
    const hit = { resultPath: 'ON_HIT' }

    it.each(['ON_HIT', 'ON_MISS', 'ON_CRIT'])(
      'counts an attack roll that resolves %s',
      (resultPath) => {
        expect(
          attackedHostileCreature({
            d20s: [{ resultPath }, null],
            source: attacker,
            target: { disposition: 'HOSTILE' }
          })
        ).toBe(true)
      }
    )

    it('does not count a saving throw the target made', () => {
      expect(
        attackedHostileCreature({
          d20s: [{ resultPath: 'ON_SAVE_FAIL' }, undefined],
          source: attacker,
          target: { disposition: 'HOSTILE' }
        })
      ).toBe(false)
    })

    it.each(['FRIENDLY', 'NEUTRAL'] as const)(
      'does not count an attack on a %s creature',
      (disposition) => {
        expect(
          attackedHostileCreature({ d20s: [hit], source: attacker, target: { disposition } })
        ).toBe(false)
      }
    )
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
        grantsEndedByHolderState([incapacitation], {
          reason,
          conditionIds: [],
          itemInstanceIdsOnActor: []
        }).map(({ id }) => id)
      ).toEqual([incapacitation.id])
    }
  )

  it.each([[null], ['SPELLCASTING_LOCKED' as const]])('stays when its holder is %s', (reason) => {
    expect(
      grantsEndedByHolderState([incapacitation], {
        reason,
        conditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID],
        itemInstanceIdsOnActor: []
      })
    ).toEqual([])
  })
})

describe('a grant that ends when its source is incapacitated (Knight Leadership)', () => {
  const leadership = knight.features?.find(({ label }) => label.startsWith('Leadership'))
    ?.effects?.[0]
  if (!leadership) throw new Error('The Knight must author Leadership.')
  const heldBy = (id: number, holderId: string) =>
    grantRecord(
      storedGrant({ lifecycle: {}, currentActorId: null, effect: leadership, holderId }),
      { id, holderId }
    )
  const dice = [heldBy(0xc380, TARGET_ID), heldBy(0xc381, OTHER_ID)]
  const idsOf = (effects: readonly ActiveRuleEffectRecord[]) => effects.map(({ id }) => id)

  it('follows its source, not its holder', () => {
    expect(idsOf(sourceBoundGrants(dice))).toEqual(idsOf(dice))
    expect(stateBoundGrants(dice)).toEqual([])
    expect(
      grantsEndedByHolderState(dice, {
        reason: 'DEFEATED',
        conditionIds: [],
        itemInstanceIdsOnActor: []
      })
    ).toEqual([])
  })

  it.each([['INCAPACITATED' as const], ['DEFEATED' as const]])(
    'ends on every holder when its source is %s',
    (reason) => {
      expect(idsOf(grantsEndedBySourceState(dice, new Map([[SOURCE_ID, reason]])))).toEqual(
        idsOf(dice)
      )
    }
  )

  it.each([[null], ['SPELLCASTING_LOCKED' as const]])('stays when its source is %s', (reason) => {
    expect(grantsEndedBySourceState(dice, new Map([[SOURCE_ID, reason]]))).toEqual([])
  })

  it('stays when only another actor is incapacitated', () => {
    expect(grantsEndedBySourceState(dice, new Map([[OTHER_ID, 'INCAPACITATED' as const]]))).toEqual(
      []
    )
  })
})

describe('a grant bound to an item that ends when it is let go (SPELLS-4.T2e)', () => {
  const ITEM_ID = testUuid(0xc3a1)
  const bound = (endOnEvents: 'ON_CHOSEN_ITEM_RELEASED'[]) => {
    const record = grantRecord(storedGrant({ lifecycle: { endOnEvents }, currentActorId: null }), {
      id: 0xc3a2,
      holderId: TARGET_ID
    })
    if (record.definition.schemaVersion !== 2) throw new Error('Expected a v2 grant definition.')
    return {
      ...record,
      definition: {
        ...record.definition,
        stateContributions: record.definition.stateContributions.map((contribution) =>
          contribution.kind === 'MODIFIER_GRANT'
            ? {
                ...contribution,
                boundItem: {
                  kind: 'EQUIPMENT_INSTANCE' as const,
                  equipmentId: testUuid(0xc3a3),
                  itemInstanceId: ITEM_ID
                }
              }
            : contribution
        )
      }
    }
  }
  const ended = (record: ActiveRuleEffectRecord, itemInstanceIdsOnActor: string[]) =>
    grantsEndedByHolderState([record], {
      reason: null,
      conditionIds: [],
      itemInstanceIdsOnActor
    }).map(({ id }) => id)

  it('ends when no hand of its holder holds the bound item', () => {
    const record = bound(['ON_CHOSEN_ITEM_RELEASED'])
    expect(ended(record, [])).toEqual([record.id])
    expect(ended(record, [testUuid(0xc3a4)])).toEqual([record.id])
  })

  it('stays while a hand holds the bound item', () => {
    expect(ended(bound(['ON_CHOSEN_ITEM_RELEASED']), [ITEM_ID])).toEqual([])
  })

  it('stays when dropped if it does not end on release (Magic Weapon)', () => {
    expect(ended(bound([]), [])).toEqual([])
  })
})

describe('discoverEncounterEventHooks', () => {
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
    expect(
      discoverEncounterEventHooks({
        effects: [plain, consumable],
        events: [{ kind: 'ACTION', attackRoll: true, spellCast: false, againstEnemy: false }]
      }).ended.map(({ id }) => id)
    ).toEqual([consumable.id])
  })

  it('lists only the grants an ability check uses up', () => {
    const check = held(0xc342, ['ON_ABILITY_CHECK'])
    const both = held(0xc343, ['ON_ABILITY_CHECK', 'ON_ATTACK_ROLL'])
    const attackOnly = held(0xc344, ['ON_ATTACK_ROLL'])
    expect(
      discoverEncounterEventHooks({
        effects: [plain, check, both, attackOnly],
        events: [{ kind: 'TEST', test: 'CHECK', ability: null }]
      }).ended.map(({ id }) => id)
    ).toEqual([check.id, both.id])
  })
})

describe('discoverEncounterEventHooks over every authored subscription', () => {
  const HELP = SRD_BASIC_ACTION_IDS.HELP
  const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
  const dispositions = new Map([
    [SOURCE_ID, 'FRIENDLY'],
    [OTHER_ID, 'HOSTILE']
  ] as const)
  const damaged = (damagerActorId: string, damageTypeIds: (string | null)[]): EncounterEvent => ({
    kind: 'DAMAGED',
    phase: 'AFTER',
    damagerActorId,
    damageTypeIds,
    dispositions
  })
  const action = (facts: { attackRoll?: boolean; spellCast?: boolean; againstEnemy?: boolean }) =>
    ({
      kind: 'ACTION',
      attackRoll: facts.attackRoll ?? false,
      spellCast: facts.spellCast ?? false,
      againstEnemy: facts.againstEnemy ?? false
    }) satisfies EncounterEvent
  const attacked = {
    kind: 'ATTACKED',
    holderActorId: TARGET_ID,
    attackerActorId: OTHER_ID,
    turnActorId: OTHER_ID
  } satisfies EncounterEvent

  // A stored grant's recurrence carries each subscription (the 5e Effect-action compiler authors
  // some of them only on conditions and spells, which discovery reads the same way).
  const plain = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
    id: 0xc350,
    holderId: TARGET_ID
  })
  const subscribed = (recurrence: Partial<EncounterEffectRecurrence>): ActiveRuleEffectRecord => ({
    ...plain,
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      ...plain.definition,
      recurrence: { ...plain.definition.recurrence, ...recurrence }
    })
  })

  // Each row: what the effect authors, an event that meets it and a near event that does not.
  // `ON_CHOSEN_ITEM_RELEASED` needs a bound item; the item-release block above covers it.
  const rows: [string, Partial<EncounterEffectRecurrence>, EncounterEvent, EncounterEvent][] = [
    [
      'ON_ATTACK_ROLL',
      { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] },
      action({ attackRoll: true }),
      action({ spellCast: true })
    ],
    ['ON_HIT', { consumeOnFirstEvents: ['ON_HIT'] }, { kind: 'HIT' }, attacked],
    ['ON_ATTACKED', { consumeOnFirstEvents: ['ON_ATTACKED'] }, attacked, { kind: 'HIT' }],
    [
      'ON_ABILITY_CHECK',
      { consumeOnFirstEvents: ['ON_ABILITY_CHECK'] },
      { kind: 'TEST', test: 'CHECK', ability: { code: 'STRENGTH' } },
      { kind: 'TEST', test: 'SAVE', ability: { code: 'STRENGTH' } }
    ],
    [
      'ON_SAVING_THROW',
      { consumeOnFirstEvents: ['ON_SAVING_THROW'] },
      { kind: 'TEST', test: 'SAVE', ability: { code: 'CONSTITUTION' } },
      { kind: 'TEST', test: 'CHECK', ability: { code: 'CONSTITUTION' } }
    ],
    [
      'ON_CAST_SPELL',
      { consumeOnFirstEvents: ['ON_CAST_SPELL'] },
      action({ spellCast: true }),
      action({ attackRoll: true })
    ],
    ['ON_TAKE_ACTION', { endOnEvents: ['ON_TAKE_ACTION'] }, action({}), { kind: 'MOVED' }],
    [
      'ON_HIT_POINTS_REGAINED',
      { endOnEvents: ['ON_HIT_POINTS_REGAINED'] },
      { kind: 'HIT_POINTS_REGAINED' },
      { kind: 'IDLE_TURN' }
    ],
    [
      'ON_INCAPACITATED',
      { endOnEvents: ['ON_INCAPACITATED'] },
      { kind: 'INCAPACITATED', of: 'HOLDER' },
      { kind: 'INCAPACITATED', of: 'SOURCE', sourceActorIds: new Set([SOURCE_ID]) }
    ],
    ['ON_IDLE_TURN', { endOnEvents: ['ON_IDLE_TURN'] }, { kind: 'IDLE_TURN' }, { kind: 'MOVED' }],
    [
      'ON_LEAVING_AREA',
      { endOnEvents: ['ON_LEAVING_AREA'] },
      { kind: 'AREA_LEFT' },
      { kind: 'MOVED' }
    ],
    ['ON_MOVE', { endOnEvents: ['ON_MOVE'] }, { kind: 'MOVED' }, { kind: 'AREA_LEFT' }],
    [
      'DAMAGE_TAKEN from the source side',
      { endOnTriggers: [{ event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null }] },
      damaged(SOURCE_ID, [FIRE]),
      damaged(OTHER_ID, [FIRE])
    ],
    [
      'DAMAGE_TAKEN of a type',
      { endOnTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: [FIRE] }] },
      damaged(OTHER_ID, [FIRE]),
      damaged(OTHER_ID, [null])
    ],
    [
      'ATTACK_ROLL against an enemy',
      { endOnTriggers: [{ event: 'ATTACK_ROLL', against: 'ENEMY' }] },
      action({ attackRoll: true, againstEnemy: true }),
      action({ attackRoll: true })
    ],
    [
      'SPELL_CAST against an enemy',
      { endOnTriggers: [{ event: 'SPELL_CAST', against: 'ENEMY' }] },
      action({ spellCast: true, againstEnemy: true }),
      action({ attackRoll: true, againstEnemy: true })
    ],
    [
      'ACTION_USED_ON_HOLDER',
      { endOnTriggers: [{ event: 'ACTION_USED_ON_HOLDER', actionDefinitionIds: [HELP] }] },
      { kind: 'ACTION_USED_ON_HOLDER', basicActionDefinitionId: HELP },
      { kind: 'ACTION_USED_ON_HOLDER', basicActionDefinitionId: SRD_BASIC_ACTION_IDS.DODGE }
    ],
    [
      'INCAPACITATED of the source',
      { endOnTriggers: [{ event: 'INCAPACITATED', of: 'SOURCE' }] },
      { kind: 'INCAPACITATED', of: 'SOURCE', sourceActorIds: new Set([SOURCE_ID]) },
      { kind: 'INCAPACITATED', of: 'SOURCE', sourceActorIds: new Set([OTHER_ID]) }
    ],
    [
      'a held condition',
      { endOnConditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID] },
      { kind: 'CONDITION_HELD', conditionIds: [DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID] },
      { kind: 'CONDITION_HELD', conditionIds: [] }
    ]
  ]

  it('has a row for every authored lifecycle code', () => {
    const codes = new Set([
      ...pathLifecycleConsumeEventSchema.options,
      ...pathLifecycleEndEventSchema.options
    ])
    codes.delete('ON_CHOSEN_ITEM_RELEASED')
    const names = [...rows.map(([name]) => name), 'ON_LONG_REST']
    expect(new Set(names.filter((name) => name.startsWith('ON_')))).toEqual(codes)
  })

  // A rest is the Sheet's event, so the Sheet reads its subscription rather than the discovery.
  it('ends an effect subscribed to ON_LONG_REST on a long rest alone', () => {
    const effect = subscribed({ endOnEvents: ['ON_LONG_REST'] })
    expect(activeEffectEndsOnRest(effect, 'LONG')).toBe(true)
    expect(activeEffectEndsOnRest(effect, 'SHORT')).toBe(false)
  })

  it('reads a version-one effect through the same subscriptions', () => {
    const stored = subscribed({ endOnEvents: ['ON_LONG_REST', 'ON_MOVE'] }).definition
    if (stored.schemaVersion !== 2) throw new Error('The stored grant is version two.')
    const { stateContributions: _stateContributions, ...definition } = stored
    const effect: ActiveRuleEffectRecord = {
      ...plain,
      definition: activeRuleEffectDefinitionDtoSchema.parse({ ...definition, schemaVersion: 1 })
    }
    expect(activeEffectEndsOnRest(effect, 'LONG')).toBe(true)
    expect(activeEffectEndsOnRest(effect, 'SHORT')).toBe(false)
    const ended = (events: EncounterEvent[]) =>
      discoverEncounterEventHooks({ effects: [effect], events }).ended
    expect(ended([{ kind: 'MOVED' }])).toEqual([effect])
    expect(ended([{ kind: 'AREA_LEFT' }])).toEqual([])
  })

  it.each(rows)(
    'ends an effect subscribed to %s on its event alone',
    (_, recurrence, meets, misses) => {
      const effect = subscribed(recurrence)
      const ended = (events: EncounterEvent[]) =>
        discoverEncounterEventHooks({ effects: [effect], events }).ended
      expect(ended([meets])).toEqual([effect])
      expect(ended([misses])).toEqual([])
    }
  )
})

describe('discoverEncounterEventHooks for an ability check (D156)', () => {
  /** The real Guidance effect, its die limited to one ability when `ability` is given. */
  function dieEffect(spell: SpellAuthored, ability?: 'STRENGTH') {
    const effect = structuredClone(onlyEffect(spell.effects))
    for (const path of effect.paths)
      if (path.selectionKind === 'FIXED')
        for (const outcome of path.resultBlock.outcomes)
          if (outcome.effectKind === 'APPLY_GRANT' && ability)
            for (const modifier of outcome.grants.modifiers ?? []) modifier.domain = { ability }
    return effect
  }
  const heldDie = (id: number, spell: SpellAuthored, ability?: 'STRENGTH') =>
    grantRecord(
      storedGrant({
        lifecycle: {},
        currentActorId: null,
        effect: dieEffect(spell, ability)
      }),
      { id, holderId: TARGET_ID }
    )
  const idsOf = (effects: readonly ActiveRuleEffectRecord[]) => effects.map(({ id }) => id)

  it('spends a die on any ability check when it names no ability', () => {
    const die = heldDie(0xc360, guidance)
    for (const abilityCode of ['STRENGTH', 'DEXTERITY'])
      expect(
        idsOf(
          discoverEncounterEventHooks({
            effects: [die],
            events: [{ kind: 'TEST', test: 'CHECK', ability: { code: abilityCode } }]
          }).ended
        )
      ).toEqual([die.id])
  })

  it('does not spend a Strength die on a Dexterity check, but does on a Strength check', () => {
    const die = heldDie(0xc361, guidance, 'STRENGTH')
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [die],
          events: [{ kind: 'TEST', test: 'CHECK', ability: { code: 'DEXTERITY' } }]
        }).ended
      )
    ).toEqual([])
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [die],
          events: [{ kind: 'TEST', test: 'CHECK', ability: { code: 'STRENGTH' } }]
        }).ended
      )
    ).toEqual([die.id])
  })

  it('does not spend a held die on a bare ability-check event', () => {
    const die = heldDie(0xc362, guidance)
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [die],
          events: [{ kind: 'TEST', test: 'CHECK', ability: null }]
        }).ended
      )
    ).toEqual([])
  })

  it('spends an effect with no grant in the test’s domain whenever it lists the event', () => {
    const wholly = grantRecord(
      storedGrant({
        lifecycle: { consumeOnFirstEvents: ['ON_ABILITY_CHECK'] },
        currentActorId: null
      }),
      { id: 0xc366, holderId: TARGET_ID }
    )
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [wholly],
          events: [{ kind: 'TEST', test: 'CHECK', ability: { code: 'DEXTERITY' } }]
        }).ended
      )
    ).toEqual([wholly.id])
  })
})

describe('discoverEncounterEventHooks for a saving throw (D156)', () => {
  /** The real Resistance effect, its die limited to one ability when `ability` is given. */
  function dieEffect(ability?: 'STRENGTH') {
    const effect = structuredClone(onlyEffect(resistance.effects))
    for (const path of effect.paths)
      if (path.selectionKind === 'FIXED')
        for (const outcome of path.resultBlock.outcomes)
          if (outcome.effectKind === 'APPLY_GRANT' && ability)
            for (const modifier of outcome.grants.modifiers ?? []) modifier.domain = { ability }
    return effect
  }
  const heldDie = (id: number, ability?: 'STRENGTH') =>
    grantRecord(storedGrant({ lifecycle: {}, currentActorId: null, effect: dieEffect(ability) }), {
      id,
      holderId: TARGET_ID
    })
  const idsOf = (effects: readonly ActiveRuleEffectRecord[]) => effects.map(({ id }) => id)

  it('spends a die on any saving throw when it names no ability', () => {
    const die = heldDie(0xc370)
    for (const abilityCode of ['STRENGTH', 'DEXTERITY'])
      expect(
        idsOf(
          discoverEncounterEventHooks({
            effects: [die],
            events: [{ kind: 'TEST', test: 'SAVE', ability: { code: abilityCode } }]
          }).ended
        )
      ).toEqual([die.id])
  })

  it('does not spend a Strength die on a Dexterity save, but does on a Strength save', () => {
    const die = heldDie(0xc371, 'STRENGTH')
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [die],
          events: [{ kind: 'TEST', test: 'SAVE', ability: { code: 'DEXTERITY' } }]
        }).ended
      )
    ).toEqual([])
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [die],
          events: [{ kind: 'TEST', test: 'SAVE', ability: { code: 'STRENGTH' } }]
        }).ended
      )
    ).toEqual([die.id])
  })

  it('spends an unfiltered die on an ability-less save such as a death save', () => {
    const die = heldDie(0xc372)
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [die],
          events: [{ kind: 'TEST', test: 'SAVE', ability: { code: null } }]
        }).ended
      )
    ).toEqual([die.id])
  })

  it('does not spend an ability-limited die on an ability-less save', () => {
    const die = heldDie(0xc373, 'STRENGTH')
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [die],
          events: [{ kind: 'TEST', test: 'SAVE', ability: { code: null } }]
        }).ended
      )
    ).toEqual([])
  })

  it('does not spend a held die on a bare saving-throw event', () => {
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [heldDie(0xc374)],
          events: [{ kind: 'TEST', test: 'SAVE', ability: null }]
        }).ended
      )
    ).toEqual([])
  })

  it('keeps a saving-throw die through an ability check, and a check die through a save', () => {
    const saveDie = heldDie(0xc375)
    const checkDie = grantRecord(
      storedGrant({ lifecycle: {}, currentActorId: null, effect: onlyEffect(guidance.effects) }),
      { id: 0xc376, holderId: TARGET_ID }
    )
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [saveDie],
          events: [{ kind: 'TEST', test: 'CHECK', ability: { code: 'STRENGTH' } }]
        }).ended
      )
    ).toEqual([])
    expect(
      idsOf(
        discoverEncounterEventHooks({
          effects: [checkDie],
          events: [{ kind: 'TEST', test: 'SAVE', ability: { code: 'STRENGTH' } }]
        }).ended
      )
    ).toEqual([])
  })
})

describe('what a saving throw ends for its holder (SPELLS-4.T2c2b)', () => {
  const dieFor = (id: number, ability?: 'STRENGTH') => {
    const effect = structuredClone(onlyEffect(resistance.effects))
    for (const path of effect.paths)
      if (path.selectionKind === 'FIXED')
        for (const outcome of path.resultBlock.outcomes)
          if (outcome.effectKind === 'APPLY_GRANT' && ability)
            for (const modifier of outcome.grants.modifiers ?? []) modifier.domain = { ability }
    return grantRecord(storedGrant({ lifecycle: {}, currentActorId: null, effect }), {
      id,
      holderId: TARGET_ID
    })
  }
  const saveEvidence = (ability: string | undefined, resultPath = 'ON_SAVE_FAIL') => ({
    requestId: 'save-request',
    rollMode: 'NORMAL' as const,
    keep: 'FIRST' as const,
    derivedRollMode: 'NORMAL' as const,
    rawFaces: [9],
    selectedNatural: 9,
    contributors: [],
    contributorChecksum: 'checksum',
    modifier: 1,
    total: 10,
    defenseOrDc: 14,
    resultPath,
    ...(ability ? { savingThrowAbilityDefinitionId: ability } : {})
  })
  const ended = (
    held: ActiveRuleEffectRecord[],
    testEvidence: Parameters<typeof targetEndedEffects>[0]['testEvidence']
  ) =>
    targetEndedEffects({
      holderActorId: TARGET_ID,
      held,
      attacked: false,
      testEvidence,
      turnActorId: null,
      applications: [],
      damagerActorId: null,
      dispositions: new Map()
    }).endedEffects.map(({ id }) => id)
  const STRENGTH = DND5E_ABILITY_DEFINITION_ID_BY_CODE.STRENGTH!
  const DEXTERITY = DND5E_ABILITY_DEFINITION_ID_BY_CODE.DEXTERITY!

  it('spends the die of a Resistance effect on a save of any ability', () => {
    const die = dieFor(0xc380)
    expect(ended([die], [saveEvidence(DEXTERITY)])).toEqual([die.id])
  })

  it('spends a die on a save evidenced as a success too', () => {
    const die = dieFor(0xc381)
    expect(ended([die], [saveEvidence(STRENGTH, 'ON_SAVE_SUCCESS')])).toEqual([die.id])
  })

  it('keeps a Strength die through a Dexterity save and spends it on a Strength save', () => {
    const die = dieFor(0xc382, 'STRENGTH')
    expect(ended([die], [saveEvidence(DEXTERITY)])).toEqual([])
    expect(ended([die], [saveEvidence(STRENGTH)])).toEqual([die.id])
  })

  it('spends nothing when no save was rolled', () => {
    const die = dieFor(0xc383)
    expect(ended([die], [])).toEqual([])
    expect(ended([die], [null, undefined])).toEqual([])
    expect(ended([die], [saveEvidence(undefined)])).toEqual([])
  })

  it('spends the die once when the action and its nested outcome both rolled saves', () => {
    const die = dieFor(0xc384)
    expect(ended([die], [saveEvidence(STRENGTH), saveEvidence(DEXTERITY)])).toEqual([die.id])
  })
})

describe('discoverEncounterEventHooks on an end event', () => {
  const ending = (id: number, endOnEvents: ('ON_HIT_POINTS_REGAINED' | 'ON_INCAPACITATED')[]) =>
    grantRecord(storedGrant({ lifecycle: { endOnEvents }, currentActorId: null }), {
      id,
      holderId: TARGET_ID
    })

  it('lists the effects that end on the event and nothing else', () => {
    const regained = ending(0xc350, ['ON_HIT_POINTS_REGAINED'])
    const incapacitated = ending(0xc351, ['ON_INCAPACITATED'])
    expect(
      discoverEncounterEventHooks({
        effects: [regained, incapacitated],
        events: [{ kind: 'HIT_POINTS_REGAINED' }]
      }).ended.map(({ id }) => id)
    ).toEqual([regained.id])
    expect(
      discoverEncounterEventHooks({
        effects: [regained, incapacitated],
        events: [{ kind: 'INCAPACITATED', of: 'HOLDER' }]
      }).ended.map(({ id }) => id)
    ).toEqual([incapacitated.id])
    expect(
      discoverEncounterEventHooks({
        effects: [regained, incapacitated],
        events: [{ kind: 'TEST', test: 'CHECK', ability: null }]
      }).ended
    ).toEqual([])
  })

  it('lists an effect once when it consumes and ends on the same event', () => {
    const consuming = grantRecord(
      storedGrant({
        lifecycle: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] },
        currentActorId: null
      }),
      { id: 0xc352, holderId: TARGET_ID }
    )
    const both = {
      ...consuming,
      definition: {
        ...consuming.definition,
        recurrence: { ...consuming.definition.recurrence, endOnEvents: ['ON_ATTACK_ROLL' as const] }
      }
    }
    expect(
      discoverEncounterEventHooks({
        effects: [both],
        events: [{ kind: 'ACTION', attackRoll: true, spellCast: false, againstEnemy: false }]
      }).ended
    ).toEqual([both])
  })

  it('lists an effect once when it ends on several of the events an action is', () => {
    const attacking = ending(0xc353, ['ON_INCAPACITATED'])
    const both = {
      ...attacking,
      definition: {
        ...attacking.definition,
        recurrence: {
          ...attacking.definition.recurrence,
          endOnEvents: ['ON_ATTACK_ROLL' as const, 'ON_CAST_SPELL' as const]
        }
      }
    }
    expect(
      discoverEncounterEventHooks({
        effects: [both],
        events: [{ kind: 'ACTION', attackRoll: true, spellCast: true, againstEnemy: false }]
      }).ended
    ).toEqual([both])
    expect(
      discoverEncounterEventHooks({
        effects: [both],
        events: [{ kind: 'ACTION', attackRoll: false, spellCast: true, againstEnemy: false }]
      }).ended
    ).toEqual([both])
    expect(
      discoverEncounterEventHooks({
        effects: [both],
        events: [
          { kind: 'TEST', test: 'CHECK', ability: null },
          { kind: 'INCAPACITATED', of: 'HOLDER' }
        ]
      }).ended
    ).toEqual([])
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

describe('planCarriedOverEffects', () => {
  const grant = (id: number, remainingTicks: number) =>
    grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id,
      holderId: TARGET_ID,
      remainingTicks
    })
  const formEffect = (id: number, remainingTicks: number | null) => {
    const effect = grant(id, remainingTicks ?? 1)
    if (effect.definition.schemaVersion !== 2) throw new Error('Expected a version two grant.')
    return {
      ...effect,
      lifecycle: { ...effect.lifecycle, remainingTicks },
      definition: {
        ...effect.definition,
        stateContributions: [
          {
            kind: 'CREATURE_FORM' as const,
            formOutcomeId: 'form',
            creatureId: testUuid(0xc370),
            excessDamageCarriesOver: true
          }
        ]
      }
    }
  }
  const wornForm = (effectId: string) => ({
    effectId,
    excessDamageCarriesOver: true,
    sourceId: testUuid(0xc371),
    sourceRevision: 1,
    snapshot: { label: 'Giant Ape' },
    currentHitPoints: 40,
    maxHitPoints: 157,
    tempHitPoints: 0
  })
  const carriedForm = {
    sourceId: testUuid(0xc371),
    sourceRevision: 1,
    snapshotJson: JSON.stringify({ label: 'Giant Ape' }),
    currentHitPoints: 40,
    maxHitPoints: 157,
    tempHitPoints: 0
  }

  it('carries the creature form a Character wears with its hit points (SPELLS-28.T4b)', () => {
    const effect = formEffect(0xc372, 25)
    expect(
      planCarriedOverEffects({ effects: [effect], clockMinute: 2000, form: wornForm(effect.id) })
    ).toEqual([
      {
        effect,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: null,
          expiresAtCampaignMinute: 2003,
          carriedCreatureForm: carriedForm
        }
      }
    ])
  })

  it('refreshes the hit points of a form effect that was already carried, keeping its expiry', () => {
    const effect = {
      ...formEffect(0xc373, null),
      lifecycle: { schemaVersion: 1 as const, remainingTicks: null, expiresAtCampaignMinute: 2003 }
    }
    expect(
      planCarriedOverEffects({ effects: [effect], clockMinute: 2100, form: wornForm(effect.id) })
    ).toEqual([
      {
        effect,
        lifecycle: { ...effect.lifecycle, carriedCreatureForm: carriedForm }
      }
    ])
  })

  it('carries no form for an effect the Character does not wear', () => {
    const effect = formEffect(0xc374, null)
    expect(planCarriedOverEffects({ effects: [effect], clockMinute: 2000, form: null })).toEqual([])
  })

  it('has the next Run’s Character actor resume the form its carried effect holds', () => {
    const effect = formEffect(0xc375, null)
    const carried = {
      ...effect,
      lifecycle: {
        schemaVersion: 1 as const,
        remainingTicks: null,
        carriedCreatureForm: carriedForm
      }
    }
    const actor = characterActor({ id: testUuid(0xc376), characterId: CHARACTER_ID })
    if (actor.kind !== 'CHARACTER') throw new Error('Expected a Character actor.')
    expect(resumeCharacterForm(actor, [carried]).form).toEqual({
      effectId: effect.id,
      excessDamageCarriesOver: true,
      sourceId: carriedForm.sourceId,
      sourceRevision: 1,
      snapshot: { label: 'Giant Ape' },
      currentHitPoints: 40,
      maxHitPoints: 157,
      tempHitPoints: 0
    })
    expect(resumeCharacterForm(actor, [effect])).toBe(actor)
  })

  it('expires a timed grant 6 seconds per remaining round after the clock, in whole minutes', () => {
    const [ten, eleven] = [grant(0xc360, 10), grant(0xc361, 11)]
    expect(planCarriedOverEffects({ effects: [ten, eleven], clockMinute: 2000 })).toEqual([
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
    expect(planCarriedOverEffects({ effects: [effect], clockMinute: null })).toEqual([
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
    expect(planCarriedOverEffects({ effects: [stamped, creatureCast], clockMinute: 2000 })).toEqual(
      [
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
      ]
    )
  })

  it('leaves an untimed grant alone', () => {
    const effect = grant(0xc363, 4)
    const untimed = { ...effect, lifecycle: { schemaVersion: 1 as const, remainingTicks: null } }
    expect(planCarriedOverEffects({ effects: [untimed], clockMinute: 2000 })).toEqual([])
  })
})

describe('planResumedCarriedEffects (SPELLS-5.13, D151)', () => {
  const carried = (
    id: number,
    lifecycle: Omit<ActiveRuleEffectRecord['lifecycle'], 'schemaVersion' | 'remainingTicks'>,
    rounds = 600
  ) => {
    const effect = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id,
      holderId: TARGET_ID,
      remainingTicks: 1
    })
    const { expiration } = effect.definition.recurrence
    if (expiration.kind !== 'TICKS') throw new Error('Expected a timed grant.')
    return {
      ...effect,
      definition: {
        ...effect.definition,
        recurrence: {
          ...effect.definition.recurrence,
          expiration: { ...expiration, initialRemaining: rounds }
        }
      },
      lifecycle: { schemaVersion: 1 as const, remainingTicks: null, ...lifecycle }
    }
  }

  it('turns the minutes left before its expiry back into rounds, 10 a minute', () => {
    const effect = carried(0xc390, { expiresAtCampaignMinute: 2003 })
    expect(planResumedCarriedEffects({ effects: [effect], clockMinute: 2001 })).toEqual([
      { kind: 'UPDATE', effect, lifecycle: { schemaVersion: 1, remainingTicks: 20 } }
    ])
  })

  it('never resumes more rounds than the effect first had', () => {
    const effect = carried(0xc391, { expiresAtCampaignMinute: 2001 }, 4)
    expect(planResumedCarriedEffects({ effects: [effect], clockMinute: 2000 })).toEqual([
      { kind: 'UPDATE', effect, lifecycle: { schemaVersion: 1, remainingTicks: 4 } }
    ])
  })

  it('keeps every other lifecycle field, such as the Concentration caster', () => {
    const effect = carried(0xc392, {
      expiresAtCampaignMinute: 2001,
      concentrationCasterCharacterId: CHARACTER_ID
    })
    expect(planResumedCarriedEffects({ effects: [effect], clockMinute: 2000 })).toEqual([
      {
        kind: 'UPDATE',
        effect,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: 10,
          concentrationCasterCharacterId: CHARACTER_ID
        }
      }
    ])
  })

  it.each([2001, 2005])('ends an effect whose expiry the clock has reached: minute %i', (now) => {
    const effect = carried(0xc393, { expiresAtCampaignMinute: 2001 })
    expect(planResumedCarriedEffects({ effects: [effect], clockMinute: now })).toEqual([
      { kind: 'EXPIRE', effect }
    ])
  })

  it('leaves an effect carried without a clock, and resumes nothing without one', () => {
    const untimed = carried(0xc394, { expiresAtCampaignMinute: null })
    const timed = carried(0xc395, { expiresAtCampaignMinute: 2001 })
    expect(planResumedCarriedEffects({ effects: [untimed], clockMinute: 2000 })).toEqual([])
    expect(planResumedCarriedEffects({ effects: [timed], clockMinute: null })).toEqual([])
  })

  it('leaves an effect that was never carried', () => {
    const effect = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id: 0xc396,
      holderId: TARGET_ID,
      remainingTicks: 4
    })
    expect(planResumedCarriedEffects({ effects: [effect], clockMinute: 2000 })).toEqual([])
  })

  it('round-trips the effect the carry-over planner put on the clock', () => {
    const effect = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id: 0xc397,
      holderId: TARGET_ID,
      remainingTicks: 25
    })
    const [{ lifecycle }] = planCarriedOverEffects({ effects: [effect], clockMinute: 2000 })
    expect(
      planResumedCarriedEffects({ effects: [{ ...effect, lifecycle }], clockMinute: 2001 })
    ).toMatchObject([{ kind: 'UPDATE', lifecycle: { schemaVersion: 1, remainingTicks: 20 } }])
  })
})

describe('a timed condition effect on a Character outlasting its Run (SPELLS-5.14)', () => {
  const PARALYZED_ID = conditionTypeId('PARALYZED')

  const storedCondition = (spell: SpellAuthored, lifetimeScope: 'OWNER' | 'ENCOUNTER') =>
    plannedTimedCondition({
      encounterId: ENCOUNTER_ID,
      sourceActorId: SOURCE_ID,
      holderActorId: TARGET_ID,
      spell,
      lifetimeScope
    })

  const characterRecord = (stored: ReturnType<typeof storedCondition>, remainingTicks: number) =>
    prepareActiveRuleEffectRecord({
      id: testUuid(0xc380),
      owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
      definition: stored.definition,
      lifecycle: { schemaVersion: 1, remainingTicks },
      currentEffects: [],
      occurredAt: TIMESTAMP
    })

  it.each([
    ['Invisibility', invisibility],
    ['Hold Person', holdPerson]
  ])('outlasts the Encounter on a Character target: %s', (_label, spell) => {
    expect(storedCondition(spell, 'OWNER').definition.recurrence.lifetimeScope).toBe('OWNER')
    expect(storedCondition(spell, 'ENCOUNTER').definition.recurrence.lifetimeScope).toBe(
      'ENCOUNTER'
    )
  })

  it('moves to the Campaign clock with its remaining rounds, as a grant does', () => {
    const effect = characterRecord(storedCondition(holdPerson, 'OWNER'), 7)
    expect(planCarriedOverEffects({ effects: [effect], clockMinute: 2000 })).toEqual([
      {
        effect,
        lifecycle: { schemaVersion: 1, remainingTicks: null, expiresAtCampaignMinute: 2001 }
      }
    ])
  })

  it('leaves no turn boundary to count it down once carried', () => {
    const effect = characterRecord(storedCondition(holdPerson, 'OWNER'), 7)
    const [{ lifecycle }] = planCarriedOverEffects({ effects: [effect], clockMinute: 2000 })
    const state = { id: ENCOUNTER_ID } as Parameters<typeof isTurnEffectEligible>[2]
    const actor = characterActor({ id: TARGET_ID, characterId: CHARACTER_ID })
    const stage = effect.definition.recurrence.recurrenceStage
    if (stage === 'NONE') throw new Error('Hold Person counts down at a turn boundary.')
    expect(isTurnEffectEligible(effect, actor, state, stage)).toBe(true)
    expect(isTurnEffectEligible({ ...effect, lifecycle }, actor, state, stage)).toBe(false)
  })

  it('releases the condition the ended effect alone owns', () => {
    const held = characterRecord(storedCondition(holdPerson, 'OWNER'), 7)
    expect(endedMaintenanceConditions([held], [])).toEqual(new Set([PARALYZED_ID]))
    expect(endedMaintenanceConditions([held], [{ ...held, id: testUuid(0xc381) }])).toEqual(
      new Set()
    )
  })
})

describe('a timed condition counted on its source’s turns (SPELLS-4.T2a1, Color Spray)', () => {
  const storedBlindness = (currentActorId: string | null) =>
    plannedTimedCondition({
      encounterId: ENCOUNTER_ID,
      sourceActorId: SOURCE_ID,
      holderActorId: TARGET_ID,
      spell: colorSpray,
      lifetimeScope: 'ENCOUNTER',
      currentActorId
    })
  const record = (stored: ReturnType<typeof storedBlindness>) =>
    grantRecord(stored, { id: 0xc390, holderId: TARGET_ID })
  const ticks = (effect: ActiveRuleEffectRecord, turnActorId: string) =>
    planEncounterGrantTicks({
      encounterId: ENCOUNTER_ID,
      stage: 'END_OF_TURN',
      turnActorId,
      holders: [{ actor: holder(TARGET_ID).actor, effects: [effect] }]
    })

  it('stores no recurrence stage and a tick count anchored to the caster’s end of turn', () => {
    expect(storedBlindness(null).definition.recurrence).toMatchObject({
      recurrenceStage: 'NONE',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 1,
        decrementStage: 'END_OF_TURN',
        anchor: 'SOURCE'
      }
    })
  })

  it('counts one more when cast on the caster’s own turn, so it lasts through the next one', () => {
    expect(storedBlindness(SOURCE_ID).definition.recurrence.expiration).toMatchObject({
      initialRemaining: 2
    })
    expect(storedBlindness(OTHER_ID).definition.recurrence.expiration).toMatchObject({
      initialRemaining: 1
    })
  })

  it('counts down at the end of the caster’s turn, never the holder’s', () => {
    const effect = record(storedBlindness(SOURCE_ID))
    expect(ticks(effect, TARGET_ID)).toEqual([])
    expect(ticks(effect, SOURCE_ID)).toMatchObject([{ kind: 'UPDATE', remainingTicks: 1 }])
    expect(
      ticks({ ...effect, lifecycle: { ...effect.lifecycle, remainingTicks: 1 } }, SOURCE_ID)
    ).toMatchObject([{ kind: 'EXPIRE' }])
  })

  it('is not left to the turn-effect kernel', () => {
    const effect = record(storedBlindness(SOURCE_ID))
    const state = { id: ENCOUNTER_ID } as Parameters<typeof isTurnEffectEligible>[2]
    const actor = holder(TARGET_ID).actor
    expect(isTurnEffectEligible(effect, actor, state, 'END_OF_TURN')).toBe(false)
  })

  it('ends with its caster’s departure, releasing the blindness it alone held', () => {
    const effect = record(storedBlindness(SOURCE_ID))
    expect(
      planDepartedSourceGrantRemovals({
        encounterId: ENCOUNTER_ID,
        departedActorId: SOURCE_ID,
        holders: [{ actor: holder(TARGET_ID).actor, effects: [effect] }]
      })
    ).toEqual([effect])
    expect(endedMaintenanceConditions([effect], [])).toEqual(new Set([conditionTypeId('BLINDED')]))
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

describe('planReinstatedConcentrations (SPELLS-5.12, D151)', () => {
  const CASTER_ACTOR_ID = testUuid(0xc3a0)
  const CASTER_CHARACTER_ID = testUuid(0xc3a1)
  const [, concentration] = SRD_CONCENTRATION_DEFINITIONS
  const definition = reusableDefinitionCurrentDtoSchema.parse({
    ...concentration,
    gameSystemId: SRD_SYSTEM_ID,
    contentSourceId: testUuid(0xc3a2),
    contractVersion: 1,
    version: 1,
    publishedAt: TIMESTAMP,
    publishedBy: testUuid(0xc3a3)
  })
  const actors = [
    characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_CHARACTER_ID }),
    creatureActor({ id: SOURCE_ID, snapshot: {} })
  ]
  const stamped = (
    id: number,
    caster: string | null,
    overrides: Partial<Pick<ActiveRuleEffectRecord, 'owner' | 'maintainedEffectStateId'>> = {}
  ): ActiveRuleEffectRecord => {
    const effect = grantRecord(storedGrant({ lifecycle: {}, currentActorId: null }), {
      id,
      holderId: TARGET_ID,
      remainingTicks: 4
    })
    return {
      ...effect,
      owner: { kind: 'CHARACTER', characterId: CHARACTER_ID },
      lifecycle: { ...effect.lifecycle, concentrationCasterCharacterId: caster },
      ...overrides
    }
  }
  const plan = (
    effects: ActiveRuleEffectRecord[],
    readDefinition: () => Promise<typeof definition | null> = async () => definition
  ) =>
    planReinstatedConcentrations({ gameSystemId: SRD_SYSTEM_ID, actors, effects, readDefinition })

  it('gives a caster in the Run one System Concentration for all the grants stamped with them', async () => {
    const first = stamped(0xc3a4, CASTER_CHARACTER_ID)
    const second = stamped(0xc3a5, CASTER_CHARACTER_ID, {
      owner: { kind: 'CHARACTER', characterId: CASTER_CHARACTER_ID }
    })
    await expect(plan([first, second])).resolves.toEqual([
      {
        casterActorId: CASTER_ACTOR_ID,
        effects: [first, second],
        descriptor: {
          schemaVersion: 2,
          maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
          definitionChecksum: concentration.checksum,
          provenance: { kind: 'CARRIED', casterCharacterId: CASTER_CHARACTER_ID },
          sourceActorId: CASTER_ACTOR_ID,
          replacementPolicy: 'REPLACE_SAME_DEFINITION',
          emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
        }
      }
    ])
    const [{ descriptor }] = await plan([first])
    expect(encounterMaintainedEffectDescriptorDtoSchema.parse(descriptor)).toEqual(descriptor)
  })

  it('reinstates nothing, and reads no definition, for a caster outside the Run', async () => {
    let reads = 0
    const readDefinition = async () => {
      reads += 1
      return definition
    }
    await expect(plan([stamped(0xc3a6, testUuid(0xc3af))], readDefinition)).resolves.toEqual([])
    expect(reads).toBe(0)
  })

  it('skips unstamped, already linked and Encounter-actor effects', async () => {
    const unstamped = stamped(0xc3a7, null)
    const linked = stamped(0xc3a8, CASTER_CHARACTER_ID, {
      maintainedEffectStateId: testUuid(0xc3ae)
    })
    const onActor = stamped(0xc3a9, CASTER_CHARACTER_ID, {
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: TARGET_ID }
    })
    await expect(plan([unstamped, linked, onActor])).resolves.toEqual([])
  })

  it('refuses a missing definition, or one from another System or family', async () => {
    const effects = [stamped(0xc3aa, CASTER_CHARACTER_ID)]
    await expect(plan(effects, async () => null)).rejects.toThrow(
      'The System Concentration definition is unavailable.'
    )
    await expect(
      plan(effects, async () => ({ ...definition, gameSystemId: testUuid(0xc3ab) }))
    ).rejects.toThrow('The System Concentration definition is unavailable.')
    await expect(
      plan(effects, async () => ({ ...definition, definitionFamilyKey: 'rules-runtime-graph' }))
    ).rejects.toThrow('The System Concentration definition is unavailable.')
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
