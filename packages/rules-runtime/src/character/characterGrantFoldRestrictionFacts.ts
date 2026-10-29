import type { CharacterGrantFoldRestriction } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  FacetAuthored,
  FacetConditionAuthored,
  FacetContextAuthored
} from '@artificer-toolkit/shared/authored'

type RestrictionCondition = CharacterGrantFoldRestriction[number]['conditions'][number]
type NormalizeProficiencyTarget = (kind: string, targetId: string) => string

function baseCondition(
  condition: {
    readonly id: string
    readonly constraint: RestrictionCondition['constraint']
    readonly authoringModeKind?: string
  },
  kind: RestrictionCondition['kind']
): RestrictionCondition {
  return {
    conditionId: condition.id,
    constraint: condition.constraint,
    kind,
    mode: condition.authoringModeKind === 'SELECTED' ? 'SELECTED' : 'ALL',
    abilityId: null,
    classIds: [],
    requiredIds: [],
    secondaryRequiredIds: [],
    min: null,
    max: null,
    speedFraction: null,
    proficiencyKind: null,
    minimumRank: null,
    category: null,
    requiredProperties: [],
    sourceState: null,
    requiresDaylight: false
  }
}

function turnMovementCondition(
  condition: Parameters<typeof baseCondition>[0] & {
    readonly maxFeet?: number
    readonly maxSpeedFraction?: number
  }
): RestrictionCondition {
  if (condition.maxFeet === undefined && condition.maxSpeedFraction === undefined)
    return baseCondition(condition, 'UNSUPPORTED')
  return {
    ...baseCondition(condition, 'TURN_MOVEMENT'),
    max: condition.maxFeet ?? null,
    speedFraction: condition.maxSpeedFraction ?? null
  }
}

function holderActiveEffectCondition(
  condition: Parameters<typeof baseCondition>[0] & { readonly effectIds: readonly string[] }
): RestrictionCondition {
  return {
    ...baseCondition(condition, 'HOLDER_ACTIVE_EFFECT'),
    mode: 'SELECTED',
    requiredIds: [...condition.effectIds]
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
    case 'TURN_MOVEMENT':
      return turnMovementCondition(condition)
    case 'HOLDER_ACTIVE_EFFECT':
      return holderActiveEffectCondition(condition)
    case 'ATTACK_ACTION_OTHER_WEAPON':
      return {
        ...baseCondition(condition, 'ATTACK_ACTION_OTHER_WEAPON'),
        requiredProperties:
          condition.authoringModeKind === 'SELECTED' ? [...condition.properties] : []
      }
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
    case 'SAVING_THROW_ABILITY':
    case 'SAVING_THROW_ABILITY_BONUS':
      return baseCondition(condition, 'UNAVAILABLE')
    default: {
      const unhandled: never = condition
      return baseCondition(unhandled, 'UNAVAILABLE')
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
    case 'TURN_MOVEMENT':
      return turnMovementCondition(condition)
    case 'HOLDER_ACTIVE_EFFECT':
      return holderActiveEffectCondition(condition)
    case 'CREATURE_TYPE':
      return {
        ...baseCondition(condition, 'CREATURE_TYPE'),
        requiredIds:
          condition.authoringModeKind === 'SELECTED' ? [...condition.creatureTypeIds] : []
      }
    case 'SOURCE_CREATURE_TYPE':
      return {
        ...baseCondition(condition, 'SOURCE_CREATURE_TYPE'),
        requiredIds:
          condition.authoringModeKind === 'SELECTED' ? [...condition.creatureTypeIds] : []
      }
    case 'SOURCE_TRAIT':
      return {
        ...baseCondition(condition, 'SOURCE_TRAIT'),
        requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.traits] : []
      }
    default:
      return baseCondition(condition, 'UNSUPPORTED')
  }
}

/** The condition that a context's subject is the holder's kind (D152). */
function holderKindCondition(
  context: { readonly id: string },
  kind: 'CHARACTER' | 'CREATURE'
): RestrictionCondition {
  return {
    ...baseCondition({ id: context.id, constraint: 'INCLUDE' }, 'HOLDER_KIND'),
    mode: 'SELECTED',
    requiredIds: [kind]
  }
}

const SOURCE_PREDICATE_CODES: ReadonlySet<string> = new Set([
  'SOURCE_CREATURE_TYPE',
  'SOURCE_TRAIT',
  'WHILE_SOURCE_CARRIED',
  'WHILE_SOURCE_EQUIPPED',
  'WHILE_SOURCE_ATTUNED'
])

/**
 * A context whose conditions only name the source or its state (an item's "while equipped")
 * describes no holder, so any holder qualifies (D152, amended for ATTACK-6.T4a).
 */
function describesOnlySource(conditions: readonly object[]): boolean {
  return (
    conditions.length > 0 &&
    conditions.every(
      (condition) =>
        'predicateCode' in condition &&
        typeof condition.predicateCode === 'string' &&
        SOURCE_PREDICATE_CODES.has(condition.predicateCode)
    )
  )
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
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'ENEMY_NEAR_TARGET')
        return { ...baseCondition(condition, 'ENEMY_NEAR_TARGET'), max: condition.feet }
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'TARGET_HAS_NOT_TAKEN_TURN')
        return baseCondition(condition, 'TARGET_HAS_NOT_TAKEN_TURN')
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'HOLDER_IN_BRIGHT_LIGHT')
        return {
          ...baseCondition(condition, 'HOLDER_IN_BRIGHT_LIGHT'),
          requiresDaylight: condition.requiresDaylight
        }
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'SOLE_WIELDED_WEAPON')
        return baseCondition(condition, 'ITEM_SOLE_WEAPON')
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'ATTACK_ABILITY')
        return { ...baseCondition(condition, 'ITEM_ATTACK_ABILITY'), abilityId: condition.ability }
      if (condition.kind === 'PREDICATE' && condition.predicateCode === 'ATTACK_ACTIVATION')
        return {
          ...baseCondition(condition, 'ITEM_ACTIVATION'),
          requiredIds: [condition.activation]
        }
      return baseCondition(condition, 'UNSUPPORTED')
    })
  ]
}

/**
 * A Subclass context is decided against the holder's class entries: only the stored
 * specialization is foldable, so a context without one fails closed.
 */
function normalizeSubclassContext(
  context: Extract<FacetContextAuthored, { subject: 'SUBCLASS' }>
): RestrictionCondition[] {
  const subclassIds = context.authoringModeKind === 'SELECTED' ? [...context.subclassIds] : []
  const conditions = context.conditions ?? []
  if (conditions.length === 0)
    return [baseCondition({ id: context.id, constraint: 'INCLUDE' }, 'UNSUPPORTED')]
  return conditions.map((condition) =>
    condition.kind === 'PREDICATE' && condition.predicateCode === 'SUBCLASS_SPECIALIZATION'
      ? {
          ...baseCondition(condition, 'SUBCLASS_SPECIALIZATION'),
          requiredIds: subclassIds,
          secondaryRequiredIds:
            condition.authoringModeKind === 'SELECTED' ? [...condition.specializationIds] : []
        }
      : baseCondition(condition, 'UNSUPPORTED')
  )
}

/**
 * Character contexts become fold conditions and Equipment contexts become attacking-item
 * conditions; a Character or Creature context also requires the holder to be of that kind, and a
 * Subclass context reads the stored specialization. Spell and Resource contexts are read by their own consumers (spell-scoped modifiers
 * and charge resets); any other subject cannot be evaluated here and fails closed.
 */
export function normalizeCharacterGrantRestrictions(
  facet: FacetAuthored | FacetAuthored<'CHARACTER'> | undefined,
  normalizeProficiencyTarget: NormalizeProficiencyTarget = (_kind, targetId) => targetId
): CharacterGrantFoldRestriction {
  return (facet?.groups ?? []).map((group) => ({
    conditions: group.contexts.flatMap((context): RestrictionCondition[] => {
      switch (context.subject) {
        case 'CHARACTER': {
          const conditions = context.conditions ?? []
          return [
            ...(describesOnlySource(conditions) ? [] : [holderKindCondition(context, 'CHARACTER')]),
            ...conditions.map((condition) =>
              normalizeCondition(condition, normalizeProficiencyTarget)
            )
          ]
        }
        case 'EQUIPMENT':
          return normalizeItemContext(context)
        case 'CREATURE': {
          const conditions = context.conditions ?? []
          return [
            ...(describesOnlySource(conditions) ? [] : [holderKindCondition(context, 'CREATURE')]),
            ...conditions.map(normalizeCreatureCondition)
          ]
        }
        case 'SUBCLASS':
          return normalizeSubclassContext(context)
        case 'SPELL':
        case 'RESOURCE':
          return []
        default:
          return [baseCondition({ id: context.id, constraint: 'INCLUDE' }, 'UNSUPPORTED')]
      }
    })
  }))
}
