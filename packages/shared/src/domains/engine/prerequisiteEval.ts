import type { CharacterBuildState } from '../character/buildState.js'
import type { EngineCharacterOutput } from './contracts/engineState.js'
import type { CharacterAssemblyRegistry } from './registry.js'
import type {
  FacetAuthored,
  FacetConditionAuthored,
  FacetContextAuthored,
  PredicateConditionAuthored
} from '../shared/authored/facet.js'

export interface PrerequisiteFailure {
  description: string
  required: string
  actual: string
}

export interface PrerequisiteResult {
  passed: boolean
  failedRequirements: PrerequisiteFailure[]
}

type CharacterPredicateCondition = PredicateConditionAuthored<'CHARACTER'>

const ABILITY_ALIASES: Record<string, string[]> = {
  STRENGTH: ['STRENGTH', 'STR'],
  DEXTERITY: ['DEXTERITY', 'DEX'],
  CONSTITUTION: ['CONSTITUTION', 'CON'],
  INTELLIGENCE: ['INTELLIGENCE', 'INT'],
  WISDOM: ['WISDOM', 'WIS'],
  CHARISMA: ['CHARISMA', 'CHA'],
  SPELLCASTING: ['SPELLCASTING']
}

function totalCharacterLevel(buildState: CharacterBuildState): number {
  return buildState.classes.reduce((sum, entry) => sum + entry.level, 0)
}

function totalClassLevel(buildState: CharacterBuildState): number {
  return buildState.classes.reduce((sum, entry) => sum + entry.level, 0)
}

function currentSpellcastingClassIds(
  buildState: CharacterBuildState,
  registry: CharacterAssemblyRegistry
): string[] {
  return buildState.classes
    .map((entry) => entry.classRef.contentId)
    .filter((classId) => Boolean(registry.classes[classId]?.spellcasting))
}

function effectiveCharacterHeritageIds(
  buildState: CharacterBuildState,
  registry: CharacterAssemblyRegistry
): string[] {
  const ids = new Set<string>()

  const race = buildState.raceRef
    ? registry.races[buildState.raceRef.contentId]
    : undefined
  const subrace = buildState.subraceRef
    ? registry.races[buildState.subraceRef.contentId]
    : undefined

  for (const heritageId of race?.heritageIds ?? []) ids.add(heritageId)
  for (const heritageId of subrace?.heritageIds ?? []) ids.add(heritageId)

  return [...ids]
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : 'none'
}

function supportsSelected(values: readonly string[], actual: readonly string[]): boolean {
  return values.length === 0 || values.some((value) => actual.includes(value))
}

function supportsRange(actual: number, min?: number, max?: number): boolean {
  if (min !== undefined && actual < min) return false
  if (max !== undefined && actual > max) return false
  return true
}

function readAbilityValue(
  ability: string | undefined,
  values: Record<string, number> | undefined
): number {
  if (!ability || !values) return 0

  const keys = ABILITY_ALIASES[ability] ?? [ability]
  for (const key of keys) {
    const value = values[key]
    if (value !== undefined) return value
  }

  return 0
}

function requiredRangeText(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${min}-${max}`
  if (min !== undefined) return `>= ${min}`
  if (max !== undefined) return `<= ${max}`
  return 'any'
}

function evaluateCharacterPredicate(
  condition: CharacterPredicateCondition,
  buildState: CharacterBuildState,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  switch (condition.predicateCode) {
    case 'ABILITY_SCORE': {
      if (condition.authoringModeKind !== 'SELECTED') {
        return {
          passed: false,
          failedRequirements: [{
            description: 'Ability Score',
            required: 'specific ability selection',
            actual: 'all abilities'
          }]
        }
      }

      const ability = condition.abilities
      const actual = ability
        ? readAbilityValue(ability, engineOutput?.derivedStats.abilityScores)
          || readAbilityValue(ability, buildState.abilityScores)
        : 0
      const matches = supportsRange(actual, condition.min, condition.max)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [{
              description: ability
                ? `Ability Score (${ability})`
                : 'Ability Score',
              required: requiredRangeText(condition.min, condition.max),
              actual: String(actual)
            }]
          }
    }

    case 'HERITAGE': {
      const actual = effectiveCharacterHeritageIds(buildState, registry)
      const selected = condition.authoringModeKind === 'SELECTED'
        ? condition.heritageIds
        : []
      const matches = condition.authoringModeKind === 'ALL'
        ? true
        : supportsSelected(selected, actual)

      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [{
              description: 'Heritage',
              required: formatList(selected),
              actual: formatList(actual)
            }]
          }
    }

    case 'CHARACTER_LEVEL': {
      const actual = totalCharacterLevel(buildState)
      const matches = supportsRange(actual, condition.min, condition.max)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [{
              description: 'Character Level',
              required: requiredRangeText(condition.min, condition.max),
              actual: String(actual)
            }]
          }
    }

    case 'CLASS_LEVEL': {
      const actual = totalClassLevel(buildState)
      const matches = supportsRange(actual, condition.min, condition.max)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [{
              description: 'Class Level',
              required: requiredRangeText(condition.min, condition.max),
              actual: String(actual)
            }]
          }
    }

    case 'FEAT_OBTAINED': {
      const actual = buildState.featRefs.map((featRef) => featRef.contentId)
      const matches = supportsSelected(condition.featIds, actual)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [{
              description: 'Feat Obtained',
              required: formatList(condition.featIds),
              actual: formatList(actual)
            }]
          }
    }

    case 'SPELL_OBTAINED': {
      const actual = buildState.spellRefs.map((spellRef) => spellRef.contentId)
      const matches = supportsSelected(condition.spellIds, actual)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [{
              description: 'Spell Obtained',
              required: formatList(condition.spellIds),
              actual: formatList(actual)
            }]
          }
    }

    case 'CAN_CAST_SPELL': {
      const spellcastingClassIds = currentSpellcastingClassIds(buildState, registry)
      const canCast = spellcastingClassIds.length > 0 || buildState.spellRefs.length > 0
      return canCast
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [{
              description: 'Can Cast Spell',
              required: 'yes',
              actual: 'no'
            }]
          }
    }

    default:
      return {
        passed: false,
        failedRequirements: [{
          description: `Unsupported prerequisite predicate: ${condition.predicateCode}`,
          required: 'supported predicate',
          actual: 'unsupported'
        }]
      }
  }
}

function applyConstraint(
  result: PrerequisiteResult,
  constraint: 'INCLUDE' | 'EXCLUDE'
): PrerequisiteResult {
  if (constraint === 'INCLUDE') return result
  if (result.passed) {
    return {
      passed: false,
      failedRequirements: result.failedRequirements.length > 0
        ? result.failedRequirements
        : [{
            description: 'Excluded prerequisite',
            required: 'must not match',
            actual: 'matched'
          }]
    }
  }

  return { passed: true, failedRequirements: [] }
}

function evaluateCharacterCondition(
  condition: FacetConditionAuthored<'CHARACTER'>,
  buildState: CharacterBuildState,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  if (condition.kind === 'EXISTS') {
    return {
      passed: false,
      failedRequirements: [{
        description: `Unsupported prerequisite condition: ${condition.relationCode}`,
        required: 'supported condition',
        actual: 'unsupported'
      }]
    }
  }

  return applyConstraint(
    evaluateCharacterPredicate(condition, buildState, registry, engineOutput),
    condition.constraint
  )
}

function evaluateCharacterContext(
  context: FacetContextAuthored<'CHARACTER'>,
  buildState: CharacterBuildState,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  if (context.subject !== 'CHARACTER') {
    return {
      passed: false,
      failedRequirements: [{
        description: `Unsupported prerequisite subject: ${context.subject}`,
        required: 'CHARACTER',
        actual: context.subject
      }]
    }
  }

  const failures = (context.conditions ?? []).flatMap((condition) => {
    const result = evaluateCharacterCondition(condition, buildState, registry, engineOutput)
    return result.passed ? [] : result.failedRequirements
  })

  return {
    passed: failures.length === 0,
    failedRequirements: failures
  }
}

export function evaluateFeatPrerequisites(
  prerequisites: FacetAuthored<'CHARACTER'> | undefined,
  buildState: CharacterBuildState,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  if (!prerequisites || prerequisites.groups.length === 0) {
    return { passed: true, failedRequirements: [] }
  }

  const groupResults = prerequisites.groups.map((group) => {
    const failures = group.contexts.flatMap((context) => {
      const result = evaluateCharacterContext(context, buildState, registry, engineOutput)
      return result.passed ? [] : result.failedRequirements
    })

    return {
      passed: failures.length === 0,
      failedRequirements: failures
    }
  })

  const passingGroup = groupResults.find((result) => result.passed)
  if (passingGroup) {
    return { passed: true, failedRequirements: [] }
  }

  const bestFailureSet = groupResults
    .map((result) => result.failedRequirements)
    .sort((left, right) => left.length - right.length)[0] ?? []

  return {
    passed: false,
    failedRequirements: bestFailureSet
  }
}

export function evaluateOngoingRestriction(
  _restriction: unknown,
  _buildState: CharacterBuildState,
  _engineOutput: EngineCharacterOutput
): null {
  return null
}
