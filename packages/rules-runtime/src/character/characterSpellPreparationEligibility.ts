import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { SPELLCASTING_ATTRIBUTE } from '@artificer-toolkit/shared/core'
import type { ClassAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'

export interface CharacterSpellPreparationEligibility {
  classId: string
  preparedSpellLimit: number
  eligibleSpellIds: string[]
  preparedSpellIds: string[]
}

type PreparationSourceFact =
  CharacterRulePolicyInput['spellPreparationClasses'][number]['sources'][number]

function isPreparationCapable(source: PreparationSourceFact): boolean {
  return (
    source.attributes.includes(SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS) ||
    source.prepareLimit !== null ||
    source.spellLimits.some(
      (limit) => limit.preparedSpellsLimit !== null && limit.preparedSpellsLimit > 0
    )
  )
}

function isLearnedOnlyPreparation(source: PreparationSourceFact): boolean {
  return source.attributes.some(
    (attribute) =>
      attribute === SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT ||
      attribute === SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK
  )
}

function isKnownSpellSource(source: PreparationSourceFact): boolean {
  return isLearnedOnlyPreparation(source)
}

export function collectCharacterSpellPreparationEligibility(input: {
  rulePolicyInput: Pick<CharacterRulePolicyInput, 'spellPreparationClasses'>
  rulePolicyOutput: Pick<CharacterRulePolicyOutput, 'spellPreparation'>
}): CharacterSpellPreparationEligibility[] {
  const classFactsById = new Map(
    input.rulePolicyInput.spellPreparationClasses.map((classFacts) => [
      classFacts.classId,
      classFacts
    ])
  )

  return input.rulePolicyOutput.spellPreparation.sources.flatMap((source) => {
    if (source.preparedSpellLimit === null) return []
    const classFacts = classFactsById.get(source.classId)
    if (!classFacts) return []
    const sourceIds = new Set(source.sourceIds)
    const capableSources = classFacts.sources.filter(
      (candidate) => sourceIds.has(candidate.sourceId) && isPreparationCapable(candidate)
    )
    if (capableSources.length === 0) return []

    const restrictToLearned = capableSources.every(isLearnedOnlyPreparation)
    const availableSpellIds = new Set(source.availableSpellIds)
    const eligibleSpellIds = restrictToLearned
      ? source.learnedSpellIds.filter((spellId) => availableSpellIds.has(spellId))
      : source.availableSpellIds

    return [
      {
        classId: source.classId,
        preparedSpellLimit: source.preparedSpellLimit,
        eligibleSpellIds: [...new Set(eligibleSpellIds)].sort(),
        preparedSpellIds: [...new Set(source.preparedSpellIds)].sort()
      }
    ]
  })
}

export function getCharacterSpellPreparationEligibleIdsByClass(input: {
  rulePolicyInput: Pick<CharacterRulePolicyInput, 'spellPreparationClasses'>
  rulePolicyOutput: Pick<CharacterRulePolicyOutput, 'spellPreparation'>
}): Map<string, ReadonlySet<string>> {
  return new Map(
    collectCharacterSpellPreparationEligibility(input).map((source) => [
      source.classId,
      new Set(source.eligibleSpellIds)
    ])
  )
}

export function getCharacterSpellKnownEligibleIdsByClass(input: {
  rulePolicyInput: Pick<CharacterRulePolicyInput, 'spellPreparationClasses'>
  rulePolicyOutput: Pick<CharacterRulePolicyOutput, 'spellPreparation'>
}): Map<string, ReadonlySet<string>> {
  const outputByClassId = new Map(
    input.rulePolicyOutput.spellPreparation.sources.map((source) => [source.classId, source])
  )
  return new Map(
    input.rulePolicyInput.spellPreparationClasses.flatMap((classFacts) => {
      const output = outputByClassId.get(classFacts.classId)
      if (!output) return []
      const sourceIds = new Set(output.sourceIds)
      if (
        !classFacts.sources.some(
          (source) => sourceIds.has(source.sourceId) && isKnownSpellSource(source)
        )
      ) {
        return []
      }
      return [[classFacts.classId, new Set(output.availableSpellIds)] as const]
    })
  )
}

/** Adapters supply only current, authorized spell summaries. */
export function buildCharacterPreparationOptions(input: {
  characterId: string
  streamVersion: number
  eligibility: readonly CharacterSpellPreparationEligibility[]
  summaries: readonly Pick<SpellAuthored, 'id' | 'label' | 'level'>[]
  committedSpells: readonly Pick<SpellAuthored, 'id' | 'label' | 'level'>[]
  classes: readonly Pick<ClassAuthored, 'id' | 'label'>[]
}): CharacterPreparationOptionsResponseDto {
  const summariesById = new Map(input.summaries.map((spell) => [spell.id, spell]))
  const committedSpellsById = new Map(input.committedSpells.map((spell) => [spell.id, spell]))
  const classLabelsById = new Map(input.classes.map((record) => [record.id, record.label]))
  return {
    characterId: input.characterId,
    streamVersion: input.streamVersion,
    classes: input.eligibility.map((source) => {
      const label = classLabelsById.get(source.classId)
      if (!label) {
        const error = new Error(`Preparation source class "${source.classId}" is unavailable.`)
        error.name = 'CharacterRuleEvaluationError'
        throw error
      }
      return {
        classId: source.classId,
        label,
        preparedSpellLimit: source.preparedSpellLimit,
        options: source.eligibleSpellIds
          .flatMap((spellId) => {
            const summary = summariesById.get(spellId)
            if (!summary) return []
            const committed = committedSpellsById.get(spellId)
            return [
              {
                spellId,
                label: committed?.label ?? summary.label,
                level: committed?.level ?? summary.level,
                prepared: source.preparedSpellIds.includes(spellId),
                committed: committed !== undefined
              }
            ]
          })
          .sort(
            (left, right) =>
              left.level - right.level ||
              left.label.localeCompare(right.label) ||
              left.spellId.localeCompare(right.spellId)
          )
      }
    })
  }
}
