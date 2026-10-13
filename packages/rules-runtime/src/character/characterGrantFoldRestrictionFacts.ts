import type { CharacterGrantFoldRestriction } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  FacetAuthored,
  FacetConditionAuthored,
  FacetContextAuthored
} from '@artificer-toolkit/shared/authored'

type RestrictionCondition = CharacterGrantFoldRestriction[number]['conditions'][number]
type NormalizeProficiencyTarget = (kind: string, targetId: string) => string

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function baseCondition(
  condition: { readonly id: string; readonly constraint: RestrictionCondition['constraint'] },
  kind: RestrictionCondition['kind']
): RestrictionCondition {
  const value = condition as unknown as Record<string, unknown>
  return {
    conditionId: condition.id,
    constraint: condition.constraint,
    kind,
    mode: value.authoringModeKind === 'SELECTED' ? 'SELECTED' : 'ALL',
    abilityId: null,
    classIds: [],
    requiredIds: [],
    secondaryRequiredIds: [],
    min: null,
    max: null,
    proficiencyKind: null,
    minimumRank: null,
    category: null,
    requiredProperties: [],
    sourceState: null
  }
}

function normalizeCondition(
  condition: FacetConditionAuthored<'CHARACTER'>,
  normalizeProficiencyTarget: NormalizeProficiencyTarget
): RestrictionCondition {
  if (condition.kind === 'EXISTS') return baseCondition(condition, 'UNSUPPORTED')

  switch (condition.predicateCode) {
    case 'ABILITY_SCORE':
      return condition.authoringModeKind === 'SELECTED'
        ? {
            ...baseCondition(condition, 'ABILITY_SCORE'),
            abilityId: condition.abilities,
            min: condition.min ?? null,
            max: condition.max ?? null
          }
        : baseCondition(condition, 'UNAVAILABLE')
    case 'HERITAGE':
      return {
        ...baseCondition(condition, 'HERITAGE'),
        requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.heritageIds] : []
      }
    case 'CHARACTER_LEVEL':
      return {
        ...baseCondition(condition, 'CHARACTER_LEVEL'),
        min: condition.min ?? null,
        max: condition.max ?? null
      }
    case 'CLASS_LEVEL':
      return {
        ...baseCondition(condition, 'CLASS_LEVEL'),
        classIds: [...condition.classIds],
        min: condition.min ?? null,
        max: condition.max ?? null
      }
    case 'FEAT_OBTAINED':
      return {
        ...baseCondition(condition, 'FEAT_OBTAINED'),
        mode: 'SELECTED',
        requiredIds: [...condition.featIds]
      }
    case 'FEATURE_OBTAINED':
      return {
        ...baseCondition(condition, 'FEATURE_OBTAINED'),
        mode: 'SELECTED',
        requiredIds: [...condition.featureIds]
      }
    case 'OPTION_OBTAINED':
      return {
        ...baseCondition(condition, 'OPTION_OBTAINED'),
        mode: 'SELECTED',
        requiredIds: [...(condition.featureIds ?? [])],
        secondaryRequiredIds: [...condition.optionIds]
      }
    case 'SPELL_OBTAINED':
      return {
        ...baseCondition(condition, 'SPELL_OBTAINED'),
        mode: 'SELECTED',
        requiredIds: [...condition.spellIds]
      }
    case 'CAN_CAST_SPELL':
      return baseCondition(condition, 'CAN_CAST_SPELL')
    case 'CAN_ACT':
      return baseCondition(condition, 'CAN_ACT')
    case 'SPEED_ABOVE_ZERO':
      return baseCondition(condition, 'SPEED_ABOVE_ZERO')
    case 'FREE_HAND':
      return baseCondition(condition, 'FREE_HAND')
    case 'EQUIPMENT_PROFICIENCY':
      return {
        ...baseCondition(condition, 'PROFICIENCY'),
        proficiencyKind: 'EQUIPMENT',
        requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.equipmentIds] : [],
        category: condition.category ?? null,
        minimumRank: condition.level ?? null
      }
    case 'EQUIPMENT_PROPERTY_PROFICIENCY':
      return {
        ...baseCondition(condition, 'PROFICIENCY'),
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.properties] : [],
        category: condition.category ?? null
      }
    case 'SAVE_ABILITY_PROFICIENCY':
      return {
        ...baseCondition(condition, 'PROFICIENCY'),
        proficiencyKind: 'SAVE_ABILITY',
        requiredIds:
          condition.authoringModeKind === 'SELECTED'
            ? [normalizeProficiencyTarget('SAVE_ABILITY', condition.abilities)]
            : [],
        minimumRank: condition.level ?? null
      }
    case 'LANGUAGE_PROFICIENCY':
      return {
        ...baseCondition(condition, 'PROFICIENCY'),
        proficiencyKind: 'LANGUAGE',
        requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.languageIds] : [],
        minimumRank: condition.level ?? null
      }
    case 'SKILL_PROFICIENCY':
      return {
        ...baseCondition(condition, 'PROFICIENCY'),
        proficiencyKind: 'SKILL',
        requiredIds:
          condition.authoringModeKind === 'SELECTED'
            ? condition.skillIds.map((skillId) => normalizeProficiencyTarget('SKILL', skillId))
            : [],
        minimumRank: condition.level ?? null
      }
    case 'EQUIPMENT_EQUIPPED':
      return {
        ...baseCondition(condition, 'EQUIPMENT_EQUIPPED'),
        requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.equipmentIds] : [],
        category: condition.category ?? null,
        requiredProperties: [...(condition.properties ?? [])]
      }
    case 'WHILE_SOURCE_CARRIED':
      return { ...baseCondition(condition, 'SOURCE_STATE'), sourceState: 'CARRIED' }
    case 'WHILE_SOURCE_EQUIPPED':
      return { ...baseCondition(condition, 'SOURCE_STATE'), sourceState: 'EQUIPPED' }
    case 'WHILE_SOURCE_ATTUNED':
      return { ...baseCondition(condition, 'SOURCE_STATE'), sourceState: 'ATTUNED' }
    case 'SIZE':
      return {
        ...baseCondition(condition, 'SIZE'),
        requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.sizes] : []
      }
    case 'SKILL_SCORE':
    case 'SAVING_THROW_ABILITY_BONUS':
      return baseCondition(condition, 'UNAVAILABLE')
    default: {
      const value = condition as unknown as Record<string, unknown>
      return {
        ...baseCondition(condition, 'UNAVAILABLE'),
        requiredIds: strings(value.requiredIds),
        min: numberOrNull(value.min),
        max: numberOrNull(value.max)
      }
    }
  }
}

/** A Creature context is read live in an Encounter: only the holder-state predicates are decidable. */
function normalizeCreatureCondition(
  condition: FacetConditionAuthored<'CREATURE'>
): RestrictionCondition {
  switch (condition.predicateCode) {
    case 'CAN_ACT':
    case 'SPEED_ABOVE_ZERO':
    case 'FREE_HAND':
      return baseCondition(condition, condition.predicateCode)
    default:
      return baseCondition(condition, 'UNSUPPORTED')
  }
}

/** An Equipment context names the attacking item; its conditions are evaluated against that item. */
function normalizeItemContext(
  context: Extract<FacetContextAuthored, { subject: 'EQUIPMENT' }>
): RestrictionCondition[] {
  const identity: RestrictionCondition[] =
    context.authoringModeKind === 'SELECTED'
      ? [
          {
            ...baseCondition({ id: context.id, constraint: 'INCLUDE' }, 'ITEM_IDENTITY'),
            mode: 'SELECTED',
            requiredIds: [...context.equipmentIds]
          }
        ]
      : []
  return [
    ...identity,
    ...(context.conditions ?? []).map((condition): RestrictionCondition => {
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'EQUIPMENT_CATEGORY')
        return { ...baseCondition(condition, 'ITEM_CATEGORY'), category: condition.category }
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'EQUIPMENT_PROPERTY')
        return {
          ...baseCondition(condition, 'ITEM_PROPERTY'),
          category: condition.category ?? null,
          requiredProperties:
            condition.authoringModeKind === 'SELECTED' ? [...condition.properties] : []
        }
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'SOLE_WIELDED_WEAPON')
        return baseCondition(condition, 'ITEM_SOLE_WEAPON')
      return baseCondition(condition, 'UNSUPPORTED')
    })
  ]
}

/**
 * Character contexts become fold conditions and Equipment contexts become attacking-item
 * conditions. Spell and Resource contexts are read by their own consumers (spell-scoped modifiers
 * and charge resets); any other subject cannot be evaluated here and fails closed.
 */
export function normalizeCharacterGrantRestrictions(
  facet: FacetAuthored | FacetAuthored<'CHARACTER'> | undefined,
  normalizeProficiencyTarget: NormalizeProficiencyTarget = (_kind, targetId) => targetId
): CharacterGrantFoldRestriction {
  return (facet?.groups ?? []).map((group) => ({
    conditions: group.contexts.flatMap((context): RestrictionCondition[] => {
      switch (context.subject) {
        case 'CHARACTER':
          return (context.conditions ?? []).map((condition) =>
            normalizeCondition(
              condition as FacetConditionAuthored<'CHARACTER'>,
              normalizeProficiencyTarget
            )
          )
        case 'EQUIPMENT':
          return normalizeItemContext(context)
        case 'CREATURE':
          return (context.conditions ?? []).map(normalizeCreatureCondition)
        case 'SPELL':
        case 'RESOURCE':
          return []
        default:
          return [baseCondition({ id: context.id, constraint: 'INCLUDE' }, 'UNSUPPORTED')]
      }
    })
  }))
}
