import { withForm } from '#forms/app-form/AppForm'
import { EMPTY_CHARACTER_FORM_VALUES } from '../../shared/formNormalization'
import { selectOptions } from '../../selection/optionProjection'
import * as styles from '../../shared/builderShared.css'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

export const CharacterBasicsStep = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
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
