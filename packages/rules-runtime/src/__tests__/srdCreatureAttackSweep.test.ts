import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_CREATURE_ATTACK_DAMAGE } from '@artificer-toolkit/source-data/srd/creatures/attack-damage.js'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import {
  SRD_ABILITIES,
  SRD_DAMAGE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { normalizeCharacterActionMechanicFacts } from '../character/characterActionRuleFacts.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { planNativeEncounterActionMechanics } from '../encounterActionMechanicsPlan.js'
import { castChoiceOptions } from '../encounterCastChoice.js'
import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { dnd5eAttackKind } from '../systems/dnd5e/attackKind.js'
import { resolveCreatureDamageExpression } from '../systems/dnd5e/effectActionCompiler.js'
import {
  createSrdRulesRuntime,
  srdCreatureActor,
  srdCreatureTarget,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import { outcomeDice } from './encounterCreatureAction.js'

const ACTOR_ID = testUuid(0xa1)
const TARGET_ID = testUuid(0xa2)
const OCCURRENCE_ID = testUuid(0xe007)
const COMMAND_ID = testUuid(0xe008)
/** 0-based die faces: 15 on the d20 (a hit on the Ogre's AC 11, never a critical), mid-range damage. */
const D20_FACE = 15
const scriptedRandom = (maxExclusive: number) =>
  maxExclusive === 20 ? D20_FACE - 1 : Math.floor(maxExclusive / 2)
/** The same faces with a natural 20 on every d20: a critical hit. */
const criticalRandom = (maxExclusive: number) =>
  maxExclusive === 20 ? 19 : Math.floor(maxExclusive / 2)

/** The seeded SRD Creatures, validated the way Blueprint creation reads them. */
const creatures = prepareSrdImport()
  .subjects.filter((subject) => subject.subjectKind === 'CREATURE')
  .map((subject) => creatureAuthoredDtoSchema.parse(subject.document) as CreatureAuthored)

type Feature = NonNullable<CreatureAuthored['features']>[number]

interface AttackUnit {
  effect: NonNullable<Feature['effects']>[number]
  effectId: string
  label: string
  owner: Feature
  option: Feature | null
  attackBonus: number
}

const damageTypeCodes = new Map(SRD_DAMAGE_TYPES.map(({ id, code }) => [id, code]))

/** `XdY+Z` with dice terms and the summed modifier, or a flat amount, so equal totals compare equal. */
function canonicalDamage(expression: string): string {
  if (/^\d+$/.test(expression)) return expression
  const { terms, modifier } = parseRollExpression(expression)
  const dice = terms.map((term) => `${term.count}d${term.die}`).join('+')
  return modifier === 0 ? dice : `${dice}${modifier > 0 ? '+' : ''}${modifier}`
}

/**
 * Each hit damage part the room resolves for an attack: its dice plus the Creature's authored
 * ability modifiers (the rule `bindFacts` applies), or its flat amount, with the damage type.
 */
function resolvedHitDamage(creature: CreatureAuthored, unit: AttackUnit): string[] {
  const statBlock = { abilityScores: creature.abilityScores }
  return normalizeCharacterActionMechanicFacts(compileEffect(unit.effect)).outcomes.flatMap(
    (outcome) => {
      if (outcome.kind !== 'DAMAGE' || outcome.pathCode !== 'ON_HIT') return []
      const expression =
        resolveCreatureDamageExpression({
          outcome,
          sourceDerivedFacts: { statBlock },
          sourceHitPoints: { current: creature.hitPoints, maximum: creature.hitPoints }
        }) ?? String(outcome.values[0]?.amount ?? 'unresolved')
      const multiplier = outcome.amountMultiplier === null ? '' : ` x${outcome.amountMultiplier}`
      return [
        `${canonicalDamage(expression)} ${damageTypeCodes.get(outcome.damageTypeId)}${multiplier}`
      ]
    }
  )
}

function printedDamage(unit: AttackUnit) {
  const printed = SRD_CREATURE_ATTACK_DAMAGE.get(unit.effectId)
  if (!printed) throw new Error(`${unit.label} has no printed damage entry.`)
  return printed
}

function printedHitDamage(unit: AttackUnit): string[] {
  return printedDamage(unit).map(
    ([expression, damageType]) => `${canonicalDamage(expression)} ${damageType}`
  )
}

/** A critical hit rolls each printed hit damage die twice (SRD 5.1); a flat amount has none. */
function printedCriticalDice(unit: AttackUnit): string[] {
  return printedDamage(unit)
    .flatMap(([expression]) =>
      /^\d+$/.test(expression)
        ? []
        : parseRollExpression(expression).terms.flatMap((term) =>
            Array.from({ length: term.count * 2 }, () => `d${term.die}`)
          )
    )
    .sort()
}

function attackUnits(creature: CreatureAuthored): AttackUnit[] {
  return creature.features.flatMap((owner) =>
    [
      { option: null, source: owner },
      ...(owner.options ?? []).map((option) => ({ option, source: option }))
    ].flatMap(({ option, source }) => {
      const label = `${creature.label}: ${option ? `${owner.label} > ` : ''}${source.label}`
      return (source.effects ?? [])
        .filter(
          (effect) =>
            effect.invocation.kind === 'ACTION' &&
            dnd5eAttackKind(effect.invocation.triggerCode ?? '') !== null
        )
        .map((effect) => {
          const attackRoll = source.rollDefinitions?.find((roll) => roll.kind === 'ATTACK')
          if (!attackRoll) throw new Error(`${label} authors no ATTACK roll.`)
          return {
            effect,
            effectId: effect.id,
            label,
            owner,
            option,
            attackBonus: attackRoll.expression.modifier
          }
        })
    })
  )
}

function failureReason(stage: 'DISCOVERY' | 'PREPARE' | 'EXECUTE' | 'PLAN', error: unknown) {
  return `${stage}: ${error instanceof Error ? error.message : String(error)}`
}

describe('SRD Creature attack sweep', () => {
  it('resolves every SRD Creature attack to its printed hit damage', () => {
    const mismatches: Record<string, string> = {}
    const effectIds = new Set<string>()
    for (const creature of creatures) {
      for (const unit of attackUnits(creature)) {
        effectIds.add(unit.effectId)
        const resolved = resolvedHitDamage(creature, unit).sort()
        const printed = printedHitDamage(unit).sort()
        if (resolved.join(', ') === printed.join(', ')) continue
        mismatches[unit.effectId] =
          `UNEXPECTED ${unit.label}: resolves ${resolved.join(', ')}, prints ${printed.join(', ')}`
      }
    }

    expect(SRD_CREATURE_ATTACK_DAMAGE.size).toBe(effectIds.size)
    expect(mismatches).toEqual({})
  })

  it('sweeps the swallowing attacks as automated damage beside a GM ruling (D187a)', () => {
    const damageParts = {
      'Purple Worm: Bite': 1,
      'Kraken: Bite': 1,
      'Remorhaz: Swallow': 2,
      'Tarrasque: Swallow': 1
    }
    for (const [label, parts] of Object.entries(damageParts)) {
      const units = creatures.flatMap(attackUnits).filter((unit) => unit.label === label)
      expect(units).toHaveLength(1)
      const [unit] = units
      const hitKinds = unit.effect.paths.flatMap((path) =>
        path.pathCode === 'ON_HIT' && path.selectionKind === 'FIXED'
          ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
          : []
      )
      expect(hitKinds).toEqual([...Array(parts).fill('DAMAGE'), 'MANUAL_ADJUDICATION'])
    }
  })

  it('sweeps the lycanthrope bites as automated damage beside a GM-ruled curse (D187a)', () => {
    // The Wereboar's merged Charge save follows its curse ruling (ATTACK-5.T4w).
    for (const label of [
      'Werebear: Bite (Bear or Hybrid Form Only)',
      'Wereboar: Tusks (Boar or Hybrid Form Only)',
      'Wererat: Bite (Rat or Hybrid Form Only)',
      'Weretiger: Bite (Tiger or Hybrid Form Only)',
      'Werewolf: Bite (Wolf or Hybrid Form Only)'
    ]) {
      const units = creatures.flatMap(attackUnits).filter((unit) => unit.label === label)
      expect(units).toHaveLength(1)
      const [unit] = units
      const hitKinds = unit.effect.paths.flatMap((path) =>
        path.pathCode === 'ON_HIT' && path.selectionKind === 'FIXED'
          ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
          : []
      )
      expect(hitKinds).toEqual(['DAMAGE', 'MANUAL_ADJUDICATION'])
    }
  })

  it('sweeps the held-creature attacks as a hold beside automated or GM-ruled riders (D187a)', () => {
    const hitKindsByLabel = {
      'Chain Devil: Chain': ['DAMAGE', 'ACTOR_RELATIONSHIP'],
      'Marilith: Tail': ['DAMAGE', 'ACTOR_RELATIONSHIP', 'MANUAL_ADJUDICATION'],
      'Roper: Tendril': ['ACTOR_RELATIONSHIP', 'MANUAL_ADJUDICATION'],
      'Stirge: Blood Drain': ['DAMAGE', 'ACTOR_RELATIONSHIP', 'MANUAL_ADJUDICATION']
    }
    for (const [label, expected] of Object.entries(hitKindsByLabel)) {
      const units = creatures.flatMap(attackUnits).filter((unit) => unit.label === label)
      expect(units).toHaveLength(1)
      const [unit] = units
      const hitKinds = unit.effect.paths.flatMap((path) =>
        path.pathCode === 'ON_HIT' && path.selectionKind === 'FIXED'
          ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
          : []
      )
      expect(hitKinds).toEqual(expected)
    }
  })

  it('sweeps the lingering poison and wound attacks as a save with a GM ruling on failure (D187a)', () => {
    // The Horned Devil's stanch check is part of its infernal wound ruling (ATTACK-5.T4).
    const failures = {
      'Couatl: Bite': ['CONDITION', 'CONDITION', 'MANUAL_ADJUDICATION'],
      'Horned Devil: Tail': ['MANUAL_ADJUDICATION']
    }
    for (const [label, kinds] of Object.entries(failures)) {
      const units = creatures.flatMap(attackUnits).filter((unit) => unit.label === label)
      expect(units).toHaveLength(1)
      const [unit] = units
      const hitOutcomes = unit.effect.paths.flatMap((path) =>
        path.pathCode === 'ON_HIT' && path.selectionKind === 'FIXED'
          ? path.resultBlock.outcomes
          : []
      )
      expect(hitOutcomes.map(({ effectKind }) => effectKind)).toEqual(['DAMAGE', 'FOLLOW_UP_SAVE'])
      const save = hitOutcomes.find((outcome) => outcome.effectKind === 'FOLLOW_UP_SAVE')
      expect(
        save?.onFailure.kind === 'OUTCOMES' &&
          save.onFailure.outcomes.map(({ effectKind }) => effectKind)
      ).toEqual(kinds)
    }
  })

  it('prepares, executes and plans every SRD Creature attack, and doubles its dice on a critical hit', async () => {
    const runtime = createSrdRulesRuntime()
    const ogre = creatures.find((creature) => creature.label === 'Ogre')
    if (!ogre) throw new Error('The SRD Ogre is missing.')
    const target = srdCreatureActor({ id: TARGET_ID, creature: ogre })
    const failures: Record<string, string> = {}
    /** Every working attack hits the Ogre with the scripted face plus its authored attack bonus. */
    const hits: Record<string, { total: number | undefined; resultPath: string | undefined }> = {}
    const expectedHits: typeof hits = {}
    /** Every working attack's critical hit rolls each of its hit damage dice twice. */
    const criticalDice: Record<string, string[]> = {}
    const expectedCriticalDice: typeof criticalDice = {}
    const effectIds = new Set<string>()

    for (const creature of creatures) {
      const units = attackUnits(creature)
      if (units.length === 0) continue
      for (const unit of units) {
        if (effectIds.has(unit.effectId)) throw new Error(`${unit.label} repeats its Effect id.`)
        effectIds.add(unit.effectId)
      }
      const actor = srdCreatureActor({ id: ACTOR_ID, creature })
      const actors = [actor, target]
      const discovery = discoverEncounterFeatureActions({
        spells: new Map(),
        actor,
        conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
      })
      const state = srdEncounterState({ actors, currentActorId: actor.id })
      const movementTargets = new Map(actors.map((entry) => [entry.id, srdCreatureTarget(entry)]))

      for (const unit of units) {
        const capability = discovery.available.find(
          (entry) =>
            entry.effectId === unit.effectId &&
            entry.ownerFeatureId === unit.owner.id &&
            entry.featureOptionId === (unit.option?.id ?? null)
        )
        if (!capability) {
          const unavailable = discovery.unavailable.find((entry) =>
            entry.actionId.endsWith(`:EFFECT:${unit.effectId}`)
          )
          failures[unit.effectId] = unavailable
            ? failureReason('DISCOVERY', new Error(unavailable.reason))
            : `DISCOVERY: ${unit.label} is not an action.`
          continue
        }
        let stage: 'PREPARE' | 'EXECUTE' | 'PLAN' = 'PREPARE'
        try {
          const prepared = await prepareEncounterActionMechanics({
            state,
            actor,
            target,
            actors,
            actionId: capability.actionId,
            // An attack that offers a pick (damage or grapple) runs the option its attacker picks.
            choiceOptionId: castChoiceOptions(capability.compiledEffect)?.[0]?.optionId,
            wieldConflictAcceptance: { kind: 'PROMPTED', accepted: null, handHolds: 0 },
            overridable: true,
            movementTargets,
            loadSource: async (input) =>
              resolveEncounterActionSource({
                spells: new Map(),
                ...input,
                system: srdSystemRecord
              }),
            loadRelationshipFacts: async () => [],
            loadTurnUses: async () => []
          })
          stage = 'EXECUTE'
          const execution = {
            runtime,
            adapter: prepared.adapter,
            plan: prepared.plan,
            occurrenceId: OCCURRENCE_ID,
            binding: prepared.binding,
            afterTest: async () => undefined
          }
          const executed = await executeNativeActionGraphs({ ...execution, random: scriptedRandom })
          const critical = await executeNativeActionGraphs({ ...execution, random: criticalRandom })
          stage = 'PLAN'
          planNativeEncounterActionMechanics(
            {
              prepared,
              encounterId: prepared.state.id,
              expectedEncounterVersion: prepared.state.version,
              occurrenceId: OCCURRENCE_ID,
              sourceCommandId: COMMAND_ID,
              commandId: COMMAND_ID,
              occurredAt: TIMESTAMP,
              applications: executed.applications
            },
            testUuid(0xe004)
          )
          hits[unit.effectId] = {
            total: executed.d20?.total,
            resultPath: executed.d20?.resultPath
          }
          expectedHits[unit.effectId] = { total: D20_FACE + unit.attackBonus, resultPath: 'ON_HIT' }
          criticalDice[unit.effectId] = outcomeDice(critical).hit.sort()
          expectedCriticalDice[unit.effectId] = printedCriticalDice(unit)
        } catch (error) {
          failures[unit.effectId] = failureReason(stage, error)
        }
      }
    }

    expect(effectIds.size).toBe(549)
    expect(failures).toEqual({})
    expect(hits).toEqual(expectedHits)
    expect(criticalDice).toEqual(expectedCriticalDice)
  }, 600_000)
})
