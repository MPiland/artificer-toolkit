import { withForm } from '#forms/app-form/AppForm'
import {
  advancementMethodOptions,
  createFallbackCharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterBasicsStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterBasics({ form, readOnly }) {
    return (
      <section className={styles.section} aria-labelledby='character-basics-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-basics-title' className={styles.sectionTitle}>Character basics</h3>
        </div>
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
                  data={advancementMethodOptions}
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
      </section>
    )
  }
})
