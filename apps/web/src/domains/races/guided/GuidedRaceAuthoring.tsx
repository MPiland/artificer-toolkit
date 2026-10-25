import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mantine/core'
import { useSelector } from '@tanstack/react-form'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import * as styles from '#forms/guided/guidedAuthoring.css'
import { toGuidedRaceParentOptions } from './guidedRaceParents'
import {
  EMPTY_GUIDED_FORM_VALUES,
  guidedField,
  readGuidedValues,
  toFeatures,
  toSelectOption
} from '#forms/guided/guidedValues'

export const GuidedRaceAuthoring = withForm({
  defaultValues: EMPTY_GUIDED_FORM_VALUES,
  props: {} as GuidedDomainAuthoringProps,
  render: function RenderGuidedRaceAuthoring({ form, onAdvanced, onStateChange, session, system }) {
    const [step, setStep] = useState(0)
    const formValues = useSelector(form.store, (state) => state.values)
    const draft = readGuidedValues('race', formValues)
    const label = draft.label?.trim() ?? ''
    const category = draft.category
    const parentRaceId = draft.parentRaceId ?? ''
    const features = toFeatures(draft.features)
    const categoryLocked = session.mode === 'edit'
    const parentRaces = useContentCatalogue('RACE', {
      enabled: category === RACE_CATEGORY_CODE.SUBRACE && Boolean(session.systemId),
      systemId: session.systemId
    })
    const parentOptions = toGuidedRaceParentOptions(parentRaces.items ?? [], session.subjectId)

    useEffect(() => {
      onStateChange({
        isReview: step === 3,
        showPreview: session.mode === 'edit' || step > 0 || Boolean(label)
      })
    }, [onStateChange, session.mode, step, label])

    const setFeatures = (next: FeatureDto[]) => {
      form.setFieldValue(guidedField('race', 'features'), next)
    }

    return (
      <GuidedAuthoringFrame
        canContinue={Boolean(
          label && (step !== 0 || category !== RACE_CATEGORY_CODE.SUBRACE || parentRaceId)
        )}
        description={DESCRIPTIONS[step]}
        domainLabel='Race'
        onAdvanced={onAdvanced}
        onBack={step > 0 ? () => setStep((current) => current - 1) : undefined}
        onNext={step < 3 ? () => setStep((current) => current + 1) : undefined}
        stepIndex={step}
        steps={STEPS}
        title={TITLES[step]}
      >
        {step === 0 ? (
          <Stack gap='lg'>
            {categoryLocked ? (
              <Alert color='blue'>
                This draft remains a {category === 'SUBRACE' ? 'subrace' : 'base race'} in Guided.
                Switch to Advanced to change its structure.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={guidedField('race', 'label')}>
                {(field) => <field.TextField label='Race name' required />}
              </form.AppField>
              <AuthoringArtworkControl />
            </div>
            <div className={styles.fields}>
              <form.AppField name={guidedField('race', 'category')}>
                {(field) => (
                  <field.SelectField
                    data={[
                      { label: 'Base race', value: RACE_CATEGORY_CODE.BASE },
                      { label: 'Subrace', value: RACE_CATEGORY_CODE.SUBRACE }
                    ]}
                    description={
                      categoryLocked ? 'Structural category is fixed for this draft.' : undefined
                    }
                    label='Type'
                    readOnly={categoryLocked}
                    required
                  />
                )}
              </form.AppField>
              {category === RACE_CATEGORY_CODE.SUBRACE ? (
                <form.AppField name={guidedField('race', 'parentRaceId')}>
                  {(field) => (
                    <field.SelectField
                      data={parentOptions}
                      label='Parent race'
                      placeholder={parentRaces.isPending ? 'Loading races…' : 'Choose a base race'}
                      required
                    />
                  )}
                </form.AppField>
              ) : null}
              <div className={styles.full}>
                <form.AppField name={guidedField('race', 'description')}>
                  {(field) => (
                    <field.RichTextField
                      label='Description'
                      placeholder='Describe this people and what makes them distinctive.'
                    />
                  )}
                </form.AppField>
              </div>
            </div>
          </Stack>
        ) : null}
        {step === 1 ? (
          category === RACE_CATEGORY_CODE.SUBRACE ? (
            <Alert color='blue'>
              A subrace inherits its core size and movement from its parent. Add its distinctive
              abilities in Features, or use Advanced for ancestry behavior.
            </Alert>
          ) : (
            <div className={styles.fields}>
              <form.AppField name={guidedField('race', 'size')}>
                {(field) => <field.SelectField data={SIZE_OPTIONS} label='Size' required />}
              </form.AppField>
              <form.AppField name={guidedField('race', 'speeds', 0, 'speedId')}>
                {(field) => (
                  <field.SelectField
                    data={system.speeds.map(toSelectOption)}
                    label='Movement type'
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name={guidedField('race', 'speeds', 0, 'amount')}>
                {(field) => (
                  <field.NumberField label='Movement speed (feet)' minimum={0} required />
                )}
              </form.AppField>
            </div>
          )
        ) : null}
        {step === 2 ? (
          <GuidedFeatureAccordion features={features} system={system} onChange={setFeatures} />
        ) : null}
        {step === 3 ? (
          <Stack gap='md'>
            <dl className={styles.summary}>
              <GuidedSummaryRow label='Name' value={label || 'Untitled Race'} />
              <GuidedSummaryRow
                label='Type'
                value={category === RACE_CATEGORY_CODE.SUBRACE ? 'Subrace' : 'Base race'}
              />
              <GuidedSummaryRow label='Features' value={`${features.length}`} />
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

const STEPS = ['Basics', 'Traits', 'Features', 'Review'] as const
const TITLES = [
  'Start with the basics',
  'Set the core traits',
  'Add features',
  'Review your race'
] as const
const DESCRIPTIONS = [
  'Name the race, choose its structure, and describe what makes it distinct.',
  'Set the common physical traits players need at the table.',
  'Add the abilities that define how this race plays.',
  'Check the essentials before saving or activating.'
] as const
const SIZE_OPTIONS = ['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'HUGE', 'GARGANTUAN'].map((value) => ({
  label: value.charAt(0) + value.slice(1).toLowerCase(),
  value
}))
