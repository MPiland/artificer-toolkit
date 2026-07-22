import { withForm } from '#forms/app-form/AppForm'
import { createFallbackCharacterFormValues } from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterNotesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterNotes({ form, readOnly }) {
    return (
      <div className={styles.section}>
        <section className={styles.stepFieldGroup} aria-labelledby='notes-character-title'>
          <h3 id='notes-character-title' className={styles.stepFieldGroupTitle}>Character</h3>
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
          </div>
        </section>
        <section className={styles.stepFieldGroup} aria-labelledby='notes-relationships-title'>
          <h3 id='notes-relationships-title' className={styles.stepFieldGroupTitle}>Relationships</h3>
          <div className={styles.fieldGrid}>
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
          </div>
        </section>
        <section className={styles.stepFieldGroup} aria-labelledby='notes-story-title'>
          <h3 id='notes-story-title' className={styles.stepFieldGroupTitle}>Story</h3>
          <div className={styles.fieldGrid}>
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
      </div>
    )
  }
})
