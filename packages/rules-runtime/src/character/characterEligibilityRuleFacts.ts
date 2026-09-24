import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { FacetAuthored, FacetConditionAuthored } from '@artificer-toolkit/shared/authored'

type EligibilityFacet = CharacterRulePolicyInput['eligibilityFacets'][number]
type EligibilityCondition = EligibilityFacet['groups'][number]['conditions'][number]

type SourceState = EligibilityFacet['sourceState']

const unsupported = (
  condition: FacetConditionAuthored<'CHARACTER'>,
  constraint: 'INCLUDE' | 'EXCLUDE' = condition.constraint
): EligibilityCondition => ({
  conditionId: condition.id,
  constraint,
  kind: 'UNSUPPORTED'
})

function predicate(
  condition: FacetConditionAuthored<'CHARACTER'>,
  predicateCode: Extract<EligibilityCondition, { kind: 'PREDICATE' }>['predicateCode'],
  values: Partial<
    Omit<
      Extract<EligibilityCondition, { kind: 'PREDICATE' }>,
      'conditionId' | 'constraint' | 'kind' | 'predicateCode'
    >
  > = {}
): EligibilityCondition {
  return {
    conditionId: condition.id,
    constraint: condition.constraint,
    kind: 'PREDICATE',
    predicateCode,
    authoringMode:
      'authoringModeKind' in condition && condition.authoringModeKind === 'SELECTED'
        ? 'SELECTED'
        : 'ALL',
    abilityId: null,
    min: null,
    max: null,
    requiredIds: [],
    secondaryRequiredIds: [],
    category: null,
    requiredProperties: [],
    minimumRank: null,
    ...values
  }
}

function conditionFacts(condition: FacetConditionAuthored<'CHARACTER'>): EligibilityCondition[] {
  if (condition.kind === 'EXISTS') return [unsupported(condition, 'INCLUDE')]

  switch (condition.predicateCode) {
    case 'ABILITY_SCORE':
      return condition.authoringModeKind === 'SELECTED'
        ? [
            predicate(condition, 'ABILITY_SCORE', {
              abilityId: condition.abilities,
              min: condition.min ?? null,
              max: condition.max ?? null
            })
          ]
        : [unsupported(condition)]
    case 'HERITAGE':
      return [
        predicate(condition, 'HERITAGE', {
          requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.heritageIds] : []
        })
      ]
    case 'CHARACTER_LEVEL':
      return [
        predicate(condition, 'CHARACTER_LEVEL', {
          min: condition.min ?? null,
          max: condition.max ?? null
        })
      ]
    case 'CLASS_LEVEL':
      return [
        predicate(condition, 'CLASS_LEVEL', {
          requiredIds: [...condition.classIds],
          min: condition.min ?? null,
          max: condition.max ?? null
        })
      ]
    case 'FEAT_OBTAINED':
      return [
        predicate(condition, 'FEAT_OBTAINED', {
          authoringMode: 'SELECTED',
          requiredIds: [...condition.featIds]
        })
      ]
    case 'FEATURE_OBTAINED':
      return [
        predicate(condition, 'FEATURE_OBTAINED', {
          authoringMode: 'SELECTED',
          requiredIds: [...condition.featureIds]
        })
      ]
    case 'OPTION_OBTAINED':
      return [
        predicate(condition, 'OPTION_OBTAINED', {
          authoringMode: 'SELECTED',
          requiredIds: [...(condition.featureIds ?? [])],
          secondaryRequiredIds: [...condition.optionIds]
        })
      ]
    case 'SPELL_OBTAINED':
      return [
        predicate(condition, 'SPELL_OBTAINED', {
          authoringMode: 'SELECTED',
          requiredIds: [...condition.spellIds]
        })
      ]
    case 'CAN_CAST_SPELL':
      return [predicate(condition, 'CAN_CAST_SPELL')]
    case 'EQUIPMENT_PROFICIENCY':
      return [
        predicate(condition, 'EQUIPMENT_PROFICIENCY', {
          requiredIds:
            condition.authoringModeKind === 'SELECTED' ? [...condition.equipmentIds] : [],
          category: condition.category ?? null,
          minimumRank: condition.level ?? null
        })
      ]
    case 'EQUIPMENT_PROPERTY_PROFICIENCY':
      return [
        predicate(condition, 'EQUIPMENT_PROPERTY_PROFICIENCY', {
          requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.properties] : [],
          category: condition.category ?? null
        })
      ]
    case 'SAVE_ABILITY_PROFICIENCY':
      return [
        predicate(condition, 'SAVE_ABILITY_PROFICIENCY', {
          abilityId: condition.authoringModeKind === 'SELECTED' ? condition.abilities : null,
          requiredIds: condition.authoringModeKind === 'SELECTED' ? [condition.abilities] : [],
          minimumRank: condition.level ?? null
        })
      ]
    case 'LANGUAGE_PROFICIENCY':
      return [
        predicate(condition, 'LANGUAGE_PROFICIENCY', {
          requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.languageIds] : [],
          minimumRank: condition.level ?? null
        })
      ]
    case 'SKILL_PROFICIENCY':
      return [
        predicate(condition, 'SKILL_PROFICIENCY', {
          requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.skillIds] : [],
          minimumRank: condition.level ?? null
        })
      ]
    case 'EQUIPMENT_EQUIPPED':
      return [
        predicate(condition, 'EQUIPMENT_EQUIPPED', {
          requiredIds:
            condition.authoringModeKind === 'SELECTED' ? [...condition.equipmentIds] : [],
          category: condition.category ?? null,
          requiredProperties: [...(condition.properties ?? [])]
        })
      ]
    case 'SKILL_SCORE':
      return [
        predicate(condition, 'SKILL_SCORE', {
          requiredIds: condition.authoringModeKind === 'SELECTED' ? [...condition.skillIds] : []
        })
      ]
    case 'SAVING_THROW_ABILITY_BONUS':
      return [
        predicate(condition, 'SAVING_THROW_ABILITY_BONUS', {
          abilityId: condition.authoringModeKind === 'SELECTED' ? condition.abilities : null,
          requiredIds: condition.authoringModeKind === 'SELECTED' ? [condition.abilities] : [],
          min: condition.min ?? null,
          max: condition.max ?? null
        })
      ]
    case 'WHILE_SOURCE_CARRIED':
    case 'WHILE_SOURCE_EQUIPPED':
    case 'WHILE_SOURCE_ATTUNED':
      return [predicate(condition, condition.predicateCode)]
    default:
      return [unsupported(condition)]
  }
}

export function compileCharacterEligibilityRuleFacts(params: {
  evaluationId: string
  facet: FacetAuthored | FacetAuthored<'CHARACTER'> | undefined
  sourceState?: SourceState
}): EligibilityFacet {
  return {
    evaluationId: params.evaluationId,
    sourceState: params.sourceState ?? { carried: false, equipped: false, attuned: false },
    groups: (params.facet?.groups ?? []).map((group) => ({
      groupId: group.id,
      conditions: group.contexts.flatMap((facetContext) =>
        facetContext.subject === 'CHARACTER'
          ? (facetContext.conditions ?? []).flatMap(conditionFacts)
          : []
      )
    }))
  }
}
