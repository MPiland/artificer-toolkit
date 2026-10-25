import { useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-form'
import { Alert, Stack, Text, TextInput } from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { EffectDto } from '@artificer-toolkit/schema/effects'
import type { ChargeDto, DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedChargeFields } from '#forms/guided/GuidedChargeFields'
import { createCharge, isSimpleCharge } from '#forms/guided/guidedCharge'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import { GuidedSimpleEffectComposer } from '#forms/guided/GuidedSimpleEffectComposer'
import * as styles from '#forms/guided/guidedAuthoring.css'
import RichTextEditor from '#ui/primitives/RichTextEditor'
import {
  EMPTY_GUIDED_FORM_VALUES,
  guidedField,
  readGuidedValues,
  toDetails,
  toFeatures
} from '#forms/guided/guidedValues'

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
    const draft = readGuidedValues('feat', values)
    const label = draft.label ?? ''
    const details = toDetails(draft.details)
    const features = toFeatures(draft.features)
    const effects = draft.effects ?? []
    const charges = draft.charges ? { ...createCharge(), ...draft.charges } : undefined

    useEffect(() => {
      onStateChange({ isReview: screen === 3, showPreview: screen > 0 || Boolean(label) })
    }, [label, onStateChange, screen])

    const canContinue = screen === 0 ? Boolean(label.trim()) : true
    const setDetails = (next: DetailDto[]) =>
      form.setFieldValue(guidedField('feat', 'details'), next)
    const setFeatures = (next: FeatureDto[]) =>
      form.setFieldValue(guidedField('feat', 'features'), next)
    const setCharges = (next: ChargeDto | undefined) =>
      form.setFieldValue(guidedField('feat', 'charges'), next)
    const setEffects = (next: EffectDto[]) =>
      form.setFieldValue(guidedField('feat', 'effects'), next)

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
            {session.mode === 'edit' && (effects.length > 1 || hasGrants(draft.grants)) ? (
              <Alert color='blue' title='Some details require Advanced'>
                This feat contains advanced effects or grants. Guided keeps them intact while you
                edit the common fields.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={guidedField('feat', 'label')}>
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
            <form.AppField name={guidedField('feat', 'description')}>
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
      <GuidedChargeFields charges={charges} subject='feat' onChange={onChargesChange} />
    </Stack>
  )
}

function formatCharge(charge: ChargeDto | undefined): string {
  if (!charge) return 'At will'
  if (!isSimpleCharge(charge)) return 'Advanced charge model'
  return `${charge.amount} per ${formatReset(charge.resetKind)}`
}

function hasGrants(grants: object | undefined): boolean {
  return Object.values(grants ?? {}).some((item) => Array.isArray(item) && item.length > 0)
}

function formatReset(value: ChargeDto['resetKind']): string {
  return value.toLowerCase().replace('_', ' ')
}
