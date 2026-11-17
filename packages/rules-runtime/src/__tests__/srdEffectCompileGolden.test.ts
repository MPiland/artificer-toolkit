import { describe, expect, it } from 'vitest'
import {
  equipmentEffectDtoSchema,
  featureEffectDtoSchema
} from '@artificer-toolkit/schema/effects/effect'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { SPELL_ATTRIBUTE, type SpellAttribute } from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { EffectActionCapabilityDescriptor } from '../characterActionCapabilityDiscovery.js'
import type { CharacterRuleActionExecutionPlan } from '../characterRuleActionSystemAdapter.js'
import {
  compileActionPlacement,
  compileCastChoicePlans,
  compileEncounterFeatureActionPlan
} from '../encounterActionEntryPointCompiler.js'
import { castChoiceOptions } from '../encounterCastChoice.js'
import { discoverUncompiledEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscovery.js'
import { isActivatedEffect } from '../spellCastCandidates.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { srdCreatureActor, srdCreatureTarget, testUuid } from '../testing/dnd5eSrdEncounter.js'

type AuthoredEffect = NonNullable<ReturnType<typeof parseEffect>>

/** Character level of the base line of a Character-owned Effect. */
const BASE_CHARACTER_LEVEL = 20
/** Character levels pinned as variant lines, shown only where they differ from the base line. */
const CHARACTER_LEVEL_VARIANTS = [
  { tag: '@L1', characterLevel: 1 },
  { tag: '@L5', characterLevel: 5 },
  { tag: '@L11', characterLevel: 11 }
] as const
/** The slot level a leveled spell is upcast to for its `@U9` variant line. */
const UPCAST_LEVEL = 9

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

/** The Creature every fact binding is bound against, built as the Encounter builds a target. */
const BINDING_TARGET = srdCreatureTarget(
  srdCreatureActor({
    id: testUuid(0x0fff),
    creature: srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Goblin')!
  })
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A node is an authored Effect only when an authored Effect schema accepts it. */
function parseEffect(node: Record<string, unknown>) {
  if (typeof node.id !== 'string' || !isRecord(node.invocation) || typeof node.order !== 'number')
    return null
  const feature = featureEffectDtoSchema.safeParse(node)
  if (feature.success) return feature.data
  const equipment = equipmentEffectDtoSchema.safeParse(node)
  return equipment.success ? equipment.data : null
}

type Found = {
  effect: AuthoredEffect
  /** The Effects listed beside it, which a repeat offer can name. */
  siblings: AuthoredEffect[]
  label: string
  spellLevel: number | undefined
  /** The owning spell's own attributes, which the compiler reads for each of its Effects. */
  attributes: SpellAttribute[]
}

const isSpellAttribute = (value: unknown): value is SpellAttribute =>
  typeof value === 'string' && Object.hasOwn(SPELL_ATTRIBUTE, value)

/** Every authored Effect under a subject, with the label and spell level of its owner. */
function collectEffects(node: unknown, owner: Omit<Found, 'effect' | 'siblings'>, found: Found[]) {
  if (Array.isArray(node)) {
    const start = found.length
    for (const entry of node) collectEffects(entry, owner, found)
    const siblings = found.slice(start).map(({ effect }) => effect)
    for (const entry of found.slice(start)) entry.siblings = siblings
    return
  }
  if (!isRecord(node)) return
  const effect = parseEffect(node)
  if (effect) {
    found.push({ effect, siblings: [effect], ...owner })
    return
  }
  const next = {
    label: typeof node.label === 'string' ? node.label : owner.label,
    spellLevel: typeof node.level === 'number' ? node.level : owner.spellLevel,
    attributes:
      typeof node.level === 'number' && Array.isArray(node.attributes)
        ? node.attributes.filter(isSpellAttribute)
        : owner.attributes
  }
  for (const value of Object.values(node)) collectEffects(value, next, found)
}

const describeGraph = ({
  checksum,
  definition
}: {
  checksum: string
  definition: { nodes: readonly unknown[]; outputs: object }
}) =>
  `${checksum} nodes=${definition.nodes.length} outputs=${Object.keys(definition.outputs).length}`

/** The graph an action runs first, which its active-effect plans and its fact binding read. */
const publishedOf = (plan: CharacterRuleActionExecutionPlan) =>
  plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published

function describePlan(plan: CharacterRuleActionExecutionPlan) {
  if (plan.kind === 'SINGLE_GRAPH') return `SINGLE_GRAPH ${describeGraph(plan.published)}`
  const outcomes = [...plan.outcomes]
    .map(({ pathCode, template }) => `${pathCode}=${template.checksum}`)
    .sort()
    .join(',')
  return `TEST_OUTCOME test=${describeGraph(plan.test.published)} outcomes=[${outcomes}]`
}

type Compiled = {
  action: EffectActionCapabilityDescriptor
  plan: CharacterRuleActionExecutionPlan
  /** The options a cast pick (D148) compiles to, one plan pair each; absent for an action with no pick. */
  choice?: ReturnType<typeof compileCastChoicePlans>['choice']
}

const refusal = (error: unknown) => {
  const name = error instanceof Error ? error.name : 'UnknownError'
  const message = error instanceof Error ? error.message : String(error)
  return `REFUSED ${name}: ${message}`
}

/** A checksum of a product value as its JSON, so an absent optional field does not count. */
const checksumOf = (value: unknown) => checksumRuleDocument(JSON.parse(JSON.stringify(value)))

/** The action's active-effect plans in the System's order: each one's recurrence stage and checksum. */
function describeActiveEffectPlans({ action, plan, choice }: Compiled) {
  const describe = (entry: { recurrenceStage: string }) =>
    `${entry.recurrenceStage}=${checksumOf(entry)}`
  // A pick compiles one plan pair per option; the action's own plans are its first option's.
  if (choice)
    return `[${choice.options
      .map(
        ({ label, activeEffectPlan }) =>
          `${label}:${activeEffectPlan ? describe(activeEffectPlan) : 'NONE'}`
      )
      .join(',')}]`
  const plans =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action,
      published: publishedOf(plan)
    }) ?? []
  return `[${plans.map(describe).join(',')}]`
}

/** The facts the action's first graph is bound with against the fixed target, and its d20 mode. */
function describeFactBinding({ action, plan }: Compiled) {
  const bound = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
    actionMechanic: {
      outcomes: [],
      ...(action.spellCastLevel !== undefined && { spellCastLevel: action.spellCastLevel })
    },
    published: publishedOf(plan),
    sourceDerivedFacts: {},
    targetActorId: BINDING_TARGET.actor.id,
    targetDerivedFacts: BINDING_TARGET.targetDerivedFacts,
    targetConditionIds: BINDING_TARGET.state.conditions,
    currentHitPoints: BINDING_TARGET.state.current,
    temporaryHitPoints: BINDING_TARGET.state.temporary,
    maximumHitPoints: BINDING_TARGET.effectiveMaximumHitPoints,
    targetScalarValues: BINDING_TARGET.effectiveScalarValues,
    defenses: BINDING_TARGET.defenses,
    conditionImmunityIds: BINDING_TARGET.conditionImmunityIds
  })
  return `${checksumOf(bound)} count=${Object.keys(bound.facts).length} d20=${bound.d20RollMode ?? 'NONE'}`
}

/**
 * What a compile pinned: the plan it produced with its active-effect plans, or the failure it ended
 * in; and the fact binding of that plan. A scaling variant is one whose `compiled` differs, since a
 * cast level alone changes the facts of every leveled spell.
 */
type Outcome = { compiled: string; facts: string | null }

function outcomeOf(compile: () => Compiled): Outcome {
  let compiled: Compiled
  let graph: string
  try {
    compiled = compile()
    graph = describePlan(compiled.plan)
    if (compiled.choice)
      graph += ` choice=[${compiled.choice.options
        .map(({ label, executionPlan }) => `${label}=${describePlan(executionPlan)}`)
        .join(' ; ')}]`
  } catch (error) {
    return { compiled: refusal(error), facts: null }
  }
  const column = (describe: (compiled: Compiled) => string) => {
    try {
      return describe(compiled)
    } catch (error) {
      return refusal(error)
    }
  }
  return {
    compiled: `${graph} | plans=${column(describeActiveEffectPlans)}`,
    facts: column(describeFactBinding)
  }
}

/**
 * A Character-owned Effect, compiled the way a Character action is: a descriptor over the compiled
 * Effect, then the System plan. The Effect is compiled under the descriptor's fixed id, so a
 * checksum does not depend on the Effect's own id.
 */
function characterOutcome(
  { effect, siblings, attributes }: Pick<Found, 'effect' | 'siblings' | 'attributes'>,
  spellCastLevel: number | undefined,
  characterLevel: number
) {
  const action = {
    ...characterActionDescriptor(
      compileSpellEffect(
        { attributes, effects: siblings },
        {
          ...effect,
          id: ACTION_EFFECT_ID
        }
      ),
      spellCastLevel,
      characterLevel
    ),
    conditionDefinitionIds
  }
  // The product places a zone or a summon before it plans a cast, so the golden pins the same
  // order. Only an activated action is discovered as a Character action at all.
  if (isActivatedEffect(effect)) {
    try {
      const placement = compileActionPlacement(dnd5eCharacterRuleActionSystemAdapter, action)
      if (placement)
        return { compiled: `${placement.kind}_PLACEMENT ${checksumOf(placement)}`, facts: null }
    } catch (error) {
      return { compiled: refusal(error), facts: null }
    }
  }
  // The product compiles the plans of an action, and of each option of a cast pick, in one place.
  return outcomeOf(() => {
    const { executionPlan, choice } = compileCastChoicePlans(
      dnd5eCharacterRuleActionSystemAdapter,
      action
    )
    return { action, plan: executionPlan, choice }
  })
}

type Line = { id: string; rank: number; text: string }
const line = (id: string, rank: number, key: string, { compiled, facts }: Outcome): Line => ({
  id,
  rank,
  text: `${id} ${key} | ${compiled}${facts === null ? '' : ` | facts=${facts}`}`
})

const ownerKey = (kind: string, label: string) => `${kind} ${label.replaceAll('\n', ' ')}`

function characterLines(found: Found, kind: string): Line[] {
  const { effect, label, spellLevel } = found
  const base = characterOutcome(found, spellLevel, BASE_CHARACTER_LEVEL)
  const upcast =
    spellLevel !== undefined && spellLevel >= 1 && spellLevel < UPCAST_LEVEL
      ? [
          {
            tag: `@U${UPCAST_LEVEL}`,
            outcome: characterOutcome(found, UPCAST_LEVEL, BASE_CHARACTER_LEVEL)
          }
        ]
      : []
  const variants = [
    ...CHARACTER_LEVEL_VARIANTS.map(({ tag, characterLevel }) => ({
      tag,
      outcome: characterOutcome(found, spellLevel, characterLevel)
    })),
    ...upcast
  ].filter(({ outcome }) => outcome.compiled !== base.compiled)
  return [
    line(effect.id, 0, ownerKey(kind, label), base),
    ...variants.map(({ tag, outcome }, index) => line(effect.id, index + 1, tag, outcome))
  ]
}

/**
 * A Creature-owned Effect, compiled the way the Encounter does: Creature action discovery, which
 * binds the real Effect identity, then the shared Feature action plan. An Effect that discovery
 * does not list as an action (a passive trait) is pinned as such.
 */
function creatureLines(creatureIndex: number): Line[] {
  const creature = srdBaselineContent.subjects.creatures[creatureIndex]!
  const discovery = discoverUncompiledEncounterFeatureActions({
    actor: srdCreatureActor({ id: testUuid(0x1000 + creatureIndex), creature }),
    conditionDefinitionIds,
    abilityDefinitions,
    spells: new Map()
  })
  const found: Found[] = []
  collectEffects(creature, { label: creature.label, spellLevel: undefined, attributes: [] }, found)
  return found.map(({ effect, label }) => {
    const capability = discovery.available.find((candidate) => candidate.effectId === effect.id)
    // A pick (D148) runs the option its user names, so its plans are pinned per option, as they
    // are for a Character action; the action's own plan is the first option's no-prompt default.
    const outcome = capability
      ? outcomeOf(() => ({
          action: capability,
          plan: compileEncounterFeatureActionPlan(
            dnd5eCharacterRuleActionSystemAdapter,
            capability
          ),
          ...(castChoiceOptions(capability.compiledEffect) && {
            choice: compileCastChoicePlans(dnd5eCharacterRuleActionSystemAdapter, capability).choice
          })
        }))
      : { compiled: 'NOT_A_DISCOVERED_ACTION', facts: null }
    return line(effect.id, 0, ownerKey('CREATURE', label), outcome)
  })
}

const { creatures, ...characterSubjects } = srdBaselineContent.subjects

function goldenLines(): Line[] {
  return [
    ...creatures.flatMap((_creature, index) => creatureLines(index)),
    ...Object.entries(characterSubjects).flatMap(([subject, records]) => {
      const found: Found[] = []
      collectEffects(records, { label: '', spellLevel: undefined, attributes: [] }, found)
      return found.flatMap((entry) => characterLines(entry, `CHARACTER:${subject}`))
    })
  ]
}

/**
 * Why each refusal the SRD corpus meets stands. `GAME_RULE`: the rules forbid the action as
 * authored. `INVALID_INPUT`: the authored or bound input is incomplete or contradicts itself.
 * `UNBUILT`: a rules-valid combination the compiler does not build yet.
 */
const REFUSAL_CLASSES: Readonly<Record<string, 'GAME_RULE' | 'INVALID_INPUT' | 'UNBUILT'>> = {
  'D&D free action with no charge is taken on its user alone.': 'GAME_RULE',
  'D&D Self action range of distance bounds only its user teleporting.': 'GAME_RULE',
  // Arcane Recovery, Natural Recovery and Font of Magic: the player picks the slots on the Sheet,
  // whose command settles the exchange in and out of an Encounter (QUALITY-15.T3q ruling).
  'D&D spell-slot exchange is settled by the EXCHANGE_SPELL_SLOTS Sheet command, not an encounter action.':
    'GAME_RULE',

  'D&D Effect is not an activated action.': 'INVALID_INPUT',
  'D&D action off a Self range must name its targeting.': 'INVALID_INPUT',
  "D&D area outside its user's own space must name its shape.": 'INVALID_INPUT',
  'D&D creature target needs a distance, Touch, Sight or unlimited range.': 'INVALID_INPUT',
  'D&D Self target needs a Self range, or a distance its own teleport may reach.': 'INVALID_INPUT',
  'D&D Self target names no area shape.': 'INVALID_INPUT',
  'D&D single target names no area shape.': 'INVALID_INPUT',
  'D&D test action has no authored result.': 'INVALID_INPUT',
  'D&D test action paths must be unique direct outcomes. Its path is not one its test resolves to.':
    'INVALID_INPUT',
  // The fact binding is given no rolled or spent amount: the room resolves one before it binds.
  'D&D dice healing requires one exact resolved healing expression.': 'INVALID_INPUT',
  'D&D spent healing requires one exact resolved amount and the units spent.': 'INVALID_INPUT',
  'D&D recurring healing requires one exact resolved fixed amount.': 'INVALID_INPUT',
  'D&D bonus healing requires one exact resolved amount.': 'INVALID_INPUT',
  'D&D subtract-from-triggering-roll action requires one exact resolved die.': 'INVALID_INPUT',

  'A placed zone models only its label, shape and entering components.': 'UNBUILT',
  // Rows whose maintained effect has no plan type yet (QUALITY-15.T3n): Animate Objects (animated
  // objects with no stat block), Clairvoyance (a stationary sensor), Dancing Lights (lights with no
  // summon light or count), Barkskin (an Armor Class floor), Tree Stride (tree-to-tree travel), Call
  // Lightning (a repeat bolt each turn), Delayed Blast Fireball (detonates when the spell ends),
  // Flaming Sphere (a movable damaging sphere) and Resilient Sphere (a zone attached to its target).
  'D&D Concentration spell has no supported maintained effect.': 'UNBUILT',
  'D&D Effect action must have one fixed direct result without lifecycle overrides. Its duration, lifecycle or maintenance has no plan that holds it.':
    'UNBUILT',
  'D&D Effect action must have one fixed direct result without lifecycle overrides. It applies more than one result.':
    'UNBUILT',
  'D&D test action paths must be unique direct outcomes. Its duration, lifecycle or maintenance has no plan that holds it.':
    'UNBUILT',
  'D&D Effect action outcome is not a supported hit-point or condition outcome. It is no timed creature form.':
    'UNBUILT',
  'D&D test action has an unsupported bounded shape.': 'UNBUILT',
  'D&D reaction must name a registered trigger.': 'UNBUILT'
}

describe('SRD effect compile golden', () => {
  const lines = goldenLines()

  it('finds the authored SRD effects, once each', () => {
    const baseIds = lines.filter(({ rank }) => rank === 0).map(({ id }) => id)
    expect(baseIds.length).toBeGreaterThan(0)
    expect(new Set(baseIds).size).toBe(baseIds.length)
  })

  it('compiles every authored SRD effect, at its scaling variants, to the committed outcome', async () => {
    const text = [...lines]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.rank - b.rank))
      .map((entry) => entry.text)
      .join('\n')
    await expect(`${text}\n`).toMatchFileSnapshot('./__golden__/srdEffectCompile.golden.txt')
  })

  it('refuses an SRD effect only for a classified reason (QUALITY-15.1)', () => {
    const reasons = new Set(
      lines.flatMap(({ text }) =>
        [...text.matchAll(/REFUSED [^:]+: (.+?)(?= \| |$)/g)].map(([, reason]) => reason)
      )
    )
    const classOf = (reason: string | undefined) =>
      reason === undefined ? 'UNCLASSIFIED' : (REFUSAL_CLASSES[reason] ?? 'UNCLASSIFIED')
    expect([...reasons].filter((reason) => classOf(reason) === 'UNCLASSIFIED')).toEqual([])
    // The unbuilt paths still refused, which only shrink: QUALITY-15 follow-up splits build them.
    expect([...reasons].filter((reason) => classOf(reason) === 'UNBUILT').sort()).toEqual(
      Object.entries(REFUSAL_CLASSES)
        .filter(([, refusalClass]) => refusalClass === 'UNBUILT')
        .map(([reason]) => reason)
        .sort()
    )
  })
})
