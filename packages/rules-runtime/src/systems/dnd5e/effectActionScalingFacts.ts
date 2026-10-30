import type { RuleValue } from '@artificer-toolkit/shared/rules'
import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import { parseRollExpression, type ParsedRollExpression } from '@artificer-toolkit/shared/rolls'
import {
  damageAddedDiceDtoSchema,
  type DamageAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import {
  incomingDamageReductionsDtoSchema,
  type IncomingDamageReductionsDto
} from '@artificer-toolkit/schema/grants/modifier'
import type { EnemyProximity } from '../../encounterEnemyProximity.js'
import type { MoveToward } from '../../encounterMoveToward.js'
import type { Dnd5eAttackRollMode } from './attackRestrictions.js'
import {
  DND5E_ATTACK_ENEMY_PROXIMITY_FACT_KEY,
  DND5E_ATTACK_MOVE_TOWARD_FACT_KEY,
  DND5E_ATTACK_TURN_USES_FACT_KEY,
  DND5E_ATTACK_ITEM_BINDINGS_FACT_KEY,
  DND5E_CLASS_LEVELS_FACT_KEY,
  DND5E_CRITICAL_EXTRA_DICE_FACT_KEY,
  DND5E_DAMAGE_ADDED_DICE_FACT_KEY,
  DND5E_INCOMING_DAMAGE_REDUCTIONS_FACT_KEY,
  DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS,
  DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY,
  DND5E_SPELL_CAST_LEVEL_FACT_KEY,
  DND5E_TARGET_CREATURE_TYPE_FACT_KEY,
  DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY,
  DND5E_WEAPON_DAMAGE_DIE_FACT_KEY,
  type SpecializedPath,
  unsupported
} from './effectActionContracts.js'

/**
 * Server-derived facts only, validated once by `dnd5eEffectScalingFacts`. They select an authored
 * scaling row; they never alter graph topology. A level present here is a positive safe integer.
 */
export type Dnd5eEffectScalingFacts = Readonly<{
  characterLevel?: number
  parentClassLevel?: number
  spellCastLevel?: number
  classLevels: Readonly<Record<string, number>>
  selectedOptionalRiderIds: readonly string[]
  attackRollMode: Dnd5eAttackRollMode
  targetCreatureTypeId?: string
  attackEnemyProximity?: EnemyProximity
  attackMoveToward?: MoveToward
  attackTurnUses?: readonly string[]
  attackItemBindingEffectIds?: readonly string[]
  damageAddedDice?: readonly DamageAddedDieDto[]
  incomingDamageReductions?: IncomingDamageReductionsDto
  criticalExtraDice?: number
  /** By how much the completed saving throw fell short of its DC. */
  saveFailedBy?: number
  /** The target's current hit points, which select the hit-point tier of a tiered result. */
  targetCurrentHitPoints?: number
  resolvedDamageExpressions: Readonly<Partial<Record<SpecializedPath, string>>>
  resolvedDamageOutcomeExpressions: Readonly<Record<string, string>>
  weaponDamageDieFaces?: number
}>

/** The compile boundary: the one place locked rule-value facts become typed scaling facts. */
export function dnd5eEffectScalingFacts(input: {
  facts: Readonly<Record<string, RuleValue>>
  testOutputs: Readonly<Record<string, RuleValue>> | undefined
  testRollMode: Dnd5eAttackRollMode
}): Dnd5eEffectScalingFacts {
  const { facts } = input
  const positiveInteger = (value: RuleValue | undefined): number | undefined =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
  const classLevels = parseClassLevels(facts[DND5E_CLASS_LEVELS_FACT_KEY])
  const totalLevel = Object.values(classLevels).reduce((sum, level) => sum + level, 0)
  const dc = facts[DND5E_SAVE_DC_FACT_KEY]
  const total = input.testOutputs?.total
  return {
    // A Character's level is the sum of its class levels; a Creature has none.
    characterLevel: totalLevel > 0 ? totalLevel : undefined,
    parentClassLevel: positiveInteger(facts.parentClassLevel),
    spellCastLevel: positiveInteger(facts[DND5E_SPELL_CAST_LEVEL_FACT_KEY]),
    classLevels,
    selectedOptionalRiderIds: parseSelectedOptionalRiderIds(
      facts[DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY]
    ),
    attackRollMode: input.testRollMode,
    targetCreatureTypeId:
      typeof facts[DND5E_TARGET_CREATURE_TYPE_FACT_KEY] === 'string'
        ? facts[DND5E_TARGET_CREATURE_TYPE_FACT_KEY]
        : undefined,
    attackEnemyProximity: parseEnemyProximity(facts[DND5E_ATTACK_ENEMY_PROXIMITY_FACT_KEY]),
    attackMoveToward: parseMoveToward(facts[DND5E_ATTACK_MOVE_TOWARD_FACT_KEY]),
    attackTurnUses: parseTextList(facts[DND5E_ATTACK_TURN_USES_FACT_KEY], 'turn uses'),
    attackItemBindingEffectIds: parseTextList(
      facts[DND5E_ATTACK_ITEM_BINDINGS_FACT_KEY],
      'attack item bindings'
    ),
    damageAddedDice: parseDamageAddedDice(facts[DND5E_DAMAGE_ADDED_DICE_FACT_KEY]),
    incomingDamageReductions: parseIncomingDamageReductions(
      facts[DND5E_INCOMING_DAMAGE_REDUCTIONS_FACT_KEY]
    ),
    criticalExtraDice: positiveInteger(facts[DND5E_CRITICAL_EXTRA_DICE_FACT_KEY]),
    saveFailedBy: typeof dc === 'number' && typeof total === 'number' ? dc - total : undefined,
    resolvedDamageExpressions: Object.fromEntries(
      Object.entries(DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS).flatMap(([path, key]) => {
        const expression = facts[key]
        return typeof expression === 'string' ? [[path, expression]] : []
      })
    ),
    resolvedDamageOutcomeExpressions: parseResolvedOutcomeExpressions(
      facts[DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY]
    ),
    weaponDamageDieFaces: positiveInteger(facts[DND5E_WEAPON_DAMAGE_DIE_FACT_KEY]),
    targetCurrentHitPoints:
      typeof facts[DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY] === 'number'
        ? facts[DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY]
        : undefined
  }
}

/** The level an authored scaled outcome reads: the character, parent class, cast or named class level. */
export function scalingLevel(
  outcome: Partial<Record<'scalingSource' | 'classId', unknown>>,
  facts: Dnd5eEffectScalingFacts
): number {
  if (outcome.scalingSource === 'CLASS_LEVEL') {
    if (typeof outcome.classId !== 'string')
      unsupported('D&D class dice scaling has no class identity.')
    const level = Object.hasOwn(facts.classLevels, outcome.classId)
      ? facts.classLevels[outcome.classId]
      : undefined
    if (level === undefined) unsupported('D&D class dice scaling facts are unavailable.')
    return level
  }
  const level =
    outcome.scalingSource === 'CHARACTER_LEVEL'
      ? facts.characterLevel
      : outcome.scalingSource === 'PARENT_CLASS_LEVEL'
        ? facts.parentClassLevel
        : outcome.scalingSource === 'SPELL_CAST_LEVEL'
          ? facts.spellCastLevel
          : undefined
  if (level === undefined) unsupported('D&D dice scaling facts are unavailable.')
  return level
}

function parseSelectedOptionalRiderIds(value: RuleValue | undefined): readonly string[] {
  if (value === undefined) return []
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : undefined
  } catch {
    parsed = undefined
  }
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string'))
    unsupported('D&D selected optional riders are malformed.')
  return parsed
}

function parseEnemyProximity(value: RuleValue | undefined): EnemyProximity | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') unsupported('D&D enemy proximity is malformed.')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    unsupported('D&D enemy proximity is malformed.')
  }
  const nearestFeet =
    typeof parsed === 'object' && parsed !== null && 'nearestFeet' in parsed
      ? parsed.nearestFeet
      : undefined
  if (nearestFeet !== null && !(typeof nearestFeet === 'number' && nearestFeet >= 0))
    unsupported('D&D enemy proximity is malformed.')
  return { nearestFeet }
}

function parseMoveToward(value: RuleValue | undefined): MoveToward | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') unsupported('D&D move toward target is malformed.')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    unsupported('D&D move toward target is malformed.')
  }
  const closedFeet =
    typeof parsed === 'object' && parsed !== null && 'closedFeet' in parsed
      ? parsed.closedFeet
      : undefined
  if (!(typeof closedFeet === 'number' && closedFeet >= 0))
    unsupported('D&D move toward target is malformed.')
  return { closedFeet }
}

function parseDamageAddedDice(
  value: RuleValue | undefined
): readonly DamageAddedDieDto[] | undefined {
  if (value === undefined) return undefined
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : undefined
  } catch {
    parsed = undefined
  }
  const dice = damageAddedDiceDtoSchema.safeParse(parsed)
  if (!dice.success) unsupported('D&D added damage dice are malformed.')
  return dice.data
}

function parseIncomingDamageReductions(
  value: RuleValue | undefined
): IncomingDamageReductionsDto | undefined {
  if (value === undefined) return undefined
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : undefined
  } catch {
    parsed = undefined
  }
  const reductions = incomingDamageReductionsDtoSchema.safeParse(parsed)
  if (!reductions.success) unsupported('D&D incoming damage reductions are malformed.')
  return reductions.data
}

function parseTextList(value: RuleValue | undefined, what: string): readonly string[] | undefined {
  if (value === undefined) return undefined
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : undefined
  } catch {
    parsed = undefined
  }
  if (!Array.isArray(parsed) || parsed.some((key) => typeof key !== 'string'))
    unsupported(`D&D ${what} are malformed.`)
  return parsed
}

function parseClassLevels(value: RuleValue | undefined): Record<string, number> {
  if (value === undefined) return {}
  if (typeof value !== 'string') unsupported('D&D class levels are malformed.')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    unsupported('D&D class levels are malformed.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    unsupported('D&D class levels are malformed.')
  }
  const entries = Object.entries(parsed)
  if (
    entries.length > 40 ||
    entries.some(
      ([classId, level]) =>
        classId.length === 0 ||
        classId.length > 240 ||
        typeof level !== 'number' ||
        !Number.isSafeInteger(level) ||
        level < 1
    )
  ) {
    unsupported('D&D class levels are malformed.')
  }
  return Object.fromEntries(entries)
}

function parseResolvedOutcomeExpressions(value: RuleValue | undefined): Record<string, string> {
  if (value === undefined) return {}
  if (typeof value !== 'string') unsupported('D&D resolved outcome expressions are malformed.')
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    unsupported('D&D resolved outcome expressions are malformed.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    unsupported('D&D resolved outcome expressions are malformed.')
  }
  const entries = Object.entries(parsed)
  if (
    entries.length > 1_000 ||
    entries.some(
      ([outcomeId, expression]) =>
        outcomeId.length === 0 || outcomeId.length > 240 || typeof expression !== 'string'
    )
  ) {
    unsupported('D&D resolved outcome expressions are malformed.')
  }
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)))
}

export type BoundedDiceTerm = ParsedRollExpression['terms'][number]

/** The bounded exact-dice contract: one plain term of 1–31 dice of 2–1000 faces, plus a flat modifier. */
export type BoundedDice = Readonly<{ term: BoundedDiceTerm; modifier: number }>

const isBoundedTerm = (term: BoundedDiceTerm) =>
  !term.reroll &&
  !term.selection &&
  term.count >= 1 &&
  term.count <= 31 &&
  term.die >= 2 &&
  term.die <= 1000

export function parseBoundedDiceConfiguration(value: unknown): BoundedDice {
  if (typeof value !== 'string') unsupported('D&D dice configuration is unavailable.')
  let parsed: ParsedRollExpression
  try {
    parsed = parseRollExpression(value)
  } catch {
    unsupported('D&D dice configuration is malformed.')
  }
  const term = parsed.terms[0]
  if (
    parsed.terms.length !== 1 ||
    parsed.transform.kind !== 'NONE' ||
    !term ||
    !isBoundedTerm(term)
  )
    unsupported('D&D dice configuration exceeds the bounded exact-dice contract.')
  return { term, modifier: parsed.modifier }
}

/** The die count of a dice configuration that is one bounded term with no modifier, or null for any other. */
export function boundedSingleDiceCount(value: unknown): number | null {
  try {
    const { term, modifier } = parseBoundedDiceConfiguration(value)
    return modifier === 0 ? term.count : null
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return null
    throw error
  }
}

/**
 * The one exact dice term a graph can roll, doubled for a critical hit plus the extra dice the
 * attack's critical rules add (D158), with the flat modifier it carries.
 */
export function boundedDiceTerm(diceConfig: string, critical?: { extraDice: number }): BoundedDice {
  const { term: authoredTerm, modifier } = parseBoundedDiceConfiguration(diceConfig)
  if (!critical) return { term: authoredTerm, modifier }
  const term = { ...authoredTerm, count: authoredTerm.count * 2 + critical.extraDice }
  if (!isBoundedTerm(term))
    unsupported('D&D dice configuration exceeds the bounded exact-dice contract.')
  return { term, modifier }
}
