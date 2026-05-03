import { Stack, Text } from '@mantine/core'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import { AppMultiSelect, AppSelect } from '#ui/primitives/Select'
import {
  choiceOptions,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderFeatureChoiceViewDto } from '@artificer-toolkit/schema/api/characters'

type CharacterFeatureAcquisition = CharacterFormValues['intent']['featureAcquisitions'][number]
type FeatureSelection = NonNullable<CharacterFeatureAcquisition['selections']>[number]
type FeatureSelectionValue = FeatureSelection['values'][number]
type FeatureChoiceSource = CharacterBuilderFeatureChoiceViewDto['source']

export function CharacterFeatureChoices({
  choices,
  acquisitions,
  onChange,
  readOnly
}: {
  choices: CharacterBuilderFeatureChoiceViewDto[]
  acquisitions: CharacterFormValues['intent']['featureAcquisitions']
  onChange: (acquisitions: CharacterFormValues['intent']['featureAcquisitions']) => void
  readOnly: boolean
}) {
  if (choices.length === 0) return null

  return (
    <Stack gap='md' className={styles.inlinePanel}>
      <div>
        <Text fw={700}>Feature choices</Text>
        <Text className={styles.mutedText} size='sm'>Resolve source-local feature options before finalizing.</Text>
      </div>
      {choices.map((choice) => {
        const selectedOptionIds = getSelectedFeatureOptionIds(acquisitions, choice)
        const label = choice.requiredCount === 1
          ? `${choice.featureLabel} choice`
          : `${choice.featureLabel} choices`

        return choice.requiredCount === 1
          ? (
              <AppSelect
                key={`${choice.featureId}-${choice.sourceLabel}`}
                label={label}
                description={choice.sourceLabel}
                data={choiceOptions(choice.options)}
                value={selectedOptionIds[0] ?? null}
                required
                disabled={readOnly}
                clearable
                onChange={(optionId) => {
                  if (readOnly) return
                  onChange(setFeatureChoiceValue(acquisitions, choice, optionId ? [optionId] : []))
                }}
              />
            )
          : (
              <AppMultiSelect
                key={`${choice.featureId}-${choice.sourceLabel}`}
                label={label}
                description={choice.sourceLabel}
                data={choiceOptions(choice.options)}
                value={selectedOptionIds}
                required
                disabled={readOnly}
                clearable
                maxValues={choice.requiredCount}
                onChange={(optionIds) => {
                  if (readOnly) return
                  onChange(setFeatureChoiceValue(acquisitions, choice, optionIds.slice(0, choice.requiredCount)))
                }}
              />
            )
      })}
    </Stack>
  )
}

function setFeatureChoiceValue(
  acquisitions: CharacterFormValues['intent']['featureAcquisitions'],
  choice: CharacterBuilderFeatureChoiceViewDto,
  selectedOptionIds: string[]
): CharacterFormValues['intent']['featureAcquisitions'] {
  const existing = acquisitions.find((acquisition) => isChoiceAcquisition(acquisition, choice))
  if (selectedOptionIds.length === 0) {
    return acquisitions.filter((acquisition) => !isChoiceAcquisition(acquisition, choice))
  }

  const nextAcquisition: CharacterFeatureAcquisition = {
    id: existing?.id ?? crypto.randomUUID(),
    featureId: choice.featureId,
    source: choice.source,
    timing: getFeatureChoiceTiming(choice.source),
    selections: [
      {
        selectionKey: choice.selectionKey,
        values: toSelectionValues(selectedOptionIds)
      }
    ]
  }

  return existing
    ? acquisitions.map((acquisition) => isChoiceAcquisition(acquisition, choice) ? nextAcquisition : acquisition)
    : [...acquisitions, nextAcquisition]
}

function getSelectedFeatureOptionIds(
  acquisitions: CharacterFormValues['intent']['featureAcquisitions'],
  choice: CharacterBuilderFeatureChoiceViewDto
): string[] {
  const acquisition = acquisitions.find((candidate) => isChoiceAcquisition(candidate, choice))

  return acquisition?.selections
    ?.filter((selection) => selection.selectionKey === choice.selectionKey)
    .flatMap((selection) => selection.values.flatMap((value) => {
      if (value.kind === 'ID') return [value.id]
      if (value.kind === 'IDS') return value.ids

      return []
    })) ?? []
}

function toSelectionValues(selectedOptionIds: string[]): FeatureSelectionValue[] {
  if (selectedOptionIds.length === 1) {
    return [{ kind: 'ID', id: selectedOptionIds[0] }]
  }

  return [{ kind: 'IDS', ids: selectedOptionIds }]
}

function getFeatureChoiceTiming(source: FeatureChoiceSource): CharacterFeatureAcquisition['timing'] {
  if (source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: source.classId,
      classLevel: source.classLevel ?? 1
    }
  }

  return { kind: 'IMMEDIATE' }
}

function isChoiceAcquisition(
  acquisition: CharacterFeatureAcquisition,
  choice: CharacterBuilderFeatureChoiceViewDto
): boolean {
  return acquisition.featureId === choice.featureId && sameSource(acquisition.source, choice.source)
}

function sameSource(left: CharacterFeatureAcquisition['source'], right: FeatureChoiceSource): boolean {
  return isSameCharacterProvenanceIdentity(left, right)
}
