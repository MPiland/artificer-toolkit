import { useEffect } from 'react'
import {
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import {
  cacheActiveAbilityIntent,
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
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'

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
      form.setFieldValue('intent.hitpoints.levels', hitpointRows)
    }, [form, hitpointRows, hitpointRowsFingerprint])

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
                      disabled={readOnly}
                      onChange={(value) => {
                        const method = getAbilityGenerationMethod(value ?? '')
                        if (!method) return
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
                                      index === 0
                                        ? level
                                        : { ...level, rolls: undefined, overridden: false }
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
                  getPointBuyCost={getPointBuyCost}
                  pointBuySpent={pointBuySpent}
                  pointBuyTotalPoints={pointBuyTotalPoints}
                  readOnly={readOnly}
                  slots={slots}
                  onChange={updateSlots}
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
