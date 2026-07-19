import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import {
  clearBackgroundDependents,
  choiceOptions,
  createFallbackCharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterChosenGrantChoices } from './CharacterChosenGrantChoices'
import { CharacterGrantedFeatures } from './CharacterGrantedFeatures'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterBackgroundStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterBackground({ form, payload, readOnly }) {
    return (
      <section className={styles.section} aria-labelledby='character-background-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-background-title' className={styles.sectionTitle}>Background</h3>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldSpan6}>
            <form.AppField name='intent.background.backgroundId'>
              {(field) => (
                <AppSelect
                  label='Background'
                  data={choiceOptions(payload.view.background.backgroundOptions)}
                  value={field.state.value}
                  required
                  disabled={readOnly}
                  onChange={(value) => {
                    if (readOnly) return
                    form.setFieldValue('intent', clearBackgroundDependents({
                      ...form.state.values,
                      intent: {
                        ...form.state.values.intent,
                        background: { backgroundId: value ?? '' }
                      }
                    }).intent)
                  }}
                />
              )}
            </form.AppField>
          </div>
        </div>
        <form.AppField name='intent.chosenGrantSelections'>
          {(field) => (
            <CharacterChosenGrantChoices
              choices={payload.view.background.grantChoices}
              selections={field.state.value}
              readOnly={readOnly}
              onChange={field.handleChange}
            />
          )}
        </form.AppField>
        <form.AppField name='intent.featureAcquisitions'>
          {(field) => (
            <CharacterGrantedFeatures
              features={payload.view.background.features}
              choices={payload.view.background.featureChoices}
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
