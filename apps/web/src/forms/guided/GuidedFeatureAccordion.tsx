import { useEffect, useRef, useState } from 'react'
import {
  Accordion,
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { GuidedSimpleEffectComposer } from './GuidedSimpleEffectComposer'
import { rehydrateGuidedSpell } from './guidedSimpleEffect.rehydrate'
import type { GuidedEffectIds } from './guidedSimpleEffect.types'
import * as styles from './guidedAuthoring.css'
import { findOption } from '#forms/utils/valueGuards'
import RichTextEditor from '#ui/primitives/RichTextEditor'

const USAGE_OPTIONS = [
  { value: 'TRAIT', label: 'Passive' },
  { value: 'ACTION', label: 'Action' },
  { value: 'BONUS_ACTION', label: 'Bonus action' },
  { value: 'REACTION', label: 'Reaction' }
] as const

const RESET_OPTIONS = [
  { value: 'SHORT_REST', label: 'Short rest' },
  { value: 'LONG_REST', label: 'Long rest' },
  { value: 'DAWN', label: 'Dawn' }
] as const

const OUTCOME_OPTIONS = [
  { value: 'DESCRIPTION', label: 'Description only' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'CONDITION', label: 'Condition' },
  { value: 'HEALING', label: 'Healing' },
  { value: 'MOVEMENT', label: 'Movement' }
] as const

type FeatureOutcome = (typeof OUTCOME_OPTIONS)[number]['value']

type GuidedFeatureAccordionProps = {
  features: readonly FeatureDto[]
  onChange: (features: FeatureDto[]) => void
  showAvailableLevel?: boolean
  label?: string
  system: NonNullable<SystemResponseDto>
}

export function GuidedFeatureAccordion({
  features,
  label = 'Features',
  onChange,
  showAvailableLevel = false,
  system
}: GuidedFeatureAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(features[0]?.id ?? null)
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (!openId) return
    const frame = requestAnimationFrame(() => nameRefs.current[openId]?.focus())
    return () => cancelAnimationFrame(frame)
  }, [openId])

  const updateFeature = (id: string, patch: Partial<FeatureDto>) => {
    onChange(features.map((feature) => (feature.id === id ? { ...feature, ...patch } : feature)))
  }

  const addFeature = () => {
    const feature: FeatureDto = {
      id: crypto.randomUUID(),
      label: '',
      description: '',
      order: features.length + 1
    }
    onChange([...features, feature])
    setOpenId(feature.id)
  }

  const removeFeature = (id: string) => {
    const next = features
      .filter((feature) => feature.id !== id)
      .map((feature, index) => ({ ...feature, order: index + 1 }))
    onChange(next)
    setOpenId(next[0]?.id ?? null)
  }

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='center'>
        <Text fw={600}>{label}</Text>
        <Button type='button' variant='light' onClick={addFeature}>
          Add feature
        </Button>
      </Group>

      {features.length === 0 ? (
        <Alert color='gray'>
          Add a feature when this item needs a named trait, action, or benefit.
        </Alert>
      ) : (
        <Accordion value={openId} onChange={setOpenId} variant='separated' chevronPosition='left'>
          {features.map((feature) => {
            const usage = feature.section ? usageLabel(feature.section) : 'Passive'
            const outcome = readOutcome(feature)
            const limited = Boolean(feature.charges)
            const simpleCharge =
              feature.charges && isSimpleCharge(feature.charges) ? feature.charges : undefined
            const hasValidationError = !feature.label.trim()

            return (
              <Accordion.Item key={feature.id} value={feature.id}>
                <Accordion.Control>
                  <div className={styles.featureSummary}>
                    <Text fw={600}>{feature.label.trim() || 'Untitled feature'}</Text>
                    <Text size='sm' c='dimmed'>
                      {usage} · {outcomeLabel(outcome)} · {limited ? 'Limited uses' : 'At will'}
                      {hasValidationError ? ' · Name required' : ''}
                    </Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap='md'>
                    <TextInput
                      ref={(element) => {
                        nameRefs.current[feature.id] = element
                      }}
                      label='Feature name'
                      placeholder='A short name players can scan'
                      required
                      value={feature.label}
                      onChange={(event) =>
                        updateFeature(feature.id, { label: event.currentTarget.value })
                      }
                    />
                    <RichTextEditor
                      label='Description'
                      name={`feature-${feature.id}-description`}
                      placeholder='Describe what this feature does.'
                      value={feature.description}
                      onChange={(description) => updateFeature(feature.id, { description })}
                    />
                    <div className={styles.fields}>
                      {showAvailableLevel ? (
                        <NumberInput
                          label='Available at level'
                          min={1}
                          max={20}
                          value={feature.availableAtLevel ?? ''}
                          onChange={(value) =>
                            updateFeature(feature.id, {
                              availableAtLevel: typeof value === 'number' ? value : undefined
                            })
                          }
                        />
                      ) : null}
                      <Select
                        label='How is it used?'
                        data={USAGE_OPTIONS}
                        value={feature.section ?? 'TRAIT'}
                        onChange={(value) =>
                          updateFeature(feature.id, {
                            section:
                              findOption(
                                USAGE_OPTIONS.map((option) => option.value),
                                value
                              ) ?? 'TRAIT'
                          })
                        }
                      />
                    </div>

                    <GuidedSimpleEffectComposer
                      effects={feature.effects ?? []}
                      system={system}
                      onChange={(effects) => updateFeature(feature.id, { effects })}
                    />

                    <Select
                      label='Does it have limited uses?'
                      data={[
                        { value: 'no', label: 'No, use it whenever it applies' },
                        { value: 'yes', label: 'Yes, it has a resettable limit' }
                      ]}
                      value={limited ? 'yes' : 'no'}
                      onChange={(value) => {
                        if (value === 'no' && feature.charges && !isSimpleCharge(feature.charges))
                          return
                        updateFeature(feature.id, {
                          charges:
                            value === 'yes' ? (feature.charges ?? createFeatureCharge()) : undefined
                        })
                      }}
                    />
                    {simpleCharge ? (
                      <div className={styles.fields}>
                        <NumberInput
                          label='Uses'
                          min={1}
                          max={100}
                          value={simpleCharge.amount}
                          onChange={(value) =>
                            updateFeature(feature.id, {
                              charges: {
                                ...simpleCharge,
                                amount: typeof value === 'number' ? value : 1
                              }
                            })
                          }
                        />
                        <Select
                          label='Reset timing'
                          data={RESET_OPTIONS}
                          value={simpleCharge.resetKind}
                          onChange={(value) =>
                            updateFeature(feature.id, {
                              charges: {
                                ...simpleCharge,
                                resetKind:
                                  findOption(
                                    RESET_OPTIONS.map((option) => option.value),
                                    value
                                  ) ?? 'LONG_REST'
                              }
                            })
                          }
                        />
                      </div>
                    ) : null}

                    {feature.charges && !isSimpleCharge(feature.charges) ? (
                      <Alert color='blue' title='Advanced charge model preserved'>
                        This feature uses a scaling or source-based charge model. Guided keeps it
                        intact; switch to Advanced to change or remove it.
                      </Alert>
                    ) : null}

                    {hasUnsupportedMechanics(feature) ? (
                      <Alert color='blue' title='Some details require Advanced'>
                        This feature has advanced grants, restrictions, or effects. Guided keeps
                        them intact; switch to Advanced to edit those mechanics.
                      </Alert>
                    ) : null}

                    <Group justify='flex-end'>
                      <Button
                        type='button'
                        color='red'
                        variant='light'
                        onClick={() => removeFeature(feature.id)}
                      >
                        Remove feature
                      </Button>
                    </Group>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )
          })}
        </Accordion>
      )}
    </Stack>
  )
}

function createFeatureCharge(): NonNullable<FeatureDto['charges']> {
  return {
    id: crypto.randomUUID(),
    amount: 1,
    resetKind: 'LONG_REST',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE'
  }
}

function isSimpleCharge(
  charge: NonNullable<FeatureDto['charges']>
): charge is Extract<
  NonNullable<FeatureDto['charges']>,
  { limitKind: 'FIXED_AMOUNT'; scalingKind: 'NONE' }
> {
  return charge.limitKind === 'FIXED_AMOUNT' && charge.scalingKind === 'NONE'
}

function usageLabel(value: NonNullable<FeatureDto['section']>): string {
  return USAGE_OPTIONS.find((option) => option.value === value)?.label ?? 'Passive'
}

function outcomeLabel(value: FeatureOutcome): string {
  return OUTCOME_OPTIONS.find((option) => option.value === value)?.label ?? 'Description only'
}

function readOutcome(feature: FeatureDto): FeatureOutcome {
  if (feature.effects?.length !== 1) return 'DESCRIPTION'
  return rehydrateGuidedSpell(feature.effects, SUMMARY_EFFECT_IDS)?.draft.intent ?? 'DESCRIPTION'
}

function hasUnsupportedMechanics(feature: FeatureDto): boolean {
  return Boolean(
    (feature.effects?.length && !rehydrateGuidedSpell(feature.effects, SUMMARY_EFFECT_IDS)) ||
    feature.grants ||
    feature.restrictions ||
    feature.options?.length ||
    feature.optionChoices?.length ||
    feature.details?.length
  )
}

const SUMMARY_EFFECT_IDS: GuidedEffectIds = {
  durationId: 'summary-duration',
  outcomeId: 'summary-outcome',
  savingThrowId: 'summary-save'
}
