import { withForm } from '#forms'
import { createFallbackCharacterFormValues } from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterNotesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterNotes({ form, readOnly }) {
    return (
      <section className={styles.section} aria-labelledby='character-notes-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-notes-title' className={styles.sectionTitle}>Personality & notes</h3>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldSpan6}>
            <form.AppField name='profile.personalityTraits'>
              {(field) => <field.RichTextField label='Personality Traits' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='profile.ideals'>
              {(field) => <field.RichTextField label='Ideals' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='profile.bonds'>
              {(field) => <field.RichTextField label='Bonds' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='profile.flaws'>
              {(field) => <field.RichTextField label='Flaws' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='profile.organizations'>
              {(field) => <field.RichTextField label='Organizations' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='profile.allies'>
              {(field) => <field.RichTextField label='Allies' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan6}>
            <form.AppField name='profile.enemies'>
              {(field) => <field.RichTextField label='Enemies' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan12}>
            <form.AppField name='profile.backstory'>
              {(field) => <field.RichTextField label='Backstory' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan12}>
            <form.AppField name='profile.notes'>
              {(field) => <field.RichTextField label='Notes' readOnly={readOnly} />}
            </form.AppField>
          </div>
        </div>
      </section>
    )
  }
})
