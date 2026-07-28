import { useState } from 'react'
import { Button, Text } from '@mantine/core'
import { withForm } from '#forms/app-form/AppForm'
import { renderSanitizedRichHtml } from '#ui/primitives/renderSanitizedRichHtml'
import { createFallbackCharacterFormValues } from '../../shared/formNormalization'
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
  defaultValues: createFallbackCharacterFormValues(),
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
              {backgroundView.detailSections.map((section) => (
                <section key={section.label} className={styles.suggestedCharacteristicsGroup}>
                  <Text fw={700}>{section.label}</Text>
                  {section.details.map((detail) => (
                    <div key={detail.id} className={styles.suggestedCharacteristic}>
                      <Text fw={600} size='sm'>
                        {detail.label}
                      </Text>
                      <div className={choiceStyles.grantedFeatureDescription}>
                        {renderSanitizedRichHtml(detail.description)}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
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
