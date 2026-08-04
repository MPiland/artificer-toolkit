import { useEffect, useState } from 'react'
import { useStore } from '@tanstack/react-form'
import { Alert, NumberInput, Select, Stack, Text, Textarea, TextInput } from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { EffectDto } from '@artificer-toolkit/schema/effects'
import type { ChargeDto, DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { AuthoredFormSession } from '#forms/factories/authoredFormFactories.types'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import type { GuidedAuthoringStateHandler } from '#forms/guided/guidedAuthoring.types'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import { GuidedSimpleEffectComposer } from '#forms/guided/GuidedSimpleEffectComposer'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import * as styles from '#forms/guided/guidedAuthoring.css'

const STEPS = ['Basics', 'Core outcome', 'Features', 'Review'] as const
const TITLES = [
  'Name your feat',
  'Describe the core outcome',
  'Add supporting features',
  'Review your feat'
] as const
const DESCRIPTIONS = [
  'Give this feat a memorable identity.',
  'Keep the primary benefit clear and easy to understand.',
  'Add named traits or actions players can scan.',
  'Check the essentials before saving.'
] as const

type Props = {
  session: AuthoredFormSession
  onAdvanced: () => void
  onStateChange: GuidedAuthoringStateHandler
}

export const GuidedFeatAuthoring = withForm({
  defaultValues: {} as object,
  props: {} as Props,
  render: function RenderGuidedFeatAuthoring({ form, onAdvanced, onStateChange, session }) {
    const [screen, setScreen] = useState(0)
    const values = useStore(form.store, (state) => state.values)
    const label = readString(values, 'label')
    const details = readDetails(values)
    const features = readFeatures(values)
    const effects = readEffects(values)
    const charges = readCharge(values)

    useEffect(() => {
      onStateChange({ isReview: screen === 3, showPreview: screen > 0 || Boolean(label) })
    }, [label, onStateChange, screen])

    const canContinue = screen === 0 ? Boolean(label.trim()) : true
    const setDetails = (next: DetailDto[]) =>
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['details']), next)
    const setFeatures = (next: FeatureDto[]) =>
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['features']), next)
    const setCharges = (next: ChargeDto | undefined) =>
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['charges']), next)
    const setEffects = (next: EffectDto[]) =>
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['effects']), next)

    return (
      <GuidedAuthoringFrame
        canContinue={canContinue}
        description={DESCRIPTIONS[screen]}
        domainLabel='Feat'
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
            {session.mode === 'edit' && (effects.length > 1 || readGrants(values)) ? (
              <Alert color='blue' title='Advanced mechanics preserved'>
                This feat contains advanced effects or grants. Guided keeps them intact while you
                edit the common fields.
              </Alert>
            ) : null}
            <div className={styles.fields}>
              <div className={styles.full}>
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
                  {(field) => (
                    <field.TextField
                      label='Feat name'
                      placeholder='A feat your table will remember'
                      required
                    />
                  )}
                </form.AppField>
              </div>
              <div className={styles.full}>
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['description'])}>
                  {(field) => (
                    <field.TextareaField
                      label='What should players know?'
                      placeholder='Describe the feat in plain language.'
                    />
                  )}
                </form.AppField>
              </div>
            </div>
          </Stack>
        ) : null}
        {screen === 1 ? (
          <FeatOutcomeEditor
            charges={charges}
            details={details}
            effects={effects}
            system={session.system!}
            onChargesChange={setCharges}
            onDetailsChange={setDetails}
            onEffectsChange={setEffects}
          />
        ) : null}
        {screen === 2 ? (
          <GuidedFeatureAccordion
            features={features}
            system={session.system!}
            onChange={setFeatures}
          />
        ) : null}
        {screen === 3 ? (
          <Stack gap='md'>
            <Text fw={600}>{label || 'Untitled Feat'}</Text>
            <dl className={styles.summary}>
              <div className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>Core outcome</dt>
                <dd className={styles.summaryValue}>
                  {effects.length ? 'Configured' : details[0]?.description || 'Not yet described'}
                </dd>
              </div>
              <div className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>Limited uses</dt>
                <dd className={styles.summaryValue}>{formatCharge(charges)}</dd>
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

function FeatOutcomeEditor({
  details,
  charges,
  effects,
  system,
  onDetailsChange,
  onChargesChange,
  onEffectsChange
}: {
  details: DetailDto[]
  charges?: ChargeDto
  effects: unknown[]
  system: NonNullable<SystemResponseDto>
  onDetailsChange: (next: DetailDto[]) => void
  onChargesChange: (next: ChargeDto | undefined) => void
  onEffectsChange: (next: EffectDto[]) => void
}) {
  const detail = details[0] ?? {
    id: crypto.randomUUID(),
    label: 'Core outcome',
    description: '',
    order: 1
  }
  return (
    <Stack gap='md'>
      <TextInput
        label='Outcome name'
        value={detail.label}
        onChange={(event) =>
          onDetailsChange([{ ...detail, label: event.currentTarget.value }, ...details.slice(1)])
        }
      />
      <Textarea
        label='What does it do?'
        minRows={4}
        placeholder='Describe the benefit in player-facing language.'
        value={detail.description}
        onChange={(event) =>
          onDetailsChange([
            { ...detail, description: event.currentTarget.value },
            ...details.slice(1)
          ])
        }
      />
      <GuidedSimpleEffectComposer effects={effects} system={system} onChange={onEffectsChange} />
      <Select
        label='Does it have limited uses?'
        data={[
          { value: 'no', label: 'No, use it whenever it applies' },
          { value: 'yes', label: 'Yes, it has a resettable limit' }
        ]}
        value={charges ? 'yes' : 'no'}
        onChange={(value) => {
          if (value === 'no' && charges && !isSimpleCharge(charges)) return
          onChargesChange(value === 'yes' ? (charges ?? createCharge()) : undefined)
        }}
      />
      {charges && isSimpleCharge(charges) ? (
        <div className={styles.fields}>
          <NumberInput
            label='Uses'
            min={1}
            value={charges.amount ?? 1}
            onChange={(value) =>
              onChargesChange({
                ...charges,
                amount: typeof value === 'number' ? value : 1
              } as ChargeDto)
            }
          />
          <Select
            label='Reset timing'
            data={[
              { value: 'SHORT_REST', label: 'Short rest' },
              { value: 'LONG_REST', label: 'Long rest' },
              { value: 'DAWN', label: 'Dawn' }
            ]}
            value={charges.resetKind}
            onChange={(value) =>
              onChargesChange({
                ...charges,
                resetKind: (value ?? 'LONG_REST') as ChargeDto['resetKind']
              } as ChargeDto)
            }
          />
        </div>
      ) : null}
      {charges && !isSimpleCharge(charges) ? (
        <Alert color='blue' title='Advanced charge model preserved'>
          This feat uses a scaling or source-based charge model. Guided keeps it intact; switch to
          Advanced to change or remove it.
        </Alert>
      ) : null}
    </Stack>
  )
}

function createCharge(): ChargeDto {
  return {
    id: crypto.randomUUID(),
    resetKind: 'LONG_REST',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    amount: 1
  }
}

function formatCharge(charge: ChargeDto | undefined): string {
  if (!charge) return 'At will'
  if (!isSimpleCharge(charge)) return 'Advanced charge model'
  return `${charge.amount} per ${formatReset(charge.resetKind)}`
}

function isSimpleCharge(
  charge: ChargeDto
): charge is Extract<ChargeDto, { limitKind: 'FIXED_AMOUNT'; scalingKind: 'NONE' }> {
  return charge.limitKind === 'FIXED_AMOUNT' && charge.scalingKind === 'NONE'
}

function readString(values: object, key: string): string {
  const value = (values as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function readDetails(values: object): DetailDto[] {
  const value = (values as Record<string, unknown>).details
  return Array.isArray(value)
    ? value.filter(
        (item): item is DetailDto =>
          typeof item === 'object' && item !== null && 'id' in item && 'description' in item
      )
    : []
}

function readFeatures(values: object): FeatureDto[] {
  const value = (values as Record<string, unknown>).features
  return Array.isArray(value)
    ? value.filter(
        (item): item is FeatureDto =>
          typeof item === 'object' && item !== null && 'id' in item && 'order' in item
      )
    : []
}

function readEffects(values: object): unknown[] {
  const value = (values as Record<string, unknown>).effects
  return Array.isArray(value) ? value : []
}

function readCharge(values: object): ChargeDto | undefined {
  const value = (values as Record<string, unknown>).charges
  return typeof value === 'object' && value !== null && 'id' in value && 'resetKind' in value
    ? (value as ChargeDto)
    : undefined
}

function readGrants(values: object): boolean {
  const value = (values as Record<string, unknown>).grants
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).some((item) => Array.isArray(item) && item.length > 0)
  )
}

function formatReset(value: ChargeDto['resetKind']): string {
  return value.toLowerCase().replace('_', ' ')
}
