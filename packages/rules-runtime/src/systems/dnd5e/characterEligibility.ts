import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

export type CharacterResolvedProficiency = Omit<
  CharacterGrantFoldOutput['proficiencies'][number],
  'grantId'
> & { grantId?: string }

export function evaluateDnd5eCharacterEligibility(
  input: CharacterRulePolicyInput,
  fold: CharacterGrantFoldOutput,
  derived: Omit<CharacterRulePolicyOutput['derivedStats'], 'armorClass' | 'maxHitPoints'>,
  proficiencies: CharacterResolvedProficiency[],
  spellAccess: CharacterRulePolicyOutput['spellAccess']
): CharacterRulePolicyOutput['eligibilityFacets'] {
  return input.eligibilityFacets.map((facet) => {
    const passes = (condition: (typeof facet.groups)[number]['conditions'][number]): boolean => {
      if (condition.kind === 'UNSUPPORTED') return condition.constraint === 'EXCLUDE'
      const inRange = (value: number) =>
        (condition.min === null || value >= condition.min) &&
        (condition.max === null || value <= condition.max)
      const abilityMatches = (ability: string) => ability === condition.abilityId
      const selected = (values: string[], requiredIds = condition.requiredIds) =>
        condition.authoringMode === 'ALL'
          ? values.length > 0
          : requiredIds.length === 0 || requiredIds.some((id) => values.includes(id))
      const hasProficiency = (kind: string) =>
        proficiencies.some(
          (proficiency) =>
            proficiency.kind === kind &&
            (condition.category === null || proficiency.category === condition.category) &&
            (condition.minimumRank === null ||
              proficiency.scaling === 'DOUBLE' ||
              proficiency.scaling === condition.minimumRank ||
              (proficiency.scaling === 'FULL' && condition.minimumRank === 'HALF')) &&
            (condition.authoringMode === 'ALL' ||
              proficiency.matchId === '*' ||
              condition.requiredIds.some(
                (id) => id === proficiency.matchId || id === proficiency.subjectId
              ))
        )
      const base = input.grantFoldFacts.base
      const matches = (): boolean => {
        switch (condition.predicateCode) {
          case 'ABILITY_SCORE':
            return derived.abilities.some(
              (ability) => abilityMatches(ability.abilityId) && inRange(ability.score.effective)
            )
          case 'HERITAGE':
            return condition.authoringMode === 'ALL' || selected(base.heritageIds)
          case 'CHARACTER_LEVEL':
            return inRange(input.totalLevel)
          case 'CLASS_LEVEL':
            return base.classes.some(
              (entry) => condition.requiredIds.includes(entry.classId) && inRange(entry.level)
            )
          case 'FEAT_OBTAINED':
            return selected([...base.featIds, ...fold.unlockedFeatIds])
          case 'FEATURE_OBTAINED':
            return selected(base.featureIds)
          case 'OPTION_OBTAINED':
            return (
              selected(base.featureIds) && selected(base.optionIds, condition.secondaryRequiredIds)
            )
          case 'SPELL_OBTAINED':
            return selected([
              ...spellAccess.map((entry) => entry.spellId),
              ...fold.unlockedSpellIds
            ])
          case 'CAN_CAST_SPELL':
            return spellAccess.length > 0 || base.classes.some((entry) => entry.spellcasting)
          case 'EQUIPMENT_PROFICIENCY':
            return hasProficiency('EQUIPMENT')
          case 'EQUIPMENT_PROPERTY_PROFICIENCY':
            return hasProficiency('EQUIPMENT_PROPERTY')
          case 'SAVE_ABILITY_PROFICIENCY':
            return hasProficiency('SAVE_ABILITY')
          case 'LANGUAGE_PROFICIENCY':
            return hasProficiency('LANGUAGE')
          case 'SKILL_PROFICIENCY':
            return hasProficiency('SKILL')
          case 'EQUIPMENT_EQUIPPED':
            return base.equipment.some(
              (equipment) =>
                equipment.equipped &&
                (condition.category === null || equipment.category === condition.category) &&
                (condition.authoringMode === 'ALL' ||
                  condition.requiredIds.includes(equipment.equipmentId)) &&
                condition.requiredProperties.every((property) =>
                  equipment.properties.includes(property)
                )
            )
          case 'SKILL_SCORE':
            return selected(derived.skills.map((skill) => skill.skillId))
          case 'SAVING_THROW_ABILITY_BONUS':
            return condition.authoringMode === 'ALL'
              ? derived.savingThrows.length > 0
              : derived.savingThrows.some(
                  (save) => abilityMatches(save.abilityId) && inRange(save.total.effective)
                )
          case 'WHILE_SOURCE_CARRIED':
            return facet.sourceState.carried
          case 'WHILE_SOURCE_EQUIPPED':
            return facet.sourceState.equipped
          case 'WHILE_SOURCE_ATTUNED':
            return facet.sourceState.attuned
        }
      }
      return matches() === (condition.constraint === 'INCLUDE')
    }
    const failures = facet.groups.map((group) =>
      group.conditions.filter((condition) => !passes(condition))
    )
    const best =
      failures.reduce<(typeof failures)[number] | undefined>(
        (current, candidate) =>
          current === undefined || candidate.length < current.length ? candidate : current,
        undefined
      ) ?? []
    return {
      evaluationId: facet.evaluationId,
      passed: best.length === 0,
      failures: best.map((condition) => ({
        conditionId: condition.conditionId,
        reasonCode:
          condition.kind === 'UNSUPPORTED'
            ? 'UNSUPPORTED_CONDITION'
            : condition.constraint === 'EXCLUDE'
              ? 'EXCLUDED_CONDITION_MATCHED'
              : 'REQUIRED_CONDITION_FAILED'
      }))
    }
  })
}
