import { useCallback, useEffect, useState } from 'react'
import {
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import { parseStandaloneDiceConfiguration } from '@artificer-toolkit/shared/rolls'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import { withForm } from '#forms/app-form/AppForm'
import { useExecuteDiceConfigurationMutation } from '#app/data/rolls'
import { AppSelect } from '#ui/primitives/Select'
import {
  applyManualAbilityRoll,
  cacheActiveAbilityIntent,
  DEFAULT_ABILITY_ROLL_CONFIGURATION,
  getAbilityDraftSlots,
  getAbilityGenerationMethod,
  setAbilityDraftSlots
} from './abilityGeneration'
import { selectOptions } from '../../selection/optionProjection'
import { createFallbackCharacterFormValues } from '../../shared/formNormalization'
import * as sharedStyles from '../../shared/builderShared.css'
import { syncHitpointLevels } from './characterAbilities'
import { CharacterAbilityAssignments } from './CharacterAbilityAssignments'
import { CharacterHitpointProgression } from './CharacterHitpointProgression'
import { DiceRollPresentation } from '#app/components/dice/DiceRollPresentation'
import { useDismissRollOnClick } from '#app/components/dice/useDismissRollOnClick'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

function preloadAbilityDice(configuration: string) {
  try {
    parseStandaloneDiceConfiguration(configuration)
  } catch {
    return
  }

  void import('#app/components/dice/diceModelPreload')
    .then(({ preloadDiceModels }) => preloadDiceModels(configuration))
    .catch(() => undefined)
}

export const CharacterAbilitiesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterAbilities({ form, payload, readOnly }) {
    const executeConfiguration = useExecuteDiceConfigurationMutation()
    const [presentedRoll, setPresentedRoll] = useState<RollResultDto>()
    const [activeRollSlot, setActiveRollSlot] = useState<number>()
    const abilityIntent = form.state.values.intent.abilities
    const abilityRollConfiguration =
      abilityIntent.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
        ? (abilityIntent.state.configuration ?? DEFAULT_ABILITY_ROLL_CONFIGURATION)
        : DEFAULT_ABILITY_ROLL_CONFIGURATION
    const abilityOptions = selectOptions(payload.references.abilities)
    const abilityMethodOptions = selectOptions(payload.references.abilityGenerationMethods)
    const hitpointMethodOptions = selectOptions(payload.references.hitpointCalculationMethods)
    const standardArrayOptions = selectOptions(payload.references.standardArrayScores)
    const pointBuyOptions = selectOptions(payload.references.pointBuyScores)
    const pointBuyCosts = new Map(
      payload.references.pointBuyScores.map((option) => [option.id, option.cost])
    )
    const getPointBuyCost = (score: string | undefined) =>
      score ? (pointBuyCosts.get(score) ?? 0) : 0
    const pointBuyTotalPoints = payload.references.pointBuyTotalPoints
    const hitpointRows = syncHitpointLevels({
      character: form.state.values,
      classReferences: payload.references.classes,
      resolvedAbilityScores: payload.resolution.summary.abilities,
      rows: form.state.values.intent.hitpoints.levels
    })
    const hitpointRowsFingerprint = JSON.stringify(hitpointRows)

    useEffect(() => {
      if (JSON.stringify(form.state.values.intent.hitpoints.levels) === hitpointRowsFingerprint)
        return
      form.setFieldValue('intent.hitpoints.levels', hitpointRows, { dontUpdateMeta: true })
    }, [form, hitpointRows, hitpointRowsFingerprint])

    useEffect(() => {
      if (abilityIntent.method !== CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) return
      preloadAbilityDice(abilityRollConfiguration)
    }, [abilityIntent.method, abilityRollConfiguration])

    const dismissRoll = useCallback(() => {
      setPresentedRoll(undefined)
      setActiveRollSlot(undefined)
    }, [])
    useDismissRollOnClick(presentedRoll !== undefined, dismissRoll)

    return (
      <div className={sharedStyles.section}>
        <form.AppField name='intent.abilities'>
          {(abilityField) => {
            const abilityMethod = abilityField.state.value.method
            const assignmentOptions =
              abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
                ? pointBuyOptions
                : standardArrayOptions
            const slots = getAbilityDraftSlots(
              form.state.values.builderIntent?.abilities,
              abilityField.state.value
            )
            const configuration =
              abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
                ? (abilityField.state.value.state.configuration ??
                  DEFAULT_ABILITY_ROLL_CONFIGURATION)
                : DEFAULT_ABILITY_ROLL_CONFIGURATION
            let configurationError: string | undefined
            try {
              parseStandaloneDiceConfiguration(configuration)
            } catch (error) {
              configurationError =
                error instanceof Error ? error.message : 'Invalid dice configuration.'
            }
            const pointBuySpent =
              abilityMethod === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY
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
                <div className={sharedStyles.fieldGrid}>
                  <div className={sharedStyles.fieldSpan6}>
                    <AppSelect
                      label='Ability Method'
                      data={abilityMethodOptions}
                      value={abilityMethod}
                      searchable={false}
                      disabled={readOnly}
                      onChange={(value) => {
                        const method = getAbilityGenerationMethod(value ?? '')
                        if (!method) return
                        setPresentedRoll(undefined)
                        setActiveRollSlot(undefined)
                        executeConfiguration.reset()
                        const cache = cacheActiveAbilityIntent(
                          form.state.values.builderIntent?.abilities,
                          abilityField.state.value
                        )
                        const next = setAbilityDraftSlots(
                          cache,
                          abilityField.state.value,
                          method,
                          getAbilityDraftSlots(cache, abilityField.state.value, method)
                        )
                        if (
                          next.abilities.method ===
                          CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
                        ) {
                          preloadAbilityDice(
                            next.abilities.state.configuration ?? DEFAULT_ABILITY_ROLL_CONFIGURATION
                          )
                        }

                        abilityField.handleChange(next.abilities)
                        form.setFieldValue('builderIntent.abilities', next.cache)
                      }}
                    />
                  </div>
                  <div className={sharedStyles.fieldSpan6}>
                    <form.AppField name='intent.hitpoints'>
                      {(field) => (
                        <AppSelect
                          label='Hit Point Method'
                          data={hitpointMethodOptions}
                          value={field.state.value.method}
                          required
                          searchable={false}
                          disabled={readOnly}
                          onChange={(value) => {
                            if (!value) return
                            if (
                              value !== HITPOINT_CALCULATION_METHOD_CODE.FIXED &&
                              value !== HITPOINT_CALCULATION_METHOD_CODE.MANUAL
                            )
                              return

                            field.handleChange({
                              ...field.state.value,
                              method: value,
                              levels:
                                value === HITPOINT_CALCULATION_METHOD_CODE.MANUAL
                                  ? field.state.value.levels.map((level, index) =>
                                      index === 0 ? level : { ...level, rolls: undefined }
                                    )
                                  : field.state.value.levels
                            })
                          }}
                        />
                      )}
                    </form.AppField>
                  </div>
                </div>
                <CharacterAbilityAssignments
                  abilityMethod={abilityMethod}
                  abilityOptions={abilityOptions}
                  assignmentOptions={assignmentOptions}
                  configuration={configuration}
                  configurationError={
                    configurationError ??
                    (executeConfiguration.error
                      ? 'Unable to roll dice. Please try again.'
                      : undefined)
                  }
                  getPointBuyCost={getPointBuyCost}
                  isRolling={executeConfiguration.isPending}
                  pointBuySpent={pointBuySpent}
                  pointBuyTotalPoints={pointBuyTotalPoints}
                  readOnly={readOnly}
                  rollingSlotIndex={activeRollSlot}
                  slots={slots}
                  onChange={updateSlots}
                  onConfigurationChange={(nextConfiguration) => {
                    if (
                      abilityField.state.value.method !==
                      CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
                    )
                      return
                    executeConfiguration.reset()
                    preloadAbilityDice(nextConfiguration)
                    const abilities = {
                      ...abilityField.state.value,
                      state: {
                        ...abilityField.state.value.state,
                        configuration: nextConfiguration
                      }
                    }
                    abilityField.handleChange(abilities)
                    form.setFieldValue(
                      'builderIntent.abilities',
                      cacheActiveAbilityIntent(
                        form.state.values.builderIntent?.abilities,
                        abilities
                      )
                    )
                  }}
                  onRoll={(slotIndex) => {
                    if (configurationError) return
                    setPresentedRoll(undefined)
                    setActiveRollSlot(slotIndex)
                    preloadAbilityDice(configuration)
                    void executeConfiguration
                      .mutateAsync({ configuration })
                      .then(setPresentedRoll)
                      .catch(() => setActiveRollSlot(undefined))
                  }}
                />
                <DiceRollPresentation
                  pending={executeConfiguration.isPending}
                  roll={presentedRoll}
                  onRollRevealed={(rollId) => {
                    if (
                      !presentedRoll ||
                      presentedRoll.id !== rollId ||
                      activeRollSlot === undefined ||
                      abilityField.state.value.method !==
                        CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
                    )
                      return

                    const next = applyManualAbilityRoll(
                      form.state.values.builderIntent?.abilities,
                      abilityField.state.value,
                      slots,
                      activeRollSlot,
                      presentedRoll
                    )
                    abilityField.handleChange(next.abilities)
                    form.setFieldValue('builderIntent.abilities', next.cache)
                    setActiveRollSlot(undefined)
                  }}
                />
              </>
            )
          }}
        </form.AppField>
        <form.AppField name='intent.hitpoints'>
          {(hitpointField) => (
            <form.AppField name='intent.hitpoints.levels' mode='array'>
              {(field) => (
                <CharacterHitpointProgression
                  abilityOptions={abilityOptions}
                  character={form.state.values}
                  classReferences={payload.references.classes}
                  isManual={
                    hitpointField.state.value.method === HITPOINT_CALCULATION_METHOD_CODE.MANUAL
                  }
                  readOnly={readOnly}
                  resolvedAbilityScores={payload.resolution.summary.abilities}
                  rows={hitpointRows}
                  onChange={field.handleChange}
                />
              )}
            </form.AppField>
          )}
        </form.AppField>
      </div>
    )
  }
})
