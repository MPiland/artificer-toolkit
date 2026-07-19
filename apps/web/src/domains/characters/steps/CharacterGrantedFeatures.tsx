import type { ReactNode } from 'react'
import { Badge, Stack, Text } from '@mantine/core'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterBuilderFeatureChoiceViewDto,
  CharacterBuilderGrantSummaryItemDto
} from '@artificer-toolkit/schema/api/characters'
import { renderSanitizedRichHtml } from '#ui/primitives/renderSanitizedRichHtml'
import { AppSelect } from '#ui/primitives/Select'
import {
  choiceOptions,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'

type CharacterFeatureAcquisition = CharacterFormValues['intent']['featureAcquisitions'][number]
type FeatureSelection = NonNullable<CharacterFeatureAcquisition['selections']>[number]
type FeatureSelectionValue = FeatureSelection['values'][number]
type FeatureChoiceSource = CharacterBuilderFeatureChoiceViewDto['source']

export function CharacterGrantedFeatures({
  acquisitions,
  choices,
  empty,
  features,
  onChange,
  readOnly,
  renderFeatureControls,
  title = 'Features'
}: {
  acquisitions: CharacterFormValues['intent']['featureAcquisitions']
  choices: CharacterBuilderFeatureChoiceViewDto[]
  empty?: string
  features: CharacterBuilderGrantSummaryItemDto[]
  onChange: (acquisitions: CharacterFormValues['intent']['featureAcquisitions']) => void
  readOnly: boolean
  renderFeatureControls?: (feature: CharacterBuilderGrantSummaryItemDto) => ReactNode
  title?: string
}) {
  const featureViews = toFeatureViews(features, choices)

  if (featureViews.length === 0) {
    return empty ? <Text className={styles.mutedText}>{empty}</Text> : null
  }

  return (
    <section className={styles.grantedFeatureSection} aria-label={title}>
      <Text fw={700}>{title}</Text>
      <Stack gap='sm'>
        {featureViews.map((feature) => {
          const featureChoices = choices.filter((choice) => isChoiceForFeature(choice, feature))

          return (
            <article key={`${feature.id}-${feature.sourceLabel}-${feature.source.kind}`} className={styles.grantedFeatureItem}>
              <div className={styles.grantedFeatureHeader}>
                <div>
                  <Text fw={700}>{feature.label}</Text>
                  <Text className={styles.mutedText} size='sm'>{feature.sourceLabel}</Text>
                </div>
                <Badge variant='light'>{formatSourceKind(feature.source.kind)}</Badge>
              </div>
              {feature.description?.trim()
                ? <div className={styles.grantedFeatureDescription}>{renderSanitizedRichHtml(feature.description)}</div>
                : null}
              {renderFeatureControls?.(feature)}
              {featureChoices.length
                ? (
                    <div className={styles.grantedFeatureChoices}>
                      {featureChoices.map((choice) => (
                        <CharacterFeatureChoiceControl
                          key={`${choice.featureId}-${choice.sourceLabel}-${choice.selectionKey}`}
                          acquisitions={acquisitions}
                          choice={choice}
                          readOnly={readOnly}
                          onChange={onChange}
                        />
                      ))}
                    </div>
                  )
                : null}
            </article>
          )
        })}
      </Stack>
    </section>
  )
}

function CharacterFeatureChoiceControl({
  acquisitions,
  choice,
  onChange,
  readOnly
}: {
  acquisitions: CharacterFormValues['intent']['featureAcquisitions']
  choice: CharacterBuilderFeatureChoiceViewDto
  onChange: (acquisitions: CharacterFormValues['intent']['featureAcquisitions']) => void
  readOnly: boolean
}) {
  const selectedOptionIds = getSelectedFeatureOptionIds(acquisitions, choice)
  const options = choiceOptions(choice.options)

  return choice.requiredCount === 1
    ? (
        <AppSelect
          label={`${choice.featureLabel} choice`}
          description={choice.sourceLabel}
          data={options}
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
        <div className={styles.choiceSlotGrid}>
          {Array.from({ length: choice.requiredCount }, (_, index) => {
            const currentOptionId = selectedOptionIds[index]
            const availableOptions = options.filter((option) => (
              option.value === currentOptionId || !selectedOptionIds.includes(option.value)
            ))

            return (
              <AppSelect
                key={`${choice.featureId}:${choice.selectionKey}:${index}`}
                label={`${choice.featureLabel} choice ${index + 1} of ${choice.requiredCount}`}
                description={index === 0 ? choice.sourceLabel : undefined}
                data={availableOptions}
                value={currentOptionId ?? null}
                required
                disabled={readOnly}
                clearable
                onChange={(optionId) => {
                  if (readOnly) return
                  onChange(setFeatureChoiceSlotValue(acquisitions, choice, selectedOptionIds, index, optionId))
                }}
              />
            )
          })}
        </div>
      )
}

function setFeatureChoiceSlotValue(
  acquisitions: CharacterFormValues['intent']['featureAcquisitions'],
  choice: CharacterBuilderFeatureChoiceViewDto,
  selectedOptionIds: readonly string[],
  slotIndex: number,
  selectedOptionId: string | null
): CharacterFormValues['intent']['featureAcquisitions'] {
  const nextOptionIds = Array.from({ length: choice.requiredCount }, (_, index) => selectedOptionIds[index] ?? '')
  nextOptionIds[slotIndex] = selectedOptionId ?? ''

  return setFeatureChoiceValue(acquisitions, choice, nextOptionIds.filter(Boolean))
}

function toFeatureViews(
  features: CharacterBuilderGrantSummaryItemDto[],
  choices: CharacterBuilderFeatureChoiceViewDto[]
): CharacterBuilderGrantSummaryItemDto[] {
  const orphanChoices = choices.filter((choice) => !features.some((feature) => isChoiceForFeature(choice, feature)))

  return [
    ...features,
    ...orphanChoices.map((choice) => ({
      id: choice.featureId,
      label: choice.featureLabel,
      source: choice.source,
      sourceLabel: choice.sourceLabel
    }))
  ]
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

function isChoiceForFeature(
  choice: CharacterBuilderFeatureChoiceViewDto,
  feature: CharacterBuilderGrantSummaryItemDto
): boolean {
  return choice.featureId === feature.id && sameSource(feature.source, choice.source)
}

function sameSource(left: CharacterFeatureAcquisition['source'], right: FeatureChoiceSource): boolean {
  return isSameCharacterProvenanceIdentity(left, right)
}

function formatSourceKind(kind: CharacterBuilderGrantSummaryItemDto['source']['kind']): string {
  return kind
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
}
