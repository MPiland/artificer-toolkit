import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mantine/core'
import { useSelector } from '@tanstack/react-form'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'
import { withForm } from '#forms/app-form/AppForm'
import type { AuthoredFormSession } from '#forms/factories/authoredFormFactories.types'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import type { GuidedAuthoringStateHandler } from '#forms/guided/guidedAuthoring.types'
import * as styles from '#forms/guided/guidedAuthoring.css'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import { toGuidedRaceParentOptions } from './guidedRaceParents'
import { guidedSizeOptions, toFeatures } from '#forms/guided/guidedValues'
import { isRecord } from '#forms/utils/valueGuards'

type GuidedRaceAuthoringProps = {
  onAdvanced: (() => void) | undefined
  onStateChange: GuidedAuthoringStateHandler
  session: AuthoredFormSession
}

export const GuidedRaceAuthoring = withForm({
  defaultValues: {} as object,
  props: {} as GuidedRaceAuthoringProps,
  render: function RenderGuidedRaceAuthoring({ form, onAdvanced, onStateChange, session }) {
    const [step, setStep] = useState(0)
    const values = useSelector(form.store, (state) => readRaceValues(state.values))
    const system = session.system
    const categoryLocked = session.mode === 'edit'
    const parentRaces = useContentCatalogue('RACE', {
      enabled: values.category === RACE_CATEGORY_CODE.SUBRACE && Boolean(session.systemId),
      systemId: session.systemId
    })
    const parentOptions = toGuidedRaceParentOptions(parentRaces.items ?? [], session.subjectId)

    useEffect(() => {
      onStateChange({
        isReview: step === 3,
        showPreview: session.mode === 'edit' || step > 0 || Boolean(values.label)
      })
    }, [onStateChange, session.mode, step, values.label])

    const setFeatures = (features: FeatureDto[]) => {
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['features']), features)
    }

    return (
      <GuidedAuthoringFrame
        canContinue={Boolean(
          values.label &&
          (step !== 0 || values.category !== RACE_CATEGORY_CODE.SUBRACE || values.parentRaceId)
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
                This draft remains a {values.category === 'SUBRACE' ? 'subrace' : 'base race'} in
                Guided. Switch to Advanced to change its structure.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
                {(field) => <field.TextField label='Race name' required />}
              </form.AppField>
              <AuthoringArtworkControl />
            </div>
            <div className={styles.fields}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['category'])}>
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
              {values.category === RACE_CATEGORY_CODE.SUBRACE ? (
                <form.AppField
                  name={toTypedAuthoringFieldName<object>(undefined, ['parentRaceId'])}
                >
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
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['description'])}>
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
          values.category === RACE_CATEGORY_CODE.SUBRACE ? (
            <Alert color='blue'>
              A subrace inherits its core size and movement from its parent. Add its distinctive
              abilities in Features, or use Advanced for ancestry behavior.
            </Alert>
          ) : (
            <div className={styles.fields}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['size'])}>
                {(field) => (
                  <field.SelectField
                    data={guidedSizeOptions(session.systemId)}
                    label='Size'
                    required
                  />
                )}
              </form.AppField>
              <form.AppField
                name={toTypedAuthoringFieldName<object>(undefined, ['speeds', 0, 'speedId'])}
              >
                {(field) => (
                  <field.SelectField
                    data={(system?.speeds ?? []).map((speed) => ({
                      label: speed.label,
                      value: speed.id
                    }))}
                    label='Movement type'
                    required
                  />
                )}
              </form.AppField>
              <form.AppField
                name={toTypedAuthoringFieldName<object>(undefined, ['speeds', 0, 'amount'])}
              >
                {(field) => (
                  <field.NumberField label='Movement speed (feet)' minimum={0} required />
                )}
              </form.AppField>
            </div>
          )
        ) : null}
        {step === 2 ? (
          <GuidedFeatureAccordion
            features={values.features}
            system={session.system!}
            onChange={setFeatures}
          />
        ) : null}
        {step === 3 ? (
          <Stack gap='md'>
            <dl className={styles.summary}>
              <Summary label='Name' value={values.label || 'Untitled Race'} />
              <Summary
                label='Type'
                value={values.category === RACE_CATEGORY_CODE.SUBRACE ? 'Subrace' : 'Base race'}
              />
              <Summary label='Features' value={`${values.features.length}`} />
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryRow}>
      <dt className={styles.summaryLabel}>{label}</dt>
      <dd className={styles.summaryValue}>{value}</dd>
    </div>
  )
}

function readRaceValues(values: object) {
  const record: Record<string, unknown> = isRecord(values) ? values : {}
  return {
    category:
      record.category === RACE_CATEGORY_CODE.SUBRACE
        ? RACE_CATEGORY_CODE.SUBRACE
        : RACE_CATEGORY_CODE.BASE,
    features: toFeatures(record.features),
    label: typeof record.label === 'string' ? record.label.trim() : '',
    parentRaceId: typeof record.parentRaceId === 'string' ? record.parentRaceId : ''
  }
}

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
