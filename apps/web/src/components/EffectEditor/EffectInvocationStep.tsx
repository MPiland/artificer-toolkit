import { NumberInput } from '@mantine/core'
import type { EffectDto } from '@artificer-toolkit/schema'
import { AppSelect } from '#components/Select'
import { editorGrid, effectEditor } from './EffectEditor.css'
import { EffectCollapse } from './EffectCollapse'
import type { EffectInvocation } from './effectEditor.types'
import { hasActivation, hasSavingThrow, isTargetingWithDisposition } from './effectEditor.types'
import {
  abilityOptions,
  createRange,
  createTargeting,
  targetDispositionOptions,
  targetingSelectionOptions,
  triggerOptions,
  unitOptions
} from './effectEditor.utils'

export function EffectInvocationStep({
  effect,
  index,
  readOnly,
  onChange
}: {
  effect: EffectDto
  index: number
  readOnly?: boolean
  onChange: (effect: EffectDto) => void
}) {
  const invocationSavingThrow = hasSavingThrow(effect.invocation) ? effect.invocation.savingThrow : null
  const targeting = effect.invocation.targeting ?? createTargeting(effect.invocation.range.rangeKind === 'SELF' ? 'SELF' : 'SINGLE_TARGET')

  function updateInvocation(nextInvocation: EffectInvocation) {
    onChange({
      ...effect,
      invocation: nextInvocation
    })
  }

  function mergeInvocation(patch: Record<string, unknown>) {
    updateInvocation({
      ...effect.invocation,
      ...patch
    } as EffectInvocation)
  }

  return (
    <div className={effectEditor}>
      <EffectCollapse title='Trigger' id={`effect-${index + 1}-trigger-heading`}>
        <div className={editorGrid}>
          <AppSelect
            label='Trigger'
            data={triggerOptions}
            value={effect.invocation.triggerCode}
            disabled={readOnly}
            onChange={(value) => {
              if (!value) return
              mergeInvocation(value === 'SAVING_THROW'
                ? {
                    triggerCode: value,
                    savingThrow: {
                      id: crypto.randomUUID(),
                      savingThrowKind: 'SOURCE_SAVE_DC',
                      ability: 'DEXTERITY'
                    }
                  }
                : { triggerCode: value, savingThrow: undefined })
            }}
          />
          {invocationSavingThrow
            ? (
                <AppSelect
                  label='Save DC'
                  data={[{ value: 'SOURCE_SAVE_DC', label: 'Source save DC' }, { value: 'FIXED_VALUE', label: 'Fixed value' }]}
                  value={invocationSavingThrow.savingThrowKind}
                  disabled={readOnly}
                  onChange={(value) => mergeInvocation({
                    savingThrow: {
                      ...invocationSavingThrow,
                      savingThrowKind: value ?? 'SOURCE_SAVE_DC'
                    }
                  })}
                />
              )
            : null}
          {invocationSavingThrow
            ? (
                <AppSelect
                  label='Ability'
                  data={abilityOptions}
                  value={invocationSavingThrow.ability}
                  disabled={readOnly}
                  onChange={(value) => mergeInvocation({
                    savingThrow: {
                      ...invocationSavingThrow,
                      ability: value ?? 'DEXTERITY'
                    }
                  })}
                />
              )
            : null}
        </div>
      </EffectCollapse>

      <EffectCollapse title='Reach & Area' id={`effect-${index + 1}-reach-heading`}>
        <div className={editorGrid}>
          <AppSelect
            label='Range'
            data={[
              { value: 'SELF', label: 'Self' },
              { value: 'TOUCH', label: 'Touch' },
              { value: 'SIGHT', label: 'Sight' },
              { value: 'DISTANCE', label: 'Distance' },
              { value: 'SPECIAL', label: 'Special' }
            ]}
            value={effect.invocation.range.rangeKind}
            disabled={readOnly}
            onChange={(value) => {
              if (!value) return
              mergeInvocation({ range: createRange(value) })
            }}
          />
          {effect.invocation.range.rangeKind === 'DISTANCE'
            ? (
                <>
                  <NumberInput
                    label='Amount'
                    value={effect.invocation.range.amount}
                    disabled={readOnly}
                    onChange={(value) => mergeInvocation({
                      range: {
                        ...effect.invocation.range,
                        amount: typeof value === 'number' ? value : 30,
                        unit: 'FEET'
                      }
                    })}
                  />
                  <AppSelect
                    label='Unit'
                    data={unitOptions}
                    value={effect.invocation.range.unit}
                    disabled={readOnly}
                    onChange={(value) => mergeInvocation({
                      range: {
                        ...effect.invocation.range,
                        unit: value ?? 'FEET'
                      }
                    })}
                  />
                </>
              )
            : null}
        </div>
      </EffectCollapse>

      <EffectCollapse title='Targeting' id={`effect-${index + 1}-targeting-heading`}>
        <div className={editorGrid}>
          <AppSelect
            label='Targeting'
            data={targetingSelectionOptions}
            value={targeting.selectionKind}
            disabled={readOnly}
            onChange={(value) => {
              if (!value) return
              mergeInvocation({ targeting: createTargeting(value) })
            }}
          />
          {isTargetingWithDisposition(targeting)
            ? (
                <AppSelect
                  label='Disposition'
                  data={targetDispositionOptions}
                  value={targeting.dispositionKind ?? 'ANY'}
                  disabled={readOnly}
                  onChange={(value) => mergeInvocation({
                    targeting: {
                      ...targeting,
                      dispositionKind: value ?? 'ANY'
                    }
                  })}
                />
              )
            : null}
          {targeting.selectionKind === 'CHOSEN_CREATURES'
            ? (
                <NumberInput
                  label='Max targets'
                  min={1}
                  value={targeting.maxTargets ?? 1}
                  disabled={readOnly}
                  onChange={(value) => mergeInvocation({
                    targeting: {
                      ...targeting,
                      maxTargets: typeof value === 'number' ? value : 1
                    }
                  })}
                />
              )
            : null}
        </div>
      </EffectCollapse>

      <EffectCollapse title='Activation' id={`effect-${index + 1}-activation-heading`}>
        <div className={editorGrid}>
          <AppSelect
            label='Mode'
            data={[
              { value: 'ACTION', label: 'Action' },
              { value: 'PASSIVE', label: 'Passive' }
            ]}
            value={effect.invocation.kind ?? 'ACTION'}
            disabled={readOnly}
            onChange={(value) => {
              if (!value) return
              mergeInvocation(value === 'PASSIVE'
                ? { kind: value, activation: undefined }
                : { kind: value, activation: { code: 'ACTION', amount: 1 } })
            }}
          />
          {effect.invocation.kind !== 'PASSIVE'
            ? (
                <AppSelect
                  label='Activation'
                  data={[
                    { value: 'ACTION', label: 'Action' },
                    { value: 'BONUS_ACTION', label: 'Bonus action' },
                    { value: 'REACTION', label: 'Reaction' },
                    { value: 'FREE', label: 'Free' }
                  ]}
                  value={hasActivation(effect.invocation) ? effect.invocation.activation.code : 'ACTION'}
                  disabled={readOnly}
                  onChange={(value) => {
                    if (!value) return
                    mergeInvocation({
                      activation: value === 'FREE' ? { code: 'FREE' } : { code: value, amount: 1 }
                    })
                  }}
                />
              )
            : null}
        </div>
      </EffectCollapse>
    </div>
  )
}
