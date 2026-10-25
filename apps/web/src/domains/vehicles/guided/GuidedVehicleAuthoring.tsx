import { useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-form'
import { Alert, Stack, Text } from '@mantine/core'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import * as styles from '#forms/guided/guidedAuthoring.css'
import {
  EMPTY_GUIDED_FORM_VALUES,
  type GuidedValues,
  guidedField,
  readGuidedValues,
  toFeatures,
  toSelectOption
} from '#forms/guided/guidedValues'

const STEPS = ['Basics', 'Performance', 'Capacity and cost', 'Features', 'Review'] as const
const TITLES = [
  'Name your vehicle',
  'Set the performance',
  'Add capacity and cost',
  'Add features',
  'Review your vehicle'
] as const
const DESCRIPTIONS = [
  'Give this vehicle a memorable identity.',
  'Capture the compact stats players need at a glance.',
  'Keep crew, capacity, and cost practical.',
  'Add named traits or actions players can scan.',
  'Check the essentials before saving.'
] as const

export const GuidedVehicleAuthoring = withForm({
  defaultValues: EMPTY_GUIDED_FORM_VALUES,
  props: {} as GuidedDomainAuthoringProps,
  render: function RenderGuidedVehicleAuthoring({
    form,
    onAdvanced,
    onStateChange,
    session,
    system
  }) {
    const [screen, setScreen] = useState(0)
    const values = useSelector(form.store, (state) => state.values)
    const draft = readGuidedValues('vehicle', values)
    const label = draft.label ?? ''
    const features = toFeatures(draft.features)

    useEffect(() => {
      onStateChange({ isReview: screen === 4, showPreview: screen > 0 || Boolean(label) })
    }, [label, onStateChange, screen])

    const canContinue = screen === 0 ? Boolean(label.trim()) : true
    const setFeatures = (next: FeatureDto[]) =>
      form.setFieldValue(guidedField('vehicle', 'features'), next)

    return (
      <GuidedAuthoringFrame
        canContinue={canContinue}
        description={DESCRIPTIONS[screen]}
        domainLabel='Vehicle'
        onAdvanced={onAdvanced}
        onBack={screen > 0 ? () => setScreen((current) => current - 1) : undefined}
        onNext={
          screen < STEPS.length - 1
            ? () => canContinue && setScreen((current) => current + 1)
            : undefined
        }
        stepIndex={screen}
        steps={STEPS}
        title={TITLES[screen]}
      >
        {screen === 0 ? (
          <Stack gap='lg'>
            {session.mode === 'edit' && hasAdvancedData(draft.properties, features) ? (
              <Alert color='blue' title='Some details require Advanced'>
                Detailed properties and feature mechanics stay intact while you edit this vehicle's
                common fields.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={guidedField('vehicle', 'label')}>
                {(field) => (
                  <field.TextField
                    label='Vehicle name'
                    placeholder='A vehicle your table will remember'
                    required
                  />
                )}
              </form.AppField>
              <AuthoringArtworkControl />
            </div>
            <form.AppField name={guidedField('vehicle', 'description')}>
              {(field) => (
                <field.RichTextField
                  label='Description'
                  placeholder='Describe the vehicle in plain language.'
                />
              )}
            </form.AppField>
          </Stack>
        ) : null}

        {screen === 1 ? (
          <div className={styles.fields}>
            <form.AppField name={guidedField('vehicle', 'category')}>
              {(field) => (
                <field.SelectField
                  label='Category'
                  description={
                    session.mode === 'edit'
                      ? 'Copied structure is fixed; switch to Advanced to change it.'
                      : undefined
                  }
                  readOnly={session.mode === 'edit'}
                  data={[
                    { value: 'LAND', label: 'Land' },
                    { value: 'WATER', label: 'Water' },
                    { value: 'AIR', label: 'Air' },
                    { value: 'SPELLJAMMER', label: 'Spelljammer' }
                  ]}
                />
              )}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'size')}>
              {(field) => (
                <field.SelectField
                  label='Size'
                  data={[
                    { value: 'LARGE', label: 'Large' },
                    { value: 'GARGANTUAN', label: 'Gargantuan' }
                  ]}
                />
              )}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'armorClass')}>
              {(field) => <field.NumberField label='Armor Class' minimum={0} />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'hitPoints')}>
              {(field) => <field.NumberField label='Hit Points' minimum={0} />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'speed')}>
              {(field) => <field.NumberField label='Speed' minimum={0} />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'speedNote')}>
              {(field) => (
                <field.TextField label='Speed note' placeholder='Optional movement note' />
              )}
            </form.AppField>
          </div>
        ) : null}

        {screen === 2 ? (
          <div className={styles.fields}>
            <form.AppField name={guidedField('vehicle', 'crewMin')}>
              {(field) => <field.NumberField label='Minimum crew' minimum={0} />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'crewMax')}>
              {(field) => <field.NumberField label='Maximum crew' minimum={0} />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'passengerCapacity')}>
              {(field) => <field.NumberField label='Passenger capacity' minimum={0} />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'cargoCapacity')}>
              {(field) => <field.TextField label='Cargo capacity' placeholder='e.g. 2 tons' />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'cost', 'amount')}>
              {(field) => <field.NumberField label='Cost' minimum={0} />}
            </form.AppField>
            <form.AppField name={guidedField('vehicle', 'cost', 'currencyId')}>
              {(field) => (
                <field.SelectField data={system.currencies.map(toSelectOption)} label='Currency' />
              )}
            </form.AppField>
          </div>
        ) : null}

        {screen === 3 ? (
          <GuidedFeatureAccordion features={features} system={system} onChange={setFeatures} />
        ) : null}

        {screen === 4 ? (
          <Stack gap='md'>
            <Text fw={600}>{label || 'Untitled Vehicle'}</Text>
            <dl className={styles.summary}>
              <GuidedSummaryRow label='Category' value={draft.category || 'Not set'} />
              <GuidedSummaryRow
                label='Performance'
                value={[
                  summaryStat('AC', draft.armorClass),
                  summaryStat('HP', draft.hitPoints),
                  summaryStat('Speed', draft.speed)
                ].join(' · ')}
              />
              <GuidedSummaryRow label='Features' value={String(features.length || 'None yet')} />
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

function summaryStat(label: string, value: number | undefined): string {
  return typeof value === 'number' ? `${label} ${value}` : `${label} —`
}

function hasAdvancedData(
  properties: GuidedValues<'vehicle'>['properties'],
  features: FeatureDto[]
): boolean {
  return (
    Boolean(properties?.length) ||
    features.some((feature) =>
      Boolean(
        feature.effects?.length || feature.grants || feature.restrictions || feature.options?.length
      )
    )
  )
}
