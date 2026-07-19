import { withForm } from '#forms/app-form/AppForm'
import type { CharacterBuilderGrantSummaryItemDto } from '@artificer-toolkit/schema/api/characters'
import { AppSelect } from '#ui/primitives/Select'
import {
  clearRaceDependents,
  clearSubraceDependents,
  choiceOptions,
  createFallbackCharacterFormValues,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterChosenGrantChoices } from './CharacterChosenGrantChoices'
import { CharacterGrantedFeatures } from './CharacterGrantedFeatures'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterRaceStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterRace({ form, payload, readOnly }) {
    const raceView = payload.view.race
    const hasAncestryFeature = raceView.ancestry
      ? raceView.features.some((feature) => isAncestryFeature(feature, raceView.ancestry?.label))
      : false

    return (
      <section className={styles.section} aria-labelledby='character-race-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-race-title' className={styles.sectionTitle}>Race</h3>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldSpan6}>
            <form.AppField name='intent.race.raceId'>
              {(field) => (
                <AppSelect
                  label='Race'
                  data={choiceOptions(raceView.raceOptions)}
                  value={field.state.value}
                  required
                  disabled={readOnly}
                  onChange={(value) => {
                    if (readOnly) return
                    form.setFieldValue('intent', clearRaceDependents({
                      ...form.state.values,
                      intent: {
                        ...form.state.values.intent,
                        race: { raceId: value ?? '' }
                      }
                    }).intent)
                  }}
                />
              )}
            </form.AppField>
          </div>
          {raceView.subraceOptions.length
            ? (
                <div className={styles.fieldSpan6}>
                  <form.AppField name='intent.race.subraceId'>
                    {(field) => (
                      <AppSelect
                        label='Subrace'
                        data={choiceOptions(raceView.subraceOptions)}
                        value={field.state.value}
                        clearable
                        disabled={readOnly}
                        onChange={(value) => {
                          if (readOnly) return
                          form.setFieldValue('intent', clearSubraceDependents({
                            ...form.state.values,
                            intent: {
                              ...form.state.values.intent,
                              race: {
                                ...form.state.values.intent.race,
                                subraceId: value ?? undefined
                              }
                            }
                          }).intent)
                        }}
                      />
                    )}
                  </form.AppField>
                </div>
              )
            : null}
        </div>
        {raceView.ancestry && !hasAncestryFeature
          ? <div className={styles.inlinePanel}>{renderAncestryChoiceControl()}</div>
          : null}
        <form.AppField name='intent.chosenGrantSelections'>
          {(field) => (
            <CharacterChosenGrantChoices
              choices={raceView.grantChoices}
              selections={field.state.value}
              readOnly={readOnly}
              onChange={field.handleChange}
            />
          )}
        </form.AppField>
        <form.AppField name='intent.featureAcquisitions'>
          {(field) => (
            <CharacterGrantedFeatures
              features={raceView.features}
              choices={raceView.featureChoices}
              acquisitions={field.state.value}
              readOnly={readOnly}
              renderFeatureControls={(feature) => (
                isAncestryFeature(feature, raceView.ancestry?.label)
                  ? renderAncestryChoiceControl()
                  : null
              )}
              onChange={field.handleChange}
            />
          )}
        </form.AppField>
      </section>
    )

    function renderAncestryChoiceControl() {
      const ancestry = raceView.ancestry
      if (!ancestry) return null

      return (
        <form.AppField name='intent.ancestrySelections'>
          {(field) => {
            const selectedAncestryOptionId = getSelectedAncestryOptionId(
              field.state.value,
              ancestry.ancestryId,
              form.state.values.intent.race
            )

            return (
              <AppSelect
                label={`${ancestry.label} option`}
                data={choiceOptions(ancestry.options)}
                value={selectedAncestryOptionId}
                required
                disabled={readOnly}
                onChange={(value) => {
                  if (!value || readOnly) return
                  const raceIntent = form.state.values.intent.race
                  field.handleChange([
                    {
                      id: crypto.randomUUID(),
                      ancestryId: ancestry.ancestryId,
                      optionId: value,
                      source: raceIntent.subraceId
                        ? { kind: 'SUBRACE', subraceId: raceIntent.subraceId }
                        : { kind: 'RACE', raceId: raceIntent.raceId },
                      timing: { kind: 'IMMEDIATE' }
                    }
                  ])
                }}
              />
            )
          }}
        </form.AppField>
      )
    }
  }
})

function isAncestryFeature(
  feature: CharacterBuilderGrantSummaryItemDto,
  ancestryLabel: string | undefined
): boolean {
  return Boolean(
    ancestryLabel
    && feature.label === ancestryLabel
    && (feature.source.kind === 'RACE' || feature.source.kind === 'SUBRACE')
  )
}

function getSelectedAncestryOptionId(
  selections: CharacterFormValues['intent']['ancestrySelections'],
  ancestryId: string,
  raceIntent: CharacterFormValues['intent']['race']
): string | undefined {
  return selections
    ?.find((selection) => (
      selection.ancestryId === ancestryId
      && isCurrentAncestrySource(selection.source, raceIntent)
    ))
    ?.optionId
}

function isCurrentAncestrySource(
  source: NonNullable<CharacterFormValues['intent']['ancestrySelections']>[number]['source'],
  raceIntent: CharacterFormValues['intent']['race']
): boolean {
  if (source.kind === 'SUBRACE') return source.subraceId === raceIntent.subraceId
  if (source.kind === 'RACE') return source.raceId === raceIntent.raceId && !raceIntent.subraceId

  return false
}
