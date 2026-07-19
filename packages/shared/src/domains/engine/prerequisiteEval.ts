import type { EngineCharacterOutput, EngineProficiency } from './contracts/engineState.js'
import type { CharacterAssemblyRegistry } from './registry.js'
import type {
  FacetAuthored,
  FacetConditionAuthored,
  FacetContextAuthored,
  PredicateConditionAuthored
} from '../shared/authored/facet.js'
import type { NodeSubjectCode } from '../shared/core/facet.js'

export interface PrerequisiteFailure {
  description: string
  required: string
  actual: string
}

export interface PrerequisiteResult {
  passed: boolean
  failedRequirements: PrerequisiteFailure[]
}

export interface CharacterEligibilityContext {
  systemId: string
  raceId?: string
  subraceId?: string
  classes: readonly { classId: string; level: number }[]
  abilityScores: Readonly<Record<string, number>>
  featIds: readonly string[]
  spellIds: readonly string[]
  featureIds?: readonly string[]
  optionIds?: readonly string[]
  proficiencies?: readonly EngineProficiency[]
  equipment?: readonly CharacterEligibilityEquipment[]
  sourceState?: {
    carried: boolean
    equipped: boolean
    attuned: boolean
  }
}

export interface CharacterEligibilityEquipment {
  equipmentId: string
  category?: string
  properties?: readonly string[]
  equipped: boolean
  attuned: boolean
}

type CharacterPredicateCondition = PredicateConditionAuthored<'CHARACTER'>

const ABILITY_ALIASES: Record<string, string[]> = {
  STRENGTH: ['STRENGTH', 'STR'],
  DEXTERITY: ['DEXTERITY', 'DEX'],
  CONSTITUTION: ['CONSTITUTION', 'CON'],
  INTELLIGENCE: ['INTELLIGENCE', 'INT'],
  WISDOM: ['WISDOM', 'WIS'],
  CHARISMA: ['CHARISMA', 'CHA']
}

function totalCharacterLevel(context: CharacterEligibilityContext): number {
  return context.classes.reduce((sum, entry) => sum + entry.level, 0)
}

function matchingClassLevels(
  context: CharacterEligibilityContext,
  classIds: readonly string[]
): number[] {
  return context.classes
    .filter((entry) => classIds.includes(entry.classId))
    .map((entry) => entry.level)
}

function currentSpellcastingClassIds(
  context: CharacterEligibilityContext,
  registry: CharacterAssemblyRegistry
): string[] {
  return context.classes
    .map((entry) => entry.classId)
    .filter((classId) => Boolean(registry.classes[classId]?.spellcasting))
}

function effectiveCharacterHeritageIds(
  context: CharacterEligibilityContext,
  registry: CharacterAssemblyRegistry
): string[] {
  const ids = new Set<string>()

  const race = context.raceId ? registry.races[context.raceId] : undefined
  const subrace = context.subraceId ? registry.races[context.subraceId] : undefined

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
  context: CharacterEligibilityContext,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  switch (condition.predicateCode) {
    case 'ABILITY_SCORE': {
      if (condition.authoringModeKind !== 'SELECTED') {
        return {
          passed: false,
          failedRequirements: [
            {
              description: 'Ability Score',
              required: 'specific ability selection',
              actual: 'all abilities'
            }
          ]
        }
      }

      const ability = condition.abilities
      const actual = ability
        ? readAbilityValue(ability, engineOutput?.derivedStats.abilityScores) ||
          readAbilityValue(ability, context.abilityScores)
        : 0
      const matches = supportsRange(actual, condition.min, condition.max)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: ability ? `Ability Score (${ability})` : 'Ability Score',
                required: requiredRangeText(condition.min, condition.max),
                actual: String(actual)
              }
            ]
          }
    }

    case 'HERITAGE': {
      const actual = effectiveCharacterHeritageIds(context, registry)
      const selected = condition.authoringModeKind === 'SELECTED' ? condition.heritageIds : []
      const matches =
        condition.authoringModeKind === 'ALL' ? true : supportsSelected(selected, actual)

      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Heritage',
                required: formatList(selected),
                actual: formatList(actual)
              }
            ]
          }
    }

    case 'CHARACTER_LEVEL': {
      const actual = totalCharacterLevel(context)
      const matches = supportsRange(actual, condition.min, condition.max)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Character Level',
                required: requiredRangeText(condition.min, condition.max),
                actual: String(actual)
              }
            ]
          }
    }

    case 'CLASS_LEVEL': {
      const actual = matchingClassLevels(context, condition.classIds)
      const matches = actual.some((level) => supportsRange(level, condition.min, condition.max))
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: `Class Level (${formatList(condition.classIds)})`,
                required: requiredRangeText(condition.min, condition.max),
                actual: formatList(actual.map(String))
              }
            ]
          }
    }

    case 'FEAT_OBTAINED': {
      const actual = context.featIds
      const matches = supportsSelected(condition.featIds, actual)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Feat Obtained',
                required: formatList(condition.featIds),
                actual: formatList(actual)
              }
            ]
          }
    }

    case 'FEATURE_OBTAINED': {
      const actual = context.featureIds ?? []
      const matches = supportsSelected(condition.featureIds, actual)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Feature Obtained',
                required: formatList(condition.featureIds),
                actual: formatList(actual)
              }
            ]
          }
    }

    case 'OPTION_OBTAINED': {
      const actualFeatures = context.featureIds ?? []
      const actualOptions = context.optionIds ?? []
      const matchesFeature =
        !condition.featureIds?.length || supportsSelected(condition.featureIds, actualFeatures)
      const matchesOption = supportsSelected(condition.optionIds, actualOptions)
      return matchesFeature && matchesOption
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Feature Option Obtained',
                required: formatList(condition.optionIds),
                actual: formatList(actualOptions)
              }
            ]
          }
    }

    case 'SPELL_OBTAINED': {
      const actual = context.spellIds
      const matches = supportsSelected(condition.spellIds, actual)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Spell Obtained',
                required: formatList(condition.spellIds),
                actual: formatList(actual)
              }
            ]
          }
    }

    case 'CAN_CAST_SPELL': {
      const spellcastingClassIds = currentSpellcastingClassIds(context, registry)
      const canCast = spellcastingClassIds.length > 0 || context.spellIds.length > 0
      return canCast
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Can Cast Spell',
                required: 'yes',
                actual: 'no'
              }
            ]
          }
    }

    case 'EQUIPMENT_PROFICIENCY': {
      const ids = condition.authoringModeKind === 'SELECTED' ? condition.equipmentIds : []
      const matches = hasProficiency(context, 'EQUIPMENT', ids, condition.authoringModeKind, {
        minimumScaling: condition.level
      })
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Equipment Proficiency',
                required:
                  condition.authoringModeKind === 'ALL'
                    ? 'any equipment proficiency'
                    : formatList(ids),
                actual: formatProficiencies(context, 'EQUIPMENT')
              }
            ]
          }
    }

    case 'EQUIPMENT_PROPERTY_PROFICIENCY': {
      const properties = condition.authoringModeKind === 'SELECTED' ? condition.properties : []
      const matches = hasProficiency(
        context,
        'EQUIPMENT_PROPERTY',
        properties,
        condition.authoringModeKind,
        { category: condition.category }
      )
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Equipment Property Proficiency',
                required:
                  condition.authoringModeKind === 'ALL'
                    ? 'any equipment property proficiency'
                    : formatList(properties),
                actual: formatProficiencies(context, 'EQUIPMENT_PROPERTY')
              }
            ]
          }
    }

    case 'SAVE_ABILITY_PROFICIENCY': {
      const abilities = condition.authoringModeKind === 'SELECTED' ? [condition.abilities] : []
      const matches = hasProficiency(
        context,
        'SAVE_ABILITY',
        abilities,
        condition.authoringModeKind,
        { minimumScaling: condition.level }
      )
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Saving Throw Proficiency',
                required:
                  condition.authoringModeKind === 'ALL'
                    ? 'any saving throw proficiency'
                    : formatList(abilities),
                actual: formatProficiencies(context, 'SAVE_ABILITY')
              }
            ]
          }
    }

    case 'LANGUAGE_PROFICIENCY': {
      const ids = condition.authoringModeKind === 'SELECTED' ? condition.languageIds : []
      const matches = hasProficiency(context, 'LANGUAGE', ids, condition.authoringModeKind, {
        minimumScaling: condition.level
      })
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Language Proficiency',
                required:
                  condition.authoringModeKind === 'ALL'
                    ? 'any language proficiency'
                    : formatList(ids),
                actual: formatProficiencies(context, 'LANGUAGE')
              }
            ]
          }
    }

    case 'SKILL_PROFICIENCY': {
      const ids = condition.authoringModeKind === 'SELECTED' ? condition.skillIds : []
      const matches = hasProficiency(context, 'SKILL', ids, condition.authoringModeKind, {
        minimumScaling: condition.level
      })
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Skill Proficiency',
                required:
                  condition.authoringModeKind === 'ALL' ? 'any skill proficiency' : formatList(ids),
                actual: formatProficiencies(context, 'SKILL')
              }
            ]
          }
    }

    case 'EQUIPMENT_EQUIPPED': {
      const equipped = (context.equipment ?? []).filter((item) => item.equipped)
      const matches = equipped.some((item) => {
        if (
          condition.authoringModeKind === 'SELECTED' &&
          !condition.equipmentIds.includes(item.equipmentId)
        ) {
          return false
        }
        if (condition.category && item.category !== condition.category) return false
        return (
          !condition.properties?.length ||
          condition.properties.every((property) => item.properties?.includes(property))
        )
      })
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Equipment Equipped',
                required:
                  condition.authoringModeKind === 'SELECTED'
                    ? formatList(condition.equipmentIds)
                    : 'matching equipped item',
                actual: formatList(equipped.map((item) => item.equipmentId))
              }
            ]
          }
    }

    case 'SKILL_SCORE': {
      const skillIds = condition.authoringModeKind === 'SELECTED' ? condition.skillIds : []
      const scores = engineOutput?.derivedStats.skillBonuses ?? {}
      const matches =
        condition.authoringModeKind === 'ALL'
          ? Object.keys(scores).length > 0
          : skillIds.some((skillId) => scores[skillId] !== undefined)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: 'Skill Score',
                required:
                  condition.authoringModeKind === 'ALL' ? 'any skill score' : formatList(skillIds),
                actual: formatList(Object.keys(scores))
              }
            ]
          }
    }

    case 'SAVING_THROW_ABILITY_BONUS': {
      if (condition.authoringModeKind !== 'SELECTED') {
        const available = Object.keys(engineOutput?.derivedStats.savingThrows ?? {})
        return {
          passed: available.length > 0,
          failedRequirements:
            available.length > 0
              ? []
              : [
                  {
                    description: 'Saving Throw Bonus',
                    required: 'any saving throw bonus',
                    actual: 'unavailable'
                  }
                ]
        }
      }
      const actual = engineOutput?.derivedStats.savingThrows[condition.abilities]
      const matches = actual !== undefined && supportsRange(actual, condition.min, condition.max)
      return matches
        ? { passed: true, failedRequirements: [] }
        : {
            passed: false,
            failedRequirements: [
              {
                description: `Saving Throw Bonus (${condition.abilities})`,
                required: requiredRangeText(condition.min, condition.max),
                actual: actual === undefined ? 'unavailable' : String(actual)
              }
            ]
          }
    }

    case 'WHILE_SOURCE_CARRIED':
      return context.sourceState?.carried
        ? { passed: true, failedRequirements: [] }
        : sourceStateFailure('carried')

    case 'WHILE_SOURCE_EQUIPPED':
      return context.sourceState?.equipped
        ? { passed: true, failedRequirements: [] }
        : sourceStateFailure('equipped')

    case 'WHILE_SOURCE_ATTUNED':
      return context.sourceState?.attuned
        ? { passed: true, failedRequirements: [] }
        : sourceStateFailure('attuned')

    default:
      return {
        passed: false,
        failedRequirements: [
          {
            description: `Unsupported prerequisite predicate: ${condition.predicateCode}`,
            required: 'supported predicate',
            actual: 'unsupported'
          }
        ]
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
      failedRequirements:
        result.failedRequirements.length > 0
          ? result.failedRequirements
          : [
              {
                description: 'Excluded prerequisite',
                required: 'must not match',
                actual: 'matched'
              }
            ]
    }
  }

  return { passed: true, failedRequirements: [] }
}

function evaluateCharacterCondition(
  condition: FacetConditionAuthored<'CHARACTER'>,
  context: CharacterEligibilityContext,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  if (condition.kind === 'EXISTS') {
    return {
      passed: false,
      failedRequirements: [
        {
          description: `Unsupported prerequisite condition: ${condition.relationCode}`,
          required: 'supported condition',
          actual: 'unsupported'
        }
      ]
    }
  }

  return applyConstraint(
    evaluateCharacterPredicate(condition, context, registry, engineOutput),
    condition.constraint
  )
}

function evaluateCharacterContext(
  facetContext: FacetContextAuthored<'CHARACTER'>,
  character: CharacterEligibilityContext,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  if (facetContext.subject !== 'CHARACTER') {
    return {
      passed: false,
      failedRequirements: [
        {
          description: `Unsupported prerequisite subject: ${String(facetContext.subject)}`,
          required: 'CHARACTER',
          actual: facetContext.subject
        }
      ]
    }
  }

  const failures = (facetContext.conditions ?? []).flatMap((condition) => {
    const result = evaluateCharacterCondition(condition, character, registry, engineOutput)
    return result.passed ? [] : result.failedRequirements
  })

  return {
    passed: failures.length === 0,
    failedRequirements: failures
  }
}

export function evaluateCharacterFacet<N extends NodeSubjectCode>(
  facet: FacetAuthored<N> | undefined,
  context: CharacterEligibilityContext,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  if (!facet || facet.groups.length === 0) {
    return { passed: true, failedRequirements: [] }
  }

  const groupResults = facet.groups.map((group) => {
    const failures = group.contexts.flatMap((facetContext) => {
      if (facetContext.subject !== 'CHARACTER') return []
      const result = evaluateCharacterContext(
        facetContext as FacetContextAuthored<'CHARACTER'>,
        context,
        registry,
        engineOutput
      )
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

  const bestFailureSet =
    groupResults
      .map((result) => result.failedRequirements)
      .sort((left, right) => left.length - right.length)[0] ?? []

  return {
    passed: false,
    failedRequirements: bestFailureSet
  }
}

export function evaluateFeatPrerequisites(
  prerequisites: FacetAuthored<'CHARACTER'> | undefined,
  context: CharacterEligibilityContext,
  registry: CharacterAssemblyRegistry,
  engineOutput?: EngineCharacterOutput
): PrerequisiteResult {
  return evaluateCharacterFacet(prerequisites, context, registry, engineOutput)
}

function formatProficiencies(context: CharacterEligibilityContext, kind: string): string {
  return formatList(
    (context.proficiencies ?? [])
      .filter((proficiency) => proficiency.kind === kind)
      .map((proficiency) => proficiency.subjectId)
  )
}

function sourceStateFailure(state: 'carried' | 'equipped' | 'attuned'): PrerequisiteResult {
  return {
    passed: false,
    failedRequirements: [
      {
        description: `Source ${state}`,
        required: 'yes',
        actual: 'no'
      }
    ]
  }
}

function hasProficiency(
  context: CharacterEligibilityContext,
  kind: string,
  subjectIds: readonly string[],
  authoringModeKind: 'ALL' | 'SELECTED',
  options: {
    category?: string
    minimumScaling?: EngineProficiency['scaling']
  } = {}
): boolean {
  const proficiencies = context.proficiencies ?? []
  if (authoringModeKind === 'ALL') {
    return proficiencies.some(
      (proficiency) =>
        proficiency.kind === kind &&
        (options.category == null || proficiency.category === options.category) &&
        meetsMinimumProficiencyScaling(proficiency.scaling, options.minimumScaling)
    )
  }

  return subjectIds.some((subjectId) =>
    proficiencies.some(
      (proficiency) =>
        proficiency.kind === kind &&
        (proficiency.subjectId === subjectId || proficiency.subjectId === '*') &&
        (options.category == null || proficiency.category === options.category) &&
        meetsMinimumProficiencyScaling(proficiency.scaling, options.minimumScaling)
    )
  )
}

function meetsMinimumProficiencyScaling(
  actual: EngineProficiency['scaling'],
  minimum: EngineProficiency['scaling'] | undefined
): boolean {
  if (minimum == null) return true

  const rank: Record<EngineProficiency['scaling'], number> = {
    HALF: 0,
    FULL: 1,
    DOUBLE: 2
  }
  return rank[actual] >= rank[minimum]
}
