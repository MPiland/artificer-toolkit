import { Group, NumberInput, Stack, Text } from '@mantine/core'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import type { SelectOption } from '#forms/utils/formUtils'
import { AppSelect } from '#ui/primitives/Select'
import {
  isAbilityAssignmentOption,
  isCharacterAbilityCode,
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
  getPointBuyCost,
  onChange,
  pointBuySpent,
  pointBuyTotalPoints,
  readOnly,
  slots
}: {
  abilityMethod: CharacterAbilityGenerationMethod
  abilityOptions: SelectOption[]
  assignmentOptions: SelectOption[]
  getPointBuyCost: (score: string | undefined) => number
  onChange: (slots: CharacterAbilityDraftSlot[]) => void
  pointBuySpent: number
  pointBuyTotalPoints: number
  readOnly: boolean
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
                <NumberInput
                  label='Score'
                  aria-label={`Score for assignment ${index + 1}`}
                  value={slot.score ?? ''}
                  allowDecimal={false}
                  required
                  disabled={readOnly}
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
              ) : (
                <AppSelect
                  label='Score'
                  aria-label={`Score for assignment ${index + 1}`}
                  data={scoreOptions}
                  value={slot.option ?? null}
                  required
                  clearable
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
                  disabled: isCharacterAbilityCode(option.value) && usedAbilities.has(option.value)
                }))}
                value={slot.ability ?? null}
                required
                clearable
                disabled={readOnly}
                onChange={(value) =>
                  onChange(
                    slots.map((candidate, slotIndex) =>
                      slotIndex === index
                        ? {
                            ...candidate,
                            ability: value && isCharacterAbilityCode(value) ? value : undefined
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
