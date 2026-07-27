import { withForm } from '#forms/app-form/AppForm'
import { createFallbackCharacterFormValues, selectOptions } from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterBasicsStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterBasics({ form, payload, readOnly }) {
    return (
      <div className={styles.section}>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldSpan6}>
            <form.AppField name='label'>
              {(field) => (
                <field.TextField
                  label='Character Name'
                  placeholder='Astra Vale'
                  required
                  readOnly={readOnly}
                />
              )}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='intent.advancement.method'>
              {(field) => (
                <field.SelectField
                  label='Advancement'
                  data={selectOptions(payload.references.advancementMethods)}
                  required
                  readOnly={readOnly}
                />
              )}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan12}>
            <form.AppField name='description'>
              {(field) => (
                <field.RichTextField
                  label='Concept'
                  placeholder='Who is this character, and what promise should the build fulfill?'
                  readOnly={readOnly}
                />
              )}
            </form.AppField>
          </div>
        </div>
      </div>
    )
  }
})
