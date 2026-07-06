import { Alert } from '@mantine/core'
import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import {
  clearRaceDependents,
  clearSubraceDependents,
  choiceOptions,
  createFallbackCharacterFormValues,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterGrantedFeatures } from './CharacterGrantedFeatures'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterRaceStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterRace({ form, payload, readOnly }) {
    const raceView = payload.view.race

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
          {raceView.ancestry
            ? (
                <div className={styles.fieldSpan6}>
                  <form.AppField name='intent.ancestrySelections'>
                    {(field) => {
                      const selectedAncestryOptionId = raceView.ancestry
                        ? getSelectedAncestryOptionId(field.state.value, raceView.ancestry.ancestryId, form.state.values.intent.race)
                        : undefined

                      return (
                        <AppSelect
                          label={raceView.ancestry?.label ?? 'Ancestry Choice'}
                          data={choiceOptions(raceView.ancestry?.options ?? [])}
                          value={selectedAncestryOptionId}
                          required
                          disabled={readOnly}
                          onChange={(value) => {
                            if (!raceView.ancestry || !value || readOnly) return
                            const raceIntent = form.state.values.intent.race
                            field.handleChange([
                              {
                                id: crypto.randomUUID(),
                                ancestryId: raceView.ancestry.ancestryId,
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
                </div>
              )
            : null}
        </div>
        {payload.resolution.summary.selectedRace
          ? (
              <Alert color='blue'>
                {`Selected: ${payload.resolution.summary.selectedRace.subraceLabel
                ?? payload.resolution.summary.selectedRace.raceLabel}.`}
              </Alert>
            )
          : null}
        <form.AppField name='intent.featureAcquisitions'>
          {(field) => (
            <CharacterGrantedFeatures
              features={raceView.features}
              choices={raceView.featureChoices}
              acquisitions={field.state.value}
              readOnly={readOnly}
              onChange={field.handleChange}
            />
          )}
        </form.AppField>
      </section>
    )
  }
})

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
