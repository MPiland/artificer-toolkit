import { withForm } from '#forms/app-form/AppForm'
import { EMPTY_CHARACTER_FORM_VALUES } from '../../shared/formNormalization'
import * as styles from '../../shared/builderShared.css'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

export const CharacterDetailsStep = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterDetails({ form, payload, readOnly }) {
    return (
      <div className={styles.section}>
        <section className={styles.stepFieldGroup} aria-labelledby='details-identity-title'>
          <h3 id='details-identity-title' className={styles.stepFieldGroupTitle}>
            Identity
          </h3>
          <div className={styles.fieldGrid}>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.alignmentId'>
                {(field) => (
                  <field.SelectField
                    label='Alignment'
                    data={payload.references.alignments.map(({ id, label }) => ({
                      value: id,
                      label
                    }))}
                    readOnly={readOnly}
                  />
                )}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.lifestyleId'>
                {(field) => (
                  <field.SelectField
                    label='Lifestyle'
                    data={payload.references.lifestyles.map(({ id, label }) => ({
                      value: id,
                      label
                    }))}
                    readOnly={readOnly}
                  />
                )}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.faith'>
                {(field) => <field.TextField label='Faith' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.gender'>
                {(field) => <field.TextField label='Gender' readOnly={readOnly} />}
              </form.AppField>
            </div>
          </div>
        </section>
        <section className={styles.stepFieldGroup} aria-labelledby='details-physical-title'>
          <h3 id='details-physical-title' className={styles.stepFieldGroupTitle}>
            Physical profile
          </h3>
          <div className={styles.fieldGrid}>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.age'>
                {(field) => <field.TextField label='Age' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.height'>
                {(field) => <field.TextField label='Height' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.weight'>
                {(field) => <field.TextField label='Weight' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.eyes'>
                {(field) => <field.TextField label='Eye Color' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.hair'>
                {(field) => <field.TextField label='Hair Color' readOnly={readOnly} />}
              </form.AppField>
            </div>
            <div className={styles.fieldSpan4}>
              <form.AppField name='profile.skin'>
                {(field) => <field.TextField label='Skin Tone' readOnly={readOnly} />}
              </form.AppField>
            </div>
          </div>
        </section>
        <section className={styles.stepFieldGroup} aria-labelledby='details-description-title'>
          <h3 id='details-description-title' className={styles.stepFieldGroupTitle}>
            Description
          </h3>
          <div className={styles.fieldGrid}>
            <div className={styles.fieldSpan12}>
              <form.AppField name='profile.physicalCharacteristics'>
                {(field) => (
                  <field.RichTextField label='Physical Characteristics' readOnly={readOnly} />
                )}
              </form.AppField>
            </div>
          </div>
        </section>
      </div>
    )
  }
})
