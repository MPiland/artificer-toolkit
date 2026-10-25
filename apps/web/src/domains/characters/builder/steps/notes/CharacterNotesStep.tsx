import { withForm } from '#forms/app-form/AppForm'
import { EMPTY_CHARACTER_FORM_VALUES } from '../../shared/formNormalization'
import * as styles from '../../shared/builderShared.css'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

export const CharacterNotesStep = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterNotes({ form, readOnly }) {
    return (
      <div className={styles.section}>
        <section className={styles.stepFieldGroup} aria-labelledby='notes-character-title'>
          <h3 id='notes-character-title' className={styles.stepFieldGroupTitle}>
            Character
          </h3>
          <div className={styles.fieldGrid}>
            <div className={styles.fieldSpan6}>
              <form.AppField name='profile.personalityTraits'>
                {(field) => <field.TextareaField label='Personality Traits' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan6}>
              <form.AppField name='profile.ideals'>
                {(field) => <field.TextareaField label='Ideals' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan6}>
              <form.AppField name='profile.bonds'>
                {(field) => <field.TextareaField label='Bonds' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan6}>
              <form.AppField name='profile.flaws'>
                {(field) => <field.TextareaField label='Flaws' readOnly={readOnly} />}
              </form.AppField>
            </div>
          </div>
        </section>
        <section className={styles.stepFieldGroup} aria-labelledby='notes-relationships-title'>
          <h3 id='notes-relationships-title' className={styles.stepFieldGroupTitle}>
            Relationships
          </h3>
          <div className={styles.fieldGrid}>
            <div className={styles.fieldSpan6}>
              <form.AppField name='profile.organizations'>
                {(field) => <field.TextareaField label='Organizations' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan6}>
              <form.AppField name='profile.allies'>
                {(field) => <field.TextareaField label='Allies' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan6}>
              <form.AppField name='profile.enemies'>
                {(field) => <field.TextareaField label='Enemies' readOnly={readOnly} />}
              </form.AppField>
            </div>
          </div>
        </section>
        <section className={styles.stepFieldGroup} aria-labelledby='notes-story-title'>
          <h3 id='notes-story-title' className={styles.stepFieldGroupTitle}>
            Story
          </h3>
          <div className={styles.fieldGrid}>
            <div className={styles.fieldSpan12}>
              <form.AppField name='profile.backstory'>
                {(field) => <field.TextareaField label='Backstory' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan12}>
              <form.AppField name='profile.notes'>
                {(field) => (
                  <field.RichTextField deferActivation label='Notes' readOnly={readOnly} />
                )}
              </form.AppField>
            </div>
          </div>
        </section>
      </div>
    )
  }
})
