import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderBackgroundReferenceDto,
  CharacterBuilderClassReferenceDto,
  CharacterBuilderRaceReferenceDto
} from '@artificer-toolkit/schema/api/characters'
import { evaluateMulticlassRequirements } from '@artificer-toolkit/shared/character'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { compareCharacterBuilderLabels } from './optionProjection'
import type {
  CharacterSelectionCardGroup,
  CharacterSelectionCardOption
} from './CharacterSelectionModal.types'

export function buildRaceSelectionGroups(
  references: CharacterBuilderRaceReferenceDto[],
  choices: CharacterBuilderChoiceOptionDto[]
): CharacterSelectionCardGroup[] {
  const choicesById = new Map(choices.map((choice) => [choice.id, choice]))
  const baseRaces = references.filter((race) => race.category !== 'SUBRACE')
  const directOptions: CharacterSelectionCardOption[] = []
  const groupedOptions: CharacterSelectionCardGroup[] = []

  for (const baseRace of baseRaces) {
    const subraces = references.filter((race) => race.parentRaceId === baseRace.id)
    const requiresSubrace = baseRace.selectionMode === 'REQUIRES_SUBRACE'

    if (requiresSubrace) {
      groupedOptions.push({
        id: baseRace.id,
        label: `${baseRace.label} subraces`,
        options: subraces
          .map((race) => toRaceCard(race, choicesById.get(race.id)))
          .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
      })
      continue
    }

    directOptions.push(toRaceCard(baseRace, choicesById.get(baseRace.id)))
  }

  return [
    ...(directOptions.length > 0
      ? [
          {
            id: 'direct-races',
            label: 'Races',
            options: directOptions.sort((left, right) =>
              compareCharacterBuilderLabels(left.label, right.label)
            )
          }
        ]
      : []),
    ...groupedOptions.sort((left, right) =>
      compareCharacterBuilderLabels(left.label ?? '', right.label ?? '')
    )
  ]
}

export function buildClassSelectionGroups(
  references: CharacterBuilderClassReferenceDto[],
  choices: CharacterBuilderChoiceOptionDto[]
): CharacterSelectionCardGroup[] {
  const choicesById = new Map(choices.map((choice) => [choice.id, choice]))
  const options = references
    .filter((classRecord) => classRecord.category !== 'SUBCLASS' && choicesById.has(classRecord.id))
    .map((classRecord) => toClassCard(classRecord, choicesById.get(classRecord.id)))
    .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))

  return [{ id: 'classes', options }]
}

export function buildBackgroundSelectionGroups(
  references: CharacterBuilderBackgroundReferenceDto[],
  choices: CharacterBuilderChoiceOptionDto[]
): CharacterSelectionCardGroup[] {
  const choicesById = new Map(choices.map((choice) => [choice.id, choice]))

  return [
    {
      id: 'backgrounds',
      options: references
        .filter((background) => choicesById.has(background.id))
        .map((background) => {
          const choice = choicesById.get(background.id)
          const featureValue = [
            background.featureLabels.join(', '),
            background.hiddenFeatureCount > 0 ? `${background.hiddenFeatureCount} more` : ''
          ]
            .filter(Boolean)
            .join(' · ')

          return {
            id: background.id,
            label: background.label,
            description: background.summary,
            disabled: choice?.disabled,
            disabledReason: choice?.disabledReason,
            details: [
              ...(background.featureLabels.length
                ? [
                    {
                      label: background.featureLabels.length === 1 ? 'Feature' : 'Features',
                      value: featureValue,
                      prominence: 'primary' as const
                    }
                  ]
                : []),
              ...background.grantFacts.map((fact) => ({
                label: fact.label,
                value: fact.value
              })),
              ...(background.hiddenGrantFactCount > 0
                ? [{ label: 'Additional grants', value: `${background.hiddenGrantFactCount} more` }]
                : [])
            ]
          }
        })
        .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
    }
  ]
}

export function applyClassChoiceEligibility(params: {
  abilityScores: Partial<Record<string, number>>
  choices: CharacterBuilderChoiceOptionDto[]
  currentClassIds: string[]
  references: CharacterBuilderClassReferenceDto[]
  replacementIndex?: number
}): CharacterBuilderChoiceOptionDto[] {
  return params.choices.map((choice) => {
    const disabledReason = getClassChoiceDisabledReason({
      ...params,
      candidateClassId: choice.id
    })

    return {
      ...choice,
      disabled: disabledReason ? true : undefined,
      disabledReason
    }
  })
}

function getClassChoiceDisabledReason(params: {
  abilityScores: Partial<Record<string, number>>
  candidateClassId: string
  currentClassIds: string[]
  references: CharacterBuilderClassReferenceDto[]
  replacementIndex?: number
}): string | undefined {
  const existingIndex = params.currentClassIds.indexOf(params.candidateClassId)
  if (existingIndex >= 0 && existingIndex !== params.replacementIndex) return 'Already selected.'

  const proposedClassIds = [...params.currentClassIds]
  if (params.replacementIndex === undefined) proposedClassIds.push(params.candidateClassId)
  else proposedClassIds[params.replacementIndex] = params.candidateClassId

  if (proposedClassIds.length <= 1) return undefined

  for (const classId of proposedClassIds) {
    const classRecord = params.references.find((candidate) => candidate.id === classId)
    if (!classRecord?.requirementGroups) continue
    const evaluation = evaluateMulticlassRequirements(
      classRecord.requirementGroups,
      params.abilityScores
    )
    if (evaluation.passes) continue

    return `Requires ${formatMulticlassRequirements(evaluation.unmetRequirementGroups)} (Not met)`
  }

  return undefined
}

function toRaceCard(
  race: CharacterBuilderRaceReferenceDto,
  choice: CharacterBuilderChoiceOptionDto | undefined
): CharacterSelectionCardOption {
  const speedLabels = race.speedLabels ?? []
  const abilityScoreIncreaseFacts = race.abilityScoreIncreaseFacts ?? []

  return {
    id: race.id,
    label: race.label,
    description: race.description,
    disabled: choice?.disabled,
    disabledReason: choice?.disabledReason,
    details: [
      ...(race.sizeLabel
        ? [{ label: 'Size', value: race.sizeLabel, prominence: 'primary' as const }]
        : []),
      ...(speedLabels.length > 0
        ? [{ label: 'Speed', value: speedLabels.join(', '), prominence: 'primary' as const }]
        : []),
      ...abilityScoreIncreaseFacts.map((fact) => ({
        label: fact.label,
        value: fact.value
      }))
    ]
  }
}

function toClassCard(
  classRecord: CharacterBuilderClassReferenceDto,
  choice: CharacterBuilderChoiceOptionDto | undefined
): CharacterSelectionCardOption {
  const savingThrowLabels = classRecord.savingThrowLabels ?? []
  const proficiencyGroups = classRecord.proficiencyGroups ?? []

  return {
    id: classRecord.id,
    label: classRecord.label,
    description: classRecord.description,
    disabled: choice?.disabled,
    disabledReason: choice?.disabledReason?.includes('(Not met)')
      ? undefined
      : choice?.disabledReason,
    details: [
      ...(classRecord.hitpoint?.dieConfig
        ? [
            {
              label: 'Hit Die',
              value: classRecord.hitpoint.dieConfig,
              prominence: 'primary' as const
            }
          ]
        : []),
      ...(savingThrowLabels.length > 0
        ? [
            {
              label: 'Saving throws',
              value: savingThrowLabels.join(', '),
              prominence: 'primary' as const
            }
          ]
        : []),
      ...(classRecord.requirementGroups?.groups.length
        ? [
            {
              label: 'Multiclass requirements',
              value: `${formatMulticlassRequirements(classRecord.requirementGroups.groups)}${choice?.disabledReason?.includes('(Not met)') ? ' (Not met)' : ''}`,
              status: choice?.disabledReason?.includes('(Not met)')
                ? ('unmet' as const)
                : ('default' as const)
            }
          ]
        : []),
      ...proficiencyGroups.map((group) => ({
        label: group.label,
        value: group.entries.join(', ')
      }))
    ]
  }
}

function formatMulticlassRequirements(
  groups: readonly { requirements: readonly { ability: string; min: number }[] }[]
): string {
  return groups
    .map((group) =>
      group.requirements
        .map((requirement) => `${formatEnumLabel(requirement.ability)} ${requirement.min}`)
        .join(' and ')
    )
    .filter(Boolean)
    .join(' or ')
}
