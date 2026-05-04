import { withForm } from '#forms'
import { createFallbackCharacterFormValues } from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterDetailsStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterDetails({ form, readOnly }) {
    return (
      <section className={styles.section} aria-labelledby='character-details-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-details-title' className={styles.sectionTitle}>Details</h3>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldSpan4}>
            <form.AppField name='profile.alignmentId'>
              {(field) => <field.TextField label='Alignment' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan4}>
            <form.AppField name='profile.lifestyleId'>
              {(field) => <field.TextField label='Lifestyle' readOnly={readOnly} />}
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
              {(field) => <field.TextField label='Eyes' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan4}>
            <form.AppField name='profile.hair'>
              {(field) => <field.TextField label='Hair' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan4}>
            <form.AppField name='profile.skin'>
              {(field) => <field.TextField label='Skin' readOnly={readOnly} />}
            </form.AppField>
          </div>
          <div className={styles.fieldSpan12}>
            <form.AppField name='profile.physicalCharacteristics'>
              {(field) => <field.RichTextField label='Physical Characteristics' readOnly={readOnly} />}
            </form.AppField>
          </div>
        </div>
      </section>
    )
  }
})
