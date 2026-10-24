import { useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-form'
import { Alert, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { EffectDto } from '@artificer-toolkit/schema/effects'
import type { ChargeDto, DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import { GuidedSimpleEffectComposer } from '#forms/guided/GuidedSimpleEffectComposer'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import * as styles from '#forms/guided/guidedAuthoring.css'
import RichTextEditor from '#ui/primitives/RichTextEditor'
import { EMPTY_GUIDED_FORM_VALUES, readField, readString } from '#forms/guided/guidedValues'
import { findOption, isRecord } from '#forms/utils/valueGuards'

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

export const GuidedFeatAuthoring = withForm({
  defaultValues: EMPTY_GUIDED_FORM_VALUES,
  props: {} as GuidedDomainAuthoringProps,
  render: function RenderGuidedFeatAuthoring({ form, onAdvanced, onStateChange, session, system }) {
    const [screen, setScreen] = useState(0)
    const values = useSelector(form.store, (state) => state.values)
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
              <Alert color='blue' title='Some details require Advanced'>
                This feat contains advanced effects or grants. Guided keeps them intact while you
                edit the common fields.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
                {(field) => (
                  <field.TextField
                    label='Feat name'
                    placeholder='A feat your table will remember'
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
                  placeholder='Describe the feat in plain language.'
                />
              )}
            </form.AppField>
          </Stack>
        ) : null}
        {screen === 1 ? (
          <FeatOutcomeEditor
            charges={charges}
            details={details}
            effects={effects}
            system={system}
            onChargesChange={setCharges}
            onDetailsChange={setDetails}
            onEffectsChange={setEffects}
          />
        ) : null}
        {screen === 2 ? (
          <GuidedFeatureAccordion features={features} system={system} onChange={setFeatures} />
        ) : null}
        {screen === 3 ? (
          <Stack gap='md'>
            <Text fw={600}>{label || 'Untitled Feat'}</Text>
            <dl className={styles.summary}>
              <GuidedSummaryRow
                label='Core outcome'
                value={
                  effects.length ? 'Configured' : details[0]?.description || 'Not yet described'
                }
              />
              <GuidedSummaryRow label='Limited uses' value={formatCharge(charges)} />
              <GuidedSummaryRow label='Features' value={String(features.length || 'None yet')} />
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
      <RichTextEditor
        label='Description'
        name={`feat-outcome-${detail.id}-description`}
        placeholder='Describe the benefit in player-facing language.'
        value={detail.description}
        onChange={(description) =>
          onDetailsChange([{ ...detail, description }, ...details.slice(1)])
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
            data={RESET_OPTIONS}
            value={charges.resetKind}
            onChange={(value) =>
              onChargesChange({
                ...charges,
                resetKind:
                  findOption(
                    RESET_OPTIONS.map((option) => option.value),
                    value
                  ) ?? 'LONG_REST'
              })
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

const RESET_OPTIONS = [
  { value: 'SHORT_REST', label: 'Short rest' },
  { value: 'LONG_REST', label: 'Long rest' },
  { value: 'DAWN', label: 'Dawn' }
] as const

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

function readDetails(values: object): DetailDto[] {
  const value = readField(values, 'details')
  return Array.isArray(value)
    ? value.filter(
        (item): item is DetailDto =>
          typeof item === 'object' && item !== null && 'id' in item && 'description' in item
      )
    : []
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

function readEffects(values: object): unknown[] {
  const value = readField(values, 'effects')
  return Array.isArray(value) ? value : []
}

function readCharge(values: object): ChargeDto | undefined {
  const value = readField(values, 'charges')
  return isRecord(value) && 'id' in value && 'resetKind' in value
    ? { ...createCharge(), ...value }
    : undefined
}

function readGrants(values: object): boolean {
  const value = readField(values, 'grants')
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).some((item) => Array.isArray(item) && item.length > 0)
  )
}

function formatReset(value: ChargeDto['resetKind']): string {
  return value.toLowerCase().replace('_', ' ')
}
