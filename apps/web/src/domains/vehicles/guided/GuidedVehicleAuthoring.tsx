import { useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-form'
import { Alert, Stack, Text } from '@mantine/core'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { AuthoredFormSession } from '#forms/factories/authoredFormFactories.types'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import type { GuidedAuthoringStateHandler } from '#forms/guided/guidedAuthoring.types'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import * as styles from '#forms/guided/guidedAuthoring.css'
import { readField } from '#forms/guided/guidedValues'

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

type Props = {
  session: AuthoredFormSession
  onAdvanced: (() => void) | undefined
  onStateChange: GuidedAuthoringStateHandler
}

export const GuidedVehicleAuthoring = withForm({
  defaultValues: {} as object,
  props: {} as Props,
  render: function RenderGuidedVehicleAuthoring({ form, onAdvanced, onStateChange, session }) {
    const [screen, setScreen] = useState(0)
    const values = useSelector(form.store, (state) => state.values)
    const label = readString(values, 'label')
    const features = readFeatures(values)

    useEffect(() => {
      onStateChange({ isReview: screen === 4, showPreview: screen > 0 || Boolean(label) })
    }, [label, onStateChange, screen])

    const canContinue = screen === 0 ? Boolean(label.trim()) : true
    const setFeatures = (next: FeatureDto[]) =>
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['features']), next)

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
            {session.mode === 'edit' && hasAdvancedData(values) ? (
              <Alert color='blue' title='Some details require Advanced'>
                Detailed properties and feature mechanics stay intact while you edit this vehicle's
                common fields.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
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
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['description'])}>
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
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['category'])}>
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
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['size'])}>
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
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['armorClass'])}>
              {(field) => <field.NumberField label='Armor Class' minimum={0} />}
            </form.AppField>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['hitPoints'])}>
              {(field) => <field.NumberField label='Hit Points' minimum={0} />}
            </form.AppField>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['speed'])}>
              {(field) => <field.NumberField label='Speed' minimum={0} />}
            </form.AppField>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['speedNote'])}>
              {(field) => (
                <field.TextField label='Speed note' placeholder='Optional movement note' />
              )}
            </form.AppField>
          </div>
        ) : null}

        {screen === 2 ? (
          <div className={styles.fields}>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['crewMin'])}>
              {(field) => <field.NumberField label='Minimum crew' minimum={0} />}
            </form.AppField>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['crewMax'])}>
              {(field) => <field.NumberField label='Maximum crew' minimum={0} />}
            </form.AppField>
            <form.AppField
              name={toTypedAuthoringFieldName<object>(undefined, ['passengerCapacity'])}
            >
              {(field) => <field.NumberField label='Passenger capacity' minimum={0} />}
            </form.AppField>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['cargoCapacity'])}>
              {(field) => <field.TextField label='Cargo capacity' placeholder='e.g. 2 tons' />}
            </form.AppField>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['cost', 'amount'])}>
              {(field) => <field.NumberField label='Cost' minimum={0} />}
            </form.AppField>
            <form.AppField
              name={toTypedAuthoringFieldName<object>(undefined, ['cost', 'currencyId'])}
            >
              {(field) => (
                <field.SelectField
                  data={(session.system?.currencies ?? []).map((currency) => ({
                    label: currency.label,
                    value: currency.id
                  }))}
                  label='Currency'
                />
              )}
            </form.AppField>
          </div>
        ) : null}

        {screen === 3 ? (
          <GuidedFeatureAccordion
            features={features}
            system={session.system!}
            onChange={setFeatures}
          />
        ) : null}

        {screen === 4 ? (
          <Stack gap='md'>
            <Text fw={600}>{label || 'Untitled Vehicle'}</Text>
            <dl className={styles.summary}>
              <div className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>Category</dt>
                <dd className={styles.summaryValue}>
                  {readString(values, 'category') || 'Not set'}
                </dd>
              </div>
              <div className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>Performance</dt>
                <dd className={styles.summaryValue}>
                  {summaryStat(values, 'armorClass', 'AC')} ·{' '}
                  {summaryStat(values, 'hitPoints', 'HP')} · {summaryStat(values, 'speed', 'Speed')}
                </dd>
              </div>
              <div className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>Features</dt>
                <dd className={styles.summaryValue}>{features.length || 'None yet'}</dd>
              </div>
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

function readString(values: object, key: string): string {
  const value = readField(values, key)
  return typeof value === 'string' ? value : ''
}

function readFeatures(values: object): FeatureDto[] {
  const value = readField(values, 'features')
  return Array.isArray(value)
    ? value.filter(
        (item): item is FeatureDto =>
          typeof item === 'object' && item !== null && 'id' in item && 'order' in item
      )
    : []
}

function summaryStat(values: object, key: string, label: string): string {
  const value = readField(values, key)
  return typeof value === 'number' ? `${label} ${value}` : `${label} —`
}

function hasAdvancedData(values: object): boolean {
  const value = readField(values, 'properties')
  const features = readFeatures(values)
  return (
    (Array.isArray(value) && value.length > 0) ||
    features.some((feature) =>
      Boolean(
        feature.effects?.length || feature.grants || feature.restrictions || feature.options?.length
      )
    )
  )
}
