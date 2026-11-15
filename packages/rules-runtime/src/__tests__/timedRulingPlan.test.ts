import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { arcaneLock } from '@artificer-toolkit/source-data/srd/spells/arcane-lock.js'
import { geas } from '@artificer-toolkit/source-data/srd/spells/geas.js'
import { continualFlame } from '@artificer-toolkit/source-data/srd/spells/continual-flame.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { suggestion } from '@artificer-toolkit/source-data/srd/spells/suggestion.js'
import { describe, expect, it } from 'vitest'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../systems/dnd5e/concentrationIdentity.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast, plannedCastEffects } from '../testing/plannedTimedCondition.js'

const SOURCE_ID = testUuid(0xd701)
const HOLDER_ID = testUuid(0xd702)
const LIFETIME_REFUSAL =
  'D&D Effect action must have one fixed direct result without lifecycle overrides. Its duration, lifecycle or maintenance has no plan that holds it.'

/** The spell cast from a class slot at its own level, through the real cast and entry compilers. */
function castOf(spell: SpellAuthored) {
  const sourceInstanceId = `class-${spell.id}`
  return compiledTestSpellCast({
    spell,
    cast: {
      sequence: 0,
      candidateId: `CLASS:${sourceInstanceId}:${spell.id}:level:${spell.level}`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId },
      spellLevel: spell.level,
      castMode: 'SPELL_SLOT',
      castLevel: spell.level,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: {
      status: 'AVAILABLE',
      reasonCode: 'SPELL_SLOT_REMAINING',
      slotKey: `STANDARD:${spell.level}`
    }
  }).entry
}

/** The effects the room plans when `spell` lands on the holder along `resultPath`. */
function landed(
  spell: SpellAuthored,
  resultPath: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS',
  campaignClockMinute?: number | null
) {
  return plannedCastEffects({
    encounterId: testUuid(0xd700),
    sourceActorId: SOURCE_ID,
    holderActorId: HOLDER_ID,
    spell,
    entry: castOf(spell),
    lifetimeScope: 'ENCOUNTER',
    resultPath,
    campaignClockMinute
  })
}

/** The spell's one Effect as a Character action, compiled straight through the System adapter. */
function compileDirect(spell: SpellAuthored) {
  const [effect] =
    compileSpell({
      ...spell,
      effects: (spell.effects ?? []).map((authored) => ({ ...authored, id: ACTION_EFFECT_ID }))
    }).effects ?? []
  if (!effect) throw new Error(`${spell.label} authors no Effect.`)
  return () =>
    dnd5eCharacterRuleActionSystemAdapter.compile({ action: characterActionDescriptor(effect) })
}

/** `spell` with its one result's duration replaced. */
function withDuration(
  spell: SpellAuthored,
  duration: { durationKind: 'DAY' | 'MONTH'; amount: number }
): SpellAuthored {
  return {
    ...spell,
    effects: (spell.effects ?? []).map((effect) => ({
      ...effect,
      // The spell's paths are all direct results, which carry a result block.
      paths: effect.paths.map((path) => {
        const { resultBlock } = path as Extract<typeof path, { resultBlock: unknown }>
        return {
          ...path,
          resultBlock: { ...resultBlock, duration: { ...resultBlock.duration, ...duration } }
        }
      })
    }))
  } as SpellAuthored
}

/** The GM ruling `effect` holds, by its stored state contributions. */
const rulingOf = (effect: ReturnType<typeof landed>['recurringEffect']) =>
  effect?.definition.stateContributions.filter(({ kind }) => kind === 'GM_RULING')

describe('a GM ruling with a duration is held as a timed ruling (QUALITY-15.T3)', () => {
  it('holds a failed Suggestion for 8 hours under Concentration, carrying the ruling text', () => {
    const { activeEffectPlan } = castOf(suggestion).compilation
    expect(activeEffectPlan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      // 8 hours of 6-second turns.
      initialRemaining: 4800,
      resultGate: { paths: ['ON_SAVE_FAIL'] },
      maintenance: { definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
    })
    const { recurringEffect } = landed(suggestion, 'ON_SAVE_FAIL')
    expect(rulingOf(recurringEffect)).toEqual([
      {
        kind: 'GM_RULING',
        rulingOutcomeId: expect.any(String),
        label: 'Judge the Suggested Course',
        instructions:
          'The suggestion must be worded in such a manner as to make the course of action sound reasonable.'
      }
    ])
    expect(recurringEffect?.lifecycle.remainingTicks).toBe(4800)
  })

  it('leaves nothing behind when the target makes its save against Suggestion', () => {
    expect(landed(suggestion, 'ON_SAVE_SUCCESS').recurringEffect).toBeNull()
  })

  it('holds an Arcane Lock until dispelled: never ticked, never expiring, no Concentration', () => {
    const { activeEffectPlan } = castOf(arcaneLock).compilation
    expect(activeEffectPlan).toMatchObject({
      recurrenceStage: 'NONE',
      initialRemaining: null,
      maintenance: null
    })
    const { recurringEffect } = landed(arcaneLock, 'ON_SAVE_FAIL')
    expect(rulingOf(recurringEffect)).toHaveLength(1)
    expect(recurringEffect?.lifecycle.remainingTicks).toBeNull()
  })

  it('holds Geas for 30 days by the Campaign clock, counting no turns (QUALITY-15.T3i, D222)', () => {
    const { activeEffectPlan } = castOf(geas).compilation
    expect(activeEffectPlan).toMatchObject({
      recurrenceStage: 'NONE',
      initialRemaining: null,
      // 30 days of 1,440 Campaign minutes.
      campaignMinutes: 43_200,
      maintenance: null
    })
    const { recurringEffect } = landed(geas, 'ON_SAVE_FAIL', 10_000)
    expect(recurringEffect?.definition.recurrence.expiration).toEqual({
      kind: 'CAMPAIGN_MINUTES',
      minutes: 43_200
    })
    expect(rulingOf(recurringEffect)).toHaveLength(1)
    // A Campaign with a clock stamps the cast minute plus the ruling's minutes (QUALITY-15.T3i2).
    expect(recurringEffect?.lifecycle).toMatchObject({
      remainingTicks: null,
      expiresAtCampaignMinute: 53_200
    })
  })

  it('stamps no expiry for a Campaign with no clock, which lasts until the GM ends it', () => {
    expect(landed(geas, 'ON_SAVE_FAIL', null).recurringEffect?.lifecycle).toMatchObject({
      remainingTicks: null,
      expiresAtCampaignMinute: null
    })
  })

  it('refuses to plan a Campaign-minute ruling before the Campaign clock is read', () => {
    expect(() => landed(geas, 'ON_SAVE_FAIL')).toThrow(
      'An effect counted in Campaign minutes requires the Campaign clock read.'
    )
  })

  it('keeps counting turns for a ruling that fits the bound, and refuses a calendar month', () => {
    const oneDay = withDuration(geas, { durationKind: 'DAY', amount: 1 })
    expect(castOf(oneDay).compilation.activeEffectPlan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 14_400
    })
    expect(castOf(oneDay).compilation.activeEffectPlan).not.toHaveProperty('campaignMinutes')
    expect(compileDirect(withDuration(geas, { durationKind: 'MONTH', amount: 1 }))).toThrow(
      LIFETIME_REFUSAL
    )
  })
})

describe('a timed ruling beside an instant result is held (QUALITY-15.T3h)', () => {
  it("holds Turn Undead's Turned for 1 minute while Destroy Undead's kill stays a test outcome", () => {
    const authored = cleric.features
      ?.find(({ label }) => label === 'Channel Divinity')
      ?.effects?.find(({ invocation }) => invocation.kind === 'ACTION')
    if (!authored) throw new Error('Cleric Channel Divinity authors no action Effect.')
    const action = {
      ...characterActionDescriptor(compileEffect({ ...authored, id: ACTION_EFFECT_ID })),
      conditionDefinitionIds: []
    }
    const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
      action,
      compilerSource: buildCompiledActionCompilerSource(action)
    })
    if (plan?.kind !== 'TEST_OUTCOME') throw new Error('Channel Divinity compiles to a test.')
    const [timed] =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
        action,
        published: plan.test.published
      }) ?? []
    expect(timed).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      // 1 minute of 6-second turns.
      initialRemaining: 10,
      resultGate: { paths: ['ON_SAVE_FAIL'] },
      rulingContribution: { label: 'Turned' }
    })
    // The ruling is the plan's, so the failed save's one outcome graph is the gated kill.
    expect(plan.outcomes).toHaveLength(1)
  })
})

/** The object manifestations `effect` holds, by its stored state contributions. */
const manifestationsOf = (effect: ReturnType<typeof landed>['recurringEffect']) =>
  effect?.definition.stateContributions.filter(({ kind }) => kind === 'OBJECT_MANIFESTATION')

describe('an object manifestation with a duration is held (QUALITY-15.T3j)', () => {
  it('holds Light for 1 hour, carrying the object, its light and attachment, beside the ruling', () => {
    expect(compileDirect(light)).not.toThrow()
    const { activeEffectPlan } = castOf(light).compilation
    expect(activeEffectPlan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      // 1 hour of 6-second turns.
      initialRemaining: 600,
      maintenance: null
    })
    const { recurringEffect } = landed(light, 'ON_SAVE_FAIL')
    expect(manifestationsOf(recurringEffect)).toEqual([
      {
        kind: 'OBJECT_MANIFESTATION',
        manifestationOutcomeId: expect.any(String),
        label: 'Light',
        attachmentKind: 'TOUCHED_OBJECT',
        light: {
          bright: { amount: 20, unit: 'FEET' },
          dimAdditional: { amount: 20, unit: 'FEET' }
        },
        properties: ['CAN_BE_COVERED_OR_HIDDEN']
      }
    ])
    expect(recurringEffect?.lifecycle.remainingTicks).toBe(600)
  })

  it('holds Continual Flame until dispelled, never ticked, with every authored property', () => {
    const { activeEffectPlan } = castOf(continualFlame).compilation
    expect(activeEffectPlan).toMatchObject({
      recurrenceStage: 'NONE',
      initialRemaining: null,
      maintenance: null
    })
    const { recurringEffect } = landed(continualFlame, 'ON_SAVE_FAIL')
    expect(manifestationsOf(recurringEffect)).toMatchObject([
      {
        label: 'Continual Flame',
        attachmentKind: 'TOUCHED_OBJECT',
        properties: [
          'CANNOT_BE_QUENCHED',
          'CANNOT_BE_SMOTHERED',
          'CAN_BE_COVERED_OR_HIDDEN',
          'NO_HEAT',
          'NO_OXYGEN_USE'
        ]
      }
    ])
    expect(recurringEffect?.lifecycle.remainingTicks).toBeNull()
  })
})
