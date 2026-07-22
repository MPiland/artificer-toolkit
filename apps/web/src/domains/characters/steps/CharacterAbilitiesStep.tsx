import { useEffect } from 'react'
import { Group, NumberInput, Stack, Text } from '@mantine/core'
import {
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import {
  cacheActiveAbilityIntent,
  createFallbackCharacterFormValues,
  getAbilityDraftSlots,
  getAbilityGenerationMethod,
  isAbilityAssignmentOption,
  isCharacterAbilityCode,
  selectOptions,
  setAbilityDraftSlots
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import {
  getHitpointAbilityModifier,
  getHitpointDieSides,
  syncHitpointLevels
} from './CharacterAbilitiesStep.utils'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

export const CharacterAbilitiesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterAbilities({ form, payload, readOnly }) {
    const abilityOptions = selectOptions(payload.references.abilities)
    const abilityMethodOptions = selectOptions(payload.references.abilityGenerationMethods)
    const hitpointMethodOptions = selectOptions(payload.references.hitpointCalculationMethods)
    const standardArrayOptions = selectOptions(payload.references.standardArrayScores)
    const pointBuyOptions = selectOptions(payload.references.pointBuyScores)
    const pointBuyCosts = new Map(
      payload.references.pointBuyScores.map((option) => [option.id, option.cost])
    )
    const getPointBuyCost = (score: string | undefined) => score
      ? pointBuyCosts.get(score) ?? 0
      : 0
    const pointBuyTotalPoints = payload.references.pointBuyTotalPoints
    const hitpointRows = syncHitpointLevels({
      character: form.state.values,
      classReferences: payload.references.classes,
      resolvedAbilityScores: payload.resolution.summary.abilities,
      rows: form.state.values.intent.hitpoints.levels
    })
    const hitpointRowsFingerprint = JSON.stringify(hitpointRows)

    useEffect(() => {
      if (JSON.stringify(form.state.values.intent.hitpoints.levels) === hitpointRowsFingerprint) return
      form.setFieldValue('intent.hitpoints.levels', hitpointRows)
    }, [form, hitpointRows, hitpointRowsFingerprint])

    return (
      <div className={styles.section}>
        <form.AppField name='intent.abilities'>
          {(abilityField) => {
            const abilityMethod = abilityField.state.value.method
            const assignmentOptions = abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
              ? pointBuyOptions
              : standardArrayOptions
            const slots = getAbilityDraftSlots(
              form.state.values.builderIntent?.abilities,
              abilityField.state.value
            )
            const pointBuySpent = abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
              ? slots.reduce((total, slot) => total + getPointBuyCost(slot.option), 0)
              : 0

            const updateSlots = (nextSlots: typeof slots) => {
              const next = setAbilityDraftSlots(
                form.state.values.builderIntent?.abilities,
                abilityField.state.value,
                abilityMethod,
                nextSlots
              )
              abilityField.handleChange(next.abilities)
              form.setFieldValue('builderIntent.abilities', next.cache)
            }

            return (
              <>
                <div className={styles.fieldGrid}>
                  <div className={styles.fieldSpan6}>
                    <AppSelect
                      label='Ability Method'
                      data={abilityMethodOptions}
                      value={abilityMethod}
                      disabled={readOnly}
                      onChange={(value) => {
                        const method = getAbilityGenerationMethod(value ?? '')
                        if (!method) return
                        const cache = cacheActiveAbilityIntent(form.state.values.builderIntent?.abilities, abilityField.state.value)
                        const next = setAbilityDraftSlots(
                          cache,
                          abilityField.state.value,
                          method,
                          getAbilityDraftSlots(cache, abilityField.state.value, method)
                        )

                        abilityField.handleChange(next.abilities)
                        form.setFieldValue('builderIntent.abilities', next.cache)
                      }}
                    />
                  </div>
                  <div className={styles.fieldSpan6}>
                    <form.AppField name='intent.hitpoints'>
                      {(field) => (
                        <AppSelect
                          label='Hit Point Method'
                          data={hitpointMethodOptions}
                          value={field.state.value.method}
                          required
                          disabled={readOnly}
                          onChange={(value) => {
                            if (!value) return
                            if (value !== HITPOINT_CALCULATION_METHOD_CODE.FIXED && value !== HITPOINT_CALCULATION_METHOD_CODE.MANUAL) return

                            field.handleChange({
                              ...field.state.value,
                              method: value,
                              levels: value === HITPOINT_CALCULATION_METHOD_CODE.MANUAL
                                ? field.state.value.levels.map((level, index) => index === 0
                                  ? level
                                  : { ...level, rolls: undefined, overridden: false })
                                : field.state.value.levels
                            })
                          }}
                        />
                      )}
                    </form.AppField>
                  </div>
                </div>
                <Stack gap='sm' className={styles.inlinePanel}>
                  <Group justify='space-between'>
                    <Text fw={700}>Ability assignments</Text>
                    {abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
                      ? <Text size='sm'>{pointBuyTotalPoints - pointBuySpent} points remaining</Text>
                      : null}
                  </Group>
                  <div className={styles.abilityAssignmentGrid}>
                    {slots.map((slot, index) => {
                      const usedAbilities = new Set(slots
                        .filter((_, slotIndex) => slotIndex !== index)
                        .map((candidate) => candidate.ability)
                        .filter((ability) => ability !== undefined))
                      const usedStandardScores = new Set(slots
                        .filter((_, slotIndex) => slotIndex !== index)
                        .map((candidate) => candidate.option)
                        .filter((option) => option !== undefined))
                      const currentPointBuyCost = getPointBuyCost(slot.option)
                      const scoreOptions = assignmentOptions.map((option) => {
                        const nextPointBuyCost = getPointBuyCost(option.value)

                        return {
                          ...option,
                          disabled: abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
                            ? usedStandardScores.has(option.value)
                            : abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
                              ? pointBuySpent - currentPointBuyCost + nextPointBuyCost > pointBuyTotalPoints
                              : false
                        }
                      })

                      return (
                        <div key={`ability-slot-${index}`} className={styles.abilityAssignmentSlot}>
                          {abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
                            ? (
                                <NumberInput
                                  label='Score'
                                  aria-label={`Score for assignment ${index + 1}`}
                                  value={slot.score ?? ''}
                                  allowDecimal={false}
                                  required
                                  disabled={readOnly}
                                  onChange={(value) => updateSlots(slots.map((candidate, slotIndex) => slotIndex === index
                                    ? { ...candidate, score: typeof value === 'number' ? Math.trunc(value) : undefined }
                                    : candidate))}
                                />
                              )
                            : (
                                <AppSelect
                                  label='Score'
                                  aria-label={`Score for assignment ${index + 1}`}
                                  data={scoreOptions}
                                  value={slot.option ?? null}
                                  required
                                  clearable
                                  disabled={readOnly}
                                  renderOption={abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
                                    ? ({ option }) => {
                                        const pointDelta = currentPointBuyCost - getPointBuyCost(option.value)
                                        return <Text size='sm'>{`${option.label} (${formatPointDelta(pointDelta)})`}</Text>
                                      }
                                    : undefined}
                                  onChange={(value) => updateSlots(slots.map((candidate, slotIndex) => slotIndex === index
                                    ? {
                                        ...candidate,
                                        option: value && isAbilityAssignmentOption(value) ? value : undefined
                                      }
                                    : candidate))}
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
                            onChange={(value) => updateSlots(slots.map((candidate, slotIndex) => slotIndex === index
                              ? {
                                  ...candidate,
                                  ability: value && isCharacterAbilityCode(value) ? value : undefined
                                }
                              : candidate))}
                          />
                        </div>
                      )
                    })}
                  </div>
                </Stack>
              </>
            )
          }}
        </form.AppField>
        <form.AppField name='intent.hitpoints'>
          {(hitpointField) => {
            const hitpointMethod = hitpointField.state.value.method
            const isManualHitpoints = hitpointMethod === HITPOINT_CALCULATION_METHOD_CODE.MANUAL

            return (
              <form.AppField name='intent.hitpoints.levels' mode='array'>
                {(field) => {
                  const rows = hitpointRows
                  const totalHitpoints = rows.reduce((total, row) => total + row.value, 0)

                  return (
                    <Stack gap='sm' className={`${styles.inlinePanel} ${styles.hitpointPanel}`}>
                      <Group justify='space-between' align='center'>
                        <Text fw={700}>Hit points</Text>
                        <Text fw={700}>{`Maximum HP ${totalHitpoints}`}</Text>
                      </Group>
                      {rows.length === 0
                        ? <Text className={styles.mutedText}>Add a class to calculate hit points.</Text>
                        : (
                            <table className={styles.hitpointTable}>
                              <thead>
                                <tr>
                                  <th scope='col'>Character level</th>
                                  <th scope='col'>Class level</th>
                                  <th scope='col'>{isManualHitpoints ? 'Hit-die roll' : 'Hit die'}</th>
                                  <th scope='col'>Modifier</th>
                                  <th scope='col'>HP gained</th>
                                </tr>
                              </thead>
                              {form.state.values.intent.classes.map((classRow) => {
                            const classReference = payload.references.classes.find((record) => record.id === classRow.classId)
                            const classLabel = classReference?.label ?? classRow.classId
                            const classRows = rows.filter((row) => row.classId === classRow.classId)
                            const classSubtotal = classRows.reduce((total, row) => total + row.value, 0)
                            const dieSides = getHitpointDieSides(classReference)
                            const hitpointAbility = classReference?.hitpoint?.ability
                            const abilityModifier = hitpointAbility
                              ? getHitpointAbilityModifier({
                                  ability: hitpointAbility,
                                  character: form.state.values,
                                  resolvedAbilityScores: payload.resolution.summary.abilities
                                })
                              : 0

                            return (
                              <tbody key={`hp-class-${classRow.classId}`} className={styles.hitpointClassGroup}>
                                <tr className={styles.hitpointClassHeader}>
                                  <th scope='rowgroup' colSpan={5}>
                                    <span>{classLabel}</span>
                                    {rows.length > 1 ? <span>{`${classSubtotal} HP`}</span> : null}
                                  </th>
                                </tr>
                                {classRows.map((row) => {
                                  const roll = row.rolls?.[0]?.value
                                  const isStartingLevel = row.level === 1
                                  const isLegacyOverride = isManualHitpoints
                                    && !isStartingLevel
                                    && row.overridden === true
                                    && roll === undefined
                                  const hitDieValue = dieSides
                                    ? isStartingLevel ? dieSides : Math.floor(dieSides / 2) + 1
                                    : null
                                  const abilityLabel = abilityOptions.find((option) => option.value === hitpointAbility)?.label

                                  return (
                                    <tr key={`hp-${row.classId}-${row.classLevel}`} className={styles.hitpointRow}>
                                      <td data-label='Character level'>{row.level}</td>
                                      <td data-label='Class level'>{`${classLabel} ${row.classLevel}`}</td>
                                      {!isManualHitpoints || isStartingLevel
                                        ? (
                                            <td data-label='Hit die'>
                                              <Text component='span' fw={600}>
                                                {hitDieValue === null
                                                  ? 'Unavailable'
                                                  : `${hitDieValue} (${isStartingLevel ? 'maximum' : 'average'})`}
                                              </Text>
                                            </td>
                                          )
                                        : isLegacyOverride
                                          ? (
                                              <td data-label='HP gained (legacy)'>
                                                <NumberInput
                                                  hideControls
                                                  aria-label='HP gained (legacy)'
                                                  min={1}
                                                  value={row.value}
                                                  disabled={readOnly}
                                                  onChange={(value) => {
                                                    if (typeof value !== 'number') return
                                                    field.handleChange(rows.map((candidate) => candidate === row
                                                      ? { ...candidate, value: Math.max(Math.trunc(value), 1), overridden: true }
                                                      : candidate))
                                                  }}
                                                />
                                              </td>
                                            )
                                          : (
                                              <td data-label={dieSides ? `d${dieSides} roll` : 'Hit-die roll'}>
                                                <NumberInput
                                                  hideControls
                                                  aria-label={dieSides ? `d${dieSides} roll` : 'Hit-die roll'}
                                                  min={1}
                                                  max={dieSides ?? undefined}
                                                  value={roll ?? ''}
                                                  disabled={readOnly || dieSides === null}
                                                  onChange={(value) => {
                                                    if (typeof value !== 'number' || !dieSides) return
                                                    const nextRoll = Math.min(dieSides, Math.max(1, Math.trunc(value)))
                                                    field.handleChange(rows.map((candidate) => candidate === row
                                                      ? {
                                                          ...candidate,
                                                          value: Math.max(nextRoll + abilityModifier, 1),
                                                          rolls: [{ die: dieSides, value: nextRoll }],
                                                          overridden: false
                                                        }
                                                    : candidate))
                                                  }}
                                                />
                                              </td>
                                            )}
                                      <td data-label='Modifier'>{`${formatSignedNumber(abilityModifier)}${abilityLabel ? ` ${abilityLabel}` : ''}`}</td>
                                      <td data-label='HP gained'><Text component='span' fw={700}>{row.value}</Text></td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            )
                              })}
                            </table>
                          )}
                    </Stack>
                  )
                }}
              </form.AppField>
            )
          }}
        </form.AppField>
      </div>
    )
  }
})

function formatPointDelta(delta: number): string {
  if (delta === 0) return '±0'

  return delta > 0 ? `+${delta}` : `${delta}`
}

function formatSignedNumber(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}
