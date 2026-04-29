import { NumberInput } from '@mantine/core'
import type { EffectDto, RangeDto, SavingThrowDto, TargetingDto } from '@artificer-toolkit/schema'
import { AppSelect } from '#app/ui/primitives/Select'
import { integerMinimum, requiredSelect, validatorsFor, withFieldGroup } from '#components/Form/runtime'
import { getFieldError } from '#components/Form/runtime/utils/formUtils'
import { editorGrid, effectEditor } from '../EffectEditor.css'
import { EffectCollapse } from '../components/EffectCollapse'
import type { EffectActivation, EffectInvocation } from '../effectEditor.types'
import { hasActivation, hasSavingThrow, isTargetingWithDisposition } from '../effectEditor.types'
import {
  abilityOptions,
  createRange,
  createTargeting,
  targetDispositionOptions,
  targetingSelectionOptions,
  triggerOptions,
  unitOptions
} from '../effectEditor.utils'

type ActivationCode = NonNullable<EffectActivation>['code']
type Ability = SavingThrowDto['ability']
type TargetDispositionKind = Exclude<Extract<TargetingDto, { dispositionKind?: unknown }>['dispositionKind'], undefined>
type TargetingSelectionKind = TargetingDto['selectionKind']
type TriggerCode = EffectInvocation['triggerCode']
type Unit = Extract<RangeDto, { rangeKind: 'DISTANCE' }>['unit']

type EffectInvocationFieldGroupValues = {
  invocation: EffectInvocation
}

const invocationDefaultValues: EffectInvocationFieldGroupValues = {
  invocation: createDefaultInvocation()
}

const rangeKindOptions = [
  { value: 'SELF', label: 'Self' },
  { value: 'TOUCH', label: 'Touch' },
  { value: 'SIGHT', label: 'Sight' },
  { value: 'DISTANCE', label: 'Distance' },
  { value: 'SPECIAL', label: 'Special' }
] satisfies Array<{ value: RangeDto['rangeKind'], label: string }>

const saveDcOptions = [
  { value: 'SOURCE_SAVE_DC', label: 'Source save DC' },
  { value: 'FIXED_VALUE', label: 'Fixed value' }
] satisfies Array<{ value: 'SOURCE_SAVE_DC' | 'FIXED_VALUE', label: string }>

const modeOptions = [
  { value: 'ACTION', label: 'Action' },
  { value: 'PASSIVE', label: 'Passive' }
] satisfies Array<{ value: NonNullable<EffectInvocation['kind']>, label: string }>

const activationOptions = [
  { value: 'ACTION', label: 'Action' },
  { value: 'BONUS_ACTION', label: 'Bonus action' },
  { value: 'REACTION', label: 'Reaction' },
  { value: 'FREE', label: 'Free' }
] satisfies Array<{ value: ActivationCode, label: string }>

export const EffectInvocationStep = withFieldGroup({
  defaultValues: invocationDefaultValues,
  props: {
    index: 0,
    readOnly: false
  },
  render: function EffectInvocationStepRender({ group, index, readOnly }) {
    return (
      <group.Subscribe selector={(state) => state.values.invocation}>
        {(invocation) => {
          const invocationSavingThrow = hasSavingThrow(invocation) ? invocation.savingThrow : null
          const distanceRange = isDistanceRange(invocation.range) ? invocation.range : null
          const targeting = invocation.targeting ?? createTargeting(invocation.range.rangeKind === 'SELF' ? 'SELF' : 'SINGLE_TARGET')

          return (
            <div className={effectEditor}>
              <EffectCollapse title='Trigger' id={`effect-${index + 1}-trigger-heading`}>
                <div className={editorGrid}>
                  <group.AppField
                    name='invocation.triggerCode'
                    validators={validatorsFor(requiredSelect('Trigger'))}
                  >
                    {(field) => (
                      <AppSelect
                        label='Trigger'
                        data={triggerOptions}
                        value={field.state.value}
                        error={getFieldError(field)}
                        disabled={readOnly}
                        onBlur={field.handleBlur}
                        onChange={(value) => {
                          const triggerCode = toTriggerCode(value)
                          group.setFieldValue('invocation', withTriggerCode(invocation, triggerCode))
                        }}
                      />
                    )}
                  </group.AppField>
                  {invocationSavingThrow
                    ? (
                        <group.AppField name='invocation'>
                          {(field) => (
                            <AppSelect
                              label='Save DC'
                              data={saveDcOptions}
                              value={invocationSavingThrow.savingThrowKind}
                              error={getFieldError(field)}
                              disabled={readOnly}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                field.handleChange(withSavingThrow(invocation, {
                                  savingThrowKind: toSaveDcKind(value),
                                  ability: invocationSavingThrow.ability
                                }))
                              }}
                            />
                          )}
                        </group.AppField>
                      )
                    : null}
                  {invocationSavingThrow
                    ? (
                        <group.AppField name='invocation'>
                          {(field) => (
                            <AppSelect
                              label='Ability'
                              data={abilityOptions}
                              value={invocationSavingThrow.ability}
                              error={getFieldError(field)}
                              disabled={readOnly}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                field.handleChange(withSavingThrow(invocation, {
                                  savingThrowKind: invocationSavingThrow.savingThrowKind,
                                  ability: toAbility(value)
                                }))
                              }}
                            />
                          )}
                        </group.AppField>
                      )
                    : null}
                </div>
              </EffectCollapse>

              <EffectCollapse title='Reach & Area' id={`effect-${index + 1}-reach-heading`}>
                <div className={editorGrid}>
                  <group.AppField
                    name='invocation.range.rangeKind'
                    validators={validatorsFor(requiredSelect('Range'))}
                  >
                    {(field) => (
                      <AppSelect
                        label='Range'
                        data={rangeKindOptions}
                        value={field.state.value}
                        error={getFieldError(field)}
                        disabled={readOnly}
                        onBlur={field.handleBlur}
                        onChange={(value) => {
                          group.setFieldValue('invocation', {
                            ...invocation,
                            range: createRange(toRangeKind(value))
                          })
                        }}
                      />
                    )}
                  </group.AppField>
                  {distanceRange
                    ? (
                        <>
                          <group.AppField
                            name='invocation.range.amount'
                            validators={validatorsFor(integerMinimum('Range amount', 1))}
                          >
                            {(field) => (
                              <NumberInput
                                label='Amount'
                                value={field.state.value}
                                error={getFieldError(field)}
                                disabled={readOnly}
                                onBlur={field.handleBlur}
                                onChange={(value) => field.handleChange(typeof value === 'number' ? value : 30)}
                              />
                            )}
                          </group.AppField>
                          <group.AppField name='invocation'>
                            {(field) => (
                              <AppSelect
                                label='Unit'
                                data={unitOptions}
                                value={distanceRange.unit}
                                error={getFieldError(field)}
                                disabled={readOnly}
                                onBlur={field.handleBlur}
                                onChange={(value) => {
                                  field.handleChange({
                                    ...invocation,
                                    range: {
                                      ...distanceRange,
                                      unit: toUnit(value)
                                    }
                                  })
                                }}
                              />
                            )}
                          </group.AppField>
                        </>
                      )
                    : null}
                </div>
              </EffectCollapse>

              <EffectCollapse title='Targeting' id={`effect-${index + 1}-targeting-heading`}>
                <div className={editorGrid}>
                  <group.AppField
                    name='invocation'
                    validators={validatorsFor(requiredSelect('Targeting'))}
                  >
                    {(field) => (
                      <AppSelect
                        label='Targeting'
                        data={targetingSelectionOptions}
                        value={targeting.selectionKind}
                        error={getFieldError(field)}
                        disabled={readOnly}
                        onBlur={field.handleBlur}
                        onChange={(value) => {
                          field.handleChange({
                            ...invocation,
                            targeting: createTargeting(toTargetingSelectionKind(value))
                          })
                        }}
                      />
                    )}
                  </group.AppField>
                  {isTargetingWithDisposition(targeting)
                    ? (
                        <group.AppField name='invocation'>
                          {(field) => (
                            <AppSelect
                              label='Disposition'
                              data={targetDispositionOptions}
                              value={targeting.dispositionKind ?? 'ANY'}
                              error={getFieldError(field)}
                              disabled={readOnly}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                field.handleChange({
                                  ...invocation,
                                  targeting: {
                                    ...targeting,
                                    dispositionKind: toTargetDispositionKind(value)
                                  }
                                })
                              }}
                            />
                          )}
                        </group.AppField>
                      )
                    : null}
                  {targeting.selectionKind === 'CHOSEN_CREATURES'
                    ? (
                        <group.AppField
                          name='invocation'
                          validators={validatorsFor(integerMinimum('Max targets', 1))}
                        >
                          {(field) => (
                            <NumberInput
                              label='Max targets'
                              min={1}
                              value={targeting.maxTargets ?? 1}
                              error={getFieldError(field)}
                              disabled={readOnly}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                field.handleChange({
                                  ...invocation,
                                  targeting: {
                                    ...targeting,
                                    maxTargets: typeof value === 'number' ? value : 1
                                  }
                                })
                              }}
                            />
                          )}
                        </group.AppField>
                      )
                    : null}
                </div>
              </EffectCollapse>

              <EffectCollapse title='Activation' id={`effect-${index + 1}-activation-heading`}>
                <div className={editorGrid}>
                  <group.AppField name='invocation.kind'>
                    {(field) => (
                      <AppSelect
                        label='Mode'
                        data={modeOptions}
                        value={invocation.kind ?? 'ACTION'}
                        error={getFieldError(field)}
                        disabled={readOnly}
                        onBlur={field.handleBlur}
                        onChange={(value) => {
                          group.setFieldValue('invocation', withMode(invocation, value === 'PASSIVE' ? 'PASSIVE' : 'ACTION'))
                        }}
                      />
                    )}
                  </group.AppField>
                  {invocation.kind !== 'PASSIVE'
                    ? (
                        <group.AppField name='invocation'>
                          {(field) => (
                            <AppSelect
                              label='Activation'
                              data={activationOptions}
                              value={hasActivation(invocation) ? invocation.activation.code : 'ACTION'}
                              error={getFieldError(field)}
                              disabled={readOnly}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                const code = toActivationCode(value)
                                field.handleChange({
                                  ...invocation,
                                  activation: code === 'FREE' ? { code: 'FREE' } : { code, amount: 1 }
                                })
                              }}
                            />
                          )}
                        </group.AppField>
                      )
                    : null}
                </div>
              </EffectCollapse>
            </div>
          )
        }}
      </group.Subscribe>
    )
  }
})

function createDefaultInvocation(): EffectDto['invocation'] {
  return {
    kind: 'ACTION',
    triggerCode: 'ACTIVATED',
    activation: { code: 'ACTION', amount: 1 },
    range: createRange('SELF')
  }
}

function withTriggerCode(invocation: EffectInvocation, triggerCode: TriggerCode): EffectInvocation {
  if (triggerCode === 'SAVING_THROW') {
    return withSavingThrow(invocation, {
      savingThrowKind: hasSavingThrow(invocation) ? invocation.savingThrow.savingThrowKind : 'SOURCE_SAVE_DC',
      ability: hasSavingThrow(invocation) ? invocation.savingThrow.ability : 'DEXTERITY'
    })
  }

  const common = getInvocationCommon(invocation)
  if (invocation.kind === 'PASSIVE') {
    return { ...common, kind: 'PASSIVE', triggerCode }
  }

  return {
    ...common,
    kind: 'ACTION',
    triggerCode,
    activation: hasActivation(invocation) ? invocation.activation : { code: 'ACTION', amount: 1 }
  }
}

function withSavingThrow(
  invocation: EffectInvocation,
  savingThrow: { savingThrowKind: 'SOURCE_SAVE_DC' | 'FIXED_VALUE', ability: Ability }
): EffectInvocation {
  const common = getInvocationCommon(invocation)
  const nextSavingThrow = createSavingThrow(savingThrow.savingThrowKind, savingThrow.ability, hasSavingThrow(invocation) ? invocation.savingThrow : undefined)

  if (invocation.kind === 'PASSIVE') {
    return { ...common, kind: 'PASSIVE', triggerCode: 'SAVING_THROW', savingThrow: nextSavingThrow }
  }

  return {
    ...common,
    kind: 'ACTION',
    triggerCode: 'SAVING_THROW',
    savingThrow: nextSavingThrow,
    activation: hasActivation(invocation) ? invocation.activation : { code: 'ACTION', amount: 1 }
  }
}

function withMode(invocation: EffectInvocation, kind: NonNullable<EffectInvocation['kind']>): EffectInvocation {
  const common = getInvocationCommon(invocation)
  if (kind === 'PASSIVE') {
    if (hasSavingThrow(invocation)) {
      return { ...common, kind: 'PASSIVE', triggerCode: 'SAVING_THROW', savingThrow: invocation.savingThrow }
    }

    return { ...common, kind: 'PASSIVE', triggerCode: invocation.triggerCode }
  }

  if (hasSavingThrow(invocation)) {
    return {
      ...common,
      kind: 'ACTION',
      triggerCode: 'SAVING_THROW',
      savingThrow: invocation.savingThrow,
      activation: hasActivation(invocation) ? invocation.activation : { code: 'ACTION', amount: 1 }
    }
  }

  return {
    ...common,
    kind: 'ACTION',
    triggerCode: invocation.triggerCode,
    activation: hasActivation(invocation) ? invocation.activation : { code: 'ACTION', amount: 1 }
  }
}

function getInvocationCommon(invocation: EffectInvocation) {
  return {
    range: invocation.range,
    ...(invocation.shape ? { shape: invocation.shape } : {}),
    ...(invocation.targeting ? { targeting: invocation.targeting } : {})
  }
}

function createSavingThrow(
  savingThrowKind: 'SOURCE_SAVE_DC' | 'FIXED_VALUE',
  ability: Ability,
  previous?: SavingThrowDto
): SavingThrowDto {
  const id = previous?.id ?? crypto.randomUUID()
  if (savingThrowKind === 'FIXED_VALUE') {
    return {
      id,
      savingThrowKind: 'FIXED_VALUE',
      ability,
      dc: previous?.savingThrowKind === 'FIXED_VALUE' ? previous.dc : 10
    }
  }

  return { id, savingThrowKind: 'SOURCE_SAVE_DC', ability }
}

function isDistanceRange(range: RangeDto): range is Extract<RangeDto, { rangeKind: 'DISTANCE' }> {
  return range.rangeKind === 'DISTANCE'
}

function toTriggerCode(value: string | null): TriggerCode {
  return triggerOptions.find((option) => option.value === value)?.value ?? 'ACTIVATED'
}

function toRangeKind(value: string | null): RangeDto['rangeKind'] {
  return rangeKindOptions.find((option) => option.value === value)?.value ?? 'SELF'
}

function toTargetingSelectionKind(value: string | null): TargetingSelectionKind {
  return targetingSelectionOptions.find((option) => option.value === value)?.value ?? 'SELF'
}

function toSaveDcKind(value: string | null): 'SOURCE_SAVE_DC' | 'FIXED_VALUE' {
  return saveDcOptions.find((option) => option.value === value)?.value ?? 'SOURCE_SAVE_DC'
}

function toActivationCode(value: string | null): ActivationCode {
  return activationOptions.find((option) => option.value === value)?.value ?? 'ACTION'
}

function toAbility(value: string | null): Ability {
  return abilityOptions.find((option) => option.value === value)?.value ?? 'DEXTERITY'
}

function toUnit(value: string | null): Unit {
  return unitOptions.find((option) => option.value === value)?.value ?? 'FEET'
}

function toTargetDispositionKind(value: string | null): TargetDispositionKind {
  return targetDispositionOptions.find((option) => option.value === value)?.value ?? 'ANY'
}
