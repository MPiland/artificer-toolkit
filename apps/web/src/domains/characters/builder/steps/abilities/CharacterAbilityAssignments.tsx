import { Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import type { SelectOption } from '#forms/utils/formUtils'
import { AppSelect } from '#ui/primitives/Select'
import {
  isAbilityAssignmentOption,
  type CharacterAbilityDraftSlot,
  type CharacterAbilityGenerationMethod
} from './abilityGeneration'
import { formatPointDelta } from './abilityFormatting'
import * as sharedStyles from '../../shared/builderShared.css'
import * as styles from './characterAbilities.css'

export function CharacterAbilityAssignments({
  abilityMethod,
  abilityOptions,
  assignmentOptions,
  configuration,
  configurationError,
  getPointBuyCost,
  isRolling,
  onChange,
  onConfigurationChange,
  onRoll,
  pointBuySpent,
  pointBuyTotalPoints,
  readOnly,
  rollingSlotIndex,
  slots
}: {
  abilityMethod: CharacterAbilityGenerationMethod
  abilityOptions: SelectOption[]
  assignmentOptions: SelectOption[]
  configuration: string
  configurationError?: string
  getPointBuyCost: (score: string | undefined) => number
  isRolling: boolean
  onChange: (slots: CharacterAbilityDraftSlot[]) => void
  onConfigurationChange: (configuration: string) => void
  onRoll: (slotIndex: number) => void
  pointBuySpent: number
  pointBuyTotalPoints: number
  readOnly: boolean
  rollingSlotIndex?: number
  slots: CharacterAbilityDraftSlot[]
}) {
  return (
    <Stack gap='sm' className={sharedStyles.inlinePanel}>
      <Group justify='space-between'>
        <Text fw={700}>Ability assignments</Text>
        {abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY ? (
          <Text size='sm'>{pointBuyTotalPoints - pointBuySpent} points remaining</Text>
        ) : null}
      </Group>
      {abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED ? (
        <TextInput
          className={styles.abilityRollConfiguration}
          label='Roll configuration'
          description='Example: 4d6dl1r1 rerolls 1s and drops the lowest die.'
          value={configuration}
          error={configurationError}
          disabled={readOnly || isRolling}
          onChange={(event) => onConfigurationChange(event.currentTarget.value)}
        />
      ) : null}
      <div className={styles.abilityAssignmentGrid}>
        {slots.map((slot, index) => {
          const usedAbilities = new Set(
            slots
              .filter((_, slotIndex) => slotIndex !== index)
              .map((candidate) => candidate.ability)
              .filter((ability) => ability !== undefined)
          )
          const usedStandardScores = new Set(
            slots
              .filter((_, slotIndex) => slotIndex !== index)
              .map((candidate) => candidate.option)
              .filter((option) => option !== undefined)
          )
          const currentPointBuyCost = getPointBuyCost(slot.option)
          const scoreOptions = assignmentOptions.map((option) => {
            const nextPointBuyCost = getPointBuyCost(option.value)

            return {
              ...option,
              disabled:
                abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
                  ? usedStandardScores.has(option.value)
                  : abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
                    ? pointBuySpent - currentPointBuyCost + nextPointBuyCost > pointBuyTotalPoints
                    : false
            }
          })

          return (
            <div key={`ability-slot-${index}`} className={styles.abilityAssignmentSlot}>
              {abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED ? (
                <>
                  <NumberInput
                    label='Score'
                    aria-label={`Score for assignment ${index + 1}`}
                    value={slot.score ?? ''}
                    allowDecimal={false}
                    required
                    disabled={readOnly || isRolling}
                    onChange={(value) =>
                      onChange(
                        slots.map((candidate, slotIndex) =>
                          slotIndex === index
                            ? {
                                ...candidate,
                                score: typeof value === 'number' ? Math.trunc(value) : undefined
                              }
                            : candidate
                        )
                      )
                    }
                  />
                  <Button
                    type='button'
                    size='xs'
                    variant='light'
                    disabled={readOnly || isRolling || Boolean(configurationError)}
                    loading={isRolling && rollingSlotIndex === index}
                    onClick={() => onRoll(index)}
                  >
                    Roll
                  </Button>
                </>
              ) : (
                <AppSelect
                  label='Score'
                  aria-label={`Score for assignment ${index + 1}`}
                  data={scoreOptions}
                  value={slot.option ?? null}
                  required
                  clearable
                  searchable={false}
                  disabled={readOnly}
                  renderOption={
                    abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
                      ? ({ option }) => {
                          const pointDelta = currentPointBuyCost - getPointBuyCost(option.value)
                          return (
                            <Text size='sm'>{`${option.label} (${formatPointDelta(pointDelta)})`}</Text>
                          )
                        }
                      : undefined
                  }
                  onChange={(value) =>
                    onChange(
                      slots.map((candidate, slotIndex) =>
                        slotIndex === index
                          ? {
                              ...candidate,
                              option: value && isAbilityAssignmentOption(value) ? value : undefined
                            }
                          : candidate
                      )
                    )
                  }
                />
              )}
              <AppSelect
                label='Ability'
                aria-label={`Ability for assignment ${index + 1}`}
                data={abilityOptions.map((option) => ({
                  ...option,
                  disabled: usedAbilities.has(option.value)
                }))}
                value={slot.ability ?? null}
                required
                clearable
                searchable={false}
                disabled={readOnly}
                onChange={(value) =>
                  onChange(
                    slots.map((candidate, slotIndex) =>
                      slotIndex === index
                        ? {
                            ...candidate,
                            ability: abilityOptions.find((option) => option.value === value)?.value
                          }
                        : candidate
                    )
                  )
                }
              />
            </div>
          )
        })}
      </div>
    </Stack>
  )
}
