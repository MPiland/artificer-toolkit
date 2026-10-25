import type { ReactNode } from 'react'
import { Badge, Stack, Text } from '@mantine/core'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterBuilderFeatureChoiceViewDto,
  CharacterBuilderGrantSummaryItemDto
} from '@artificer-toolkit/schema/api/characters'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { renderSanitizedRichHtml } from '#lib/richText'
import { AppMultiSelect, AppSelect } from '#ui/primitives/Select'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import { choiceOptions } from './choiceOptions'
import * as sharedStyles from '../shared/builderShared.css'
import * as styles from './characterChoices.css'

type CharacterFeatureAcquisition = CharacterFormValues['intent']['featureAcquisitions'][number]
type FeatureSelection = NonNullable<CharacterFeatureAcquisition['selections']>[number]
type FeatureSelectionValue = FeatureSelection['values'][number]
type FeatureChoiceSource = CharacterBuilderFeatureChoiceViewDto['source']

export function CharacterGrantedFeatures({
  acquisitions,
  children,
  choices,
  empty,
  features,
  onChange,
  presentation = 'cards',
  readOnly,
  renderFeatureControls,
  showTitle = true,
  showSourceBadge = true,
  title = 'Features'
}: {
  acquisitions: CharacterFormValues['intent']['featureAcquisitions']
  children?: ReactNode
  choices: CharacterBuilderFeatureChoiceViewDto[]
  empty?: string
  features: CharacterBuilderGrantSummaryItemDto[]
  onChange: (acquisitions: CharacterFormValues['intent']['featureAcquisitions']) => void
  presentation?: 'cards' | 'rows'
  readOnly: boolean
  renderFeatureControls?: (feature: CharacterBuilderGrantSummaryItemDto) => ReactNode
  showTitle?: boolean
  showSourceBadge?: boolean
  title?: string
}) {
  const featureViews = toFeatureViews(features, choices)

  if (featureViews.length === 0 && children == null) {
    return empty ? <Text className={sharedStyles.mutedText}>{empty}</Text> : null
  }

  return (
    <section className={styles.grantedFeatureSection} aria-label={title}>
      {showTitle ? <Text fw={700}>{title}</Text> : null}
      <Stack gap={presentation === 'rows' ? 0 : 'md'}>
        {featureViews.map((feature) => {
          const featureChoices = choices.filter((choice) => isChoiceForFeature(choice, feature))

          return (
            <article
              key={`${feature.id}-${feature.sourceLabel}-${feature.source.kind}`}
              className={
                presentation === 'rows' ? styles.grantedFeatureRow : styles.grantedFeatureItem
              }
            >
              <div className={styles.grantedFeatureHeader}>
                <Text fw={700}>{feature.label}</Text>
                {showSourceBadge ? (
                  <Badge variant='light'>{formatEnumLabel(feature.source.kind)}</Badge>
                ) : null}
              </div>
              {feature.description?.trim() ? (
                <div className={styles.grantedFeatureDescription}>
                  {renderSanitizedRichHtml(feature.description)}
                </div>
              ) : null}
              {feature.details?.length ? (
                <div className={styles.grantedFeatureDetails}>
                  {feature.details.map((detail) => (
                    <section key={detail.id} className={styles.grantedFeatureDetail}>
                      {isRedundantDetailLabel(detail.label, feature.label) ? null : (
                        <Text fw={650} size='sm'>
                          {detail.label}
                        </Text>
                      )}
                      <div className={styles.grantedFeatureDescription}>
                        {renderSanitizedRichHtml(detail.description)}
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}
              {renderFeatureControls?.(feature)}
              {featureChoices.length ? (
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
              ) : null}
            </article>
          )
        })}
        {children}
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

  return choice.requiredCount === 1 ? (
    <AppSelect
      label='Choose 1'
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
  ) : (
    <AppMultiSelect
      label={`Choose ${choice.requiredCount}`}
      data={options}
      value={selectedOptionIds}
      required
      disabled={readOnly}
      clearable
      maxValues={choice.requiredCount}
      onChange={(optionIds) => {
        if (readOnly) return
        onChange(
          setFeatureChoiceValue(acquisitions, choice, optionIds.slice(0, choice.requiredCount))
        )
      }}
    />
  )
}

function toFeatureViews(
  features: CharacterBuilderGrantSummaryItemDto[],
  choices: CharacterBuilderFeatureChoiceViewDto[]
): CharacterBuilderGrantSummaryItemDto[] {
  const orphanChoices = choices.filter(
    (choice) => !features.some((feature) => isChoiceForFeature(choice, feature))
  )

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
    ? acquisitions.map((acquisition) =>
        isChoiceAcquisition(acquisition, choice) ? nextAcquisition : acquisition
      )
    : [...acquisitions, nextAcquisition]
}

function getSelectedFeatureOptionIds(
  acquisitions: CharacterFormValues['intent']['featureAcquisitions'],
  choice: CharacterBuilderFeatureChoiceViewDto
): string[] {
  const acquisition = acquisitions.find((candidate) => isChoiceAcquisition(candidate, choice))

  return (
    acquisition?.selections
      ?.filter((selection) => selection.selectionKey === choice.selectionKey)
      .flatMap((selection) =>
        selection.values.flatMap((value) => {
          if (value.kind === 'ID') return [value.id]
          if (value.kind === 'IDS') return value.ids

          return []
        })
      ) ?? []
  )
}

function toSelectionValues(selectedOptionIds: string[]): FeatureSelectionValue[] {
  if (selectedOptionIds.length === 1) {
    return [{ kind: 'ID', id: selectedOptionIds[0] }]
  }

  return [{ kind: 'IDS', ids: selectedOptionIds }]
}

function getFeatureChoiceTiming(
  source: FeatureChoiceSource
): CharacterFeatureAcquisition['timing'] {
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

function sameSource(
  left: CharacterFeatureAcquisition['source'],
  right: FeatureChoiceSource
): boolean {
  return isSameCharacterProvenanceIdentity(left, right)
}

function isRedundantDetailLabel(detailLabel: string, featureLabel: string): boolean {
  const normalizedDetailLabel = detailLabel.trim().toLocaleLowerCase()
  return (
    normalizedDetailLabel === 'detail' ||
    normalizedDetailLabel === featureLabel.trim().toLocaleLowerCase()
  )
}
