import { useState } from 'react'
import { Button, Text } from '@mantine/core'
import { withForm } from '#forms/app-form/AppForm'
import { stripHtml } from '#components/AuthoredDetail/detailFormatters'
import { renderSanitizedRichHtml } from '#lib/richText'
import { EMPTY_CHARACTER_FORM_VALUES } from '../../shared/formNormalization'
import { clearBackgroundDependents } from '../../shared/dependencyClearing'
import { getAllChosenGrantChoices, isChoiceOptionDisabled } from '../../choices/choiceOptions'
import * as sharedStyles from '../../shared/builderShared.css'
import * as choiceStyles from '../../choices/characterChoices.css'
import * as styles from './characterBackground.css'
import { CharacterSelectionModal } from '../../selection/CharacterSelectionModal'
import { buildBackgroundSelectionGroups } from '../../selection/characterSelectionOptions'
import { CharacterChosenGrantChoices } from '../../choices/CharacterChosenGrantChoices'
import { CharacterGrantedFeatures } from '../../choices/CharacterGrantedFeatures'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

export const CharacterBackgroundStep = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterBackground({ form, payload, readOnly }) {
    const [chooserOpened, setChooserOpened] = useState(false)
    const [stagedBackgroundId, setStagedBackgroundId] = useState<string | null>(null)
    const backgroundView = payload.view.background
    const selectedBackgroundId = form.state.values.intent.background.backgroundId || null
    const selectedBackground = payload.references.backgrounds.find(
      (background) => background.id === selectedBackgroundId
    )
    const selectionGroups = buildBackgroundSelectionGroups(
      payload.references.backgrounds,
      backgroundView.backgroundOptions
    )
    const featureGrantChoices = backgroundView.grantChoices.filter(
      (choice) => choice.ownerFeatureId
    )
    const standaloneGrantChoices = backgroundView.grantChoices.filter(
      (choice) => !choice.ownerFeatureId
    )
    const allGrantChoices = getAllChosenGrantChoices(payload.view)

    return (
      <section className={sharedStyles.section} aria-labelledby='character-background-title'>
        <div className={sharedStyles.sectionHeader}>
          <h3 id='character-background-title' className={sharedStyles.sectionTitle}>
            {selectedBackground?.label ?? 'No background selected'}
          </h3>
          {!readOnly ? (
            <Button
              type='button'
              onClick={() => {
                setStagedBackgroundId(null)
                setChooserOpened(true)
              }}
            >
              {selectedBackgroundId ? 'Change Background' : 'Choose Background'}
            </Button>
          ) : null}
        </div>
        {backgroundView.description?.trim() ? (
          <div className={styles.backgroundDescription}>
            {renderSanitizedRichHtml(backgroundView.description)}
          </div>
        ) : null}
        <form.AppField name='intent.chosenGrantSelections'>
          {(grantField) => (
            <>
              <CharacterChosenGrantChoices
                allChoices={allGrantChoices}
                choices={standaloneGrantChoices}
                selections={grantField.state.value}
                readOnly={readOnly}
                onChange={grantField.handleChange}
              />
              <form.AppField name='intent.featureAcquisitions'>
                {(featureField) => (
                  <CharacterGrantedFeatures
                    features={backgroundView.features}
                    choices={backgroundView.featureChoices}
                    acquisitions={featureField.state.value}
                    readOnly={readOnly}
                    showSourceBadge={false}
                    showTitle={false}
                    renderFeatureControls={(feature) => (
                      <CharacterChosenGrantChoices
                        allChoices={allGrantChoices}
                        choices={featureGrantChoices.filter(
                          (choice) => choice.ownerFeatureId === feature.id
                        )}
                        presentation='controls'
                        selections={grantField.state.value}
                        readOnly={readOnly}
                        onChange={grantField.handleChange}
                      />
                    )}
                    onChange={featureField.handleChange}
                  />
                )}
              </form.AppField>
            </>
          )}
        </form.AppField>
        {backgroundView.detailSections.length ? (
          <details className={styles.suggestedCharacteristics}>
            <summary className={styles.suggestedCharacteristicsSummary}>
              Suggested Characteristics
            </summary>
            <div className={styles.suggestedCharacteristicsContent}>
              <Text size='sm' className={styles.suggestedCharacteristicsIntro}>
                Select any suggestions you want to use. You can edit the text later in Notes.
              </Text>
              {backgroundView.detailSections.map((section) => {
                const profileField =
                  section.label === 'Personality Traits'
                    ? {
                        name: 'personalityTraits' as const,
                        value: form.state.values.profile.personalityTraits ?? ''
                      }
                    : section.label === 'Ideals'
                      ? {
                          name: 'ideals' as const,
                          value: form.state.values.profile.ideals ?? ''
                        }
                      : section.label === 'Bonds'
                        ? {
                            name: 'bonds' as const,
                            value: form.state.values.profile.bonds ?? ''
                          }
                        : section.label === 'Flaws'
                          ? {
                              name: 'flaws' as const,
                              value: form.state.values.profile.flaws ?? ''
                            }
                          : null
                const selectedValues = profileField
                  ? profileField.value
                      .split('\n')
                      .map((value) => value.trim())
                      .filter(Boolean)
                  : []

                return (
                  <section key={section.label} className={styles.suggestedCharacteristicsGroup}>
                    <Text fw={700}>{section.label}</Text>
                    {section.details.map((detail) => {
                      const suggestion = stripHtml(detail.description)
                      const selected = selectedValues.includes(suggestion)
                      const content = (
                        <>
                          <span className={styles.suggestedCharacteristicHeader}>
                            <span>{detail.label}</span>
                            {profileField ? (
                              <span className={styles.suggestedCharacteristicAction}>
                                {selected ? 'Selected' : 'Use'}
                              </span>
                            ) : null}
                          </span>
                          <div className={choiceStyles.grantedFeatureDescription}>
                            {renderSanitizedRichHtml(detail.description)}
                          </div>
                        </>
                      )

                      if (!profileField) {
                        return (
                          <div key={detail.id} className={styles.suggestedCharacteristic}>
                            {content}
                          </div>
                        )
                      }

                      return (
                        <button
                          key={detail.id}
                          type='button'
                          className={`${styles.suggestedCharacteristic} ${styles.suggestedCharacteristicButton}${selected ? ` ${styles.suggestedCharacteristicSelected}` : ''}`}
                          aria-label={`${selected ? 'Remove' : 'Use'} ${detail.label}`}
                          aria-pressed={selected}
                          disabled={readOnly}
                          onClick={() => {
                            const nextValue = selected
                              ? selectedValues.filter((value) => value !== suggestion).join('\n')
                              : [...selectedValues, suggestion].join('\n')

                            if (profileField.name === 'personalityTraits') {
                              form.setFieldValue('profile.personalityTraits', nextValue)
                            } else if (profileField.name === 'ideals') {
                              form.setFieldValue('profile.ideals', nextValue)
                            } else if (profileField.name === 'bonds') {
                              form.setFieldValue('profile.bonds', nextValue)
                            } else {
                              form.setFieldValue('profile.flaws', nextValue)
                            }
                          }}
                        >
                          {content}
                        </button>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          </details>
        ) : null}
        <CharacterSelectionModal
          title={selectedBackgroundId ? 'Change background' : 'Choose a background'}
          description='Compare backgrounds and their defining features before choosing.'
          actionLabel={selectedBackgroundId ? 'Change Background' : 'Choose Background'}
          currentId={selectedBackgroundId}
          groups={selectionGroups}
          opened={chooserOpened}
          selectedId={stagedBackgroundId}
          onSelectedIdChange={setStagedBackgroundId}
          onClose={() => {
            setStagedBackgroundId(null)
            setChooserOpened(false)
          }}
          onCommit={(backgroundId) => {
            if (readOnly || isChoiceOptionDisabled(backgroundView.backgroundOptions, backgroundId))
              return
            if (backgroundId !== selectedBackgroundId) {
              form.setFieldValue(
                'intent',
                clearBackgroundDependents({
                  ...form.state.values,
                  intent: {
                    ...form.state.values.intent,
                    background: { backgroundId }
                  }
                }).intent
              )
            }
            setStagedBackgroundId(null)
            setChooserOpened(false)
          }}
        />
      </section>
    )
  }
})
