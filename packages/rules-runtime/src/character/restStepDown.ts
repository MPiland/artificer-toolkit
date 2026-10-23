import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

type SteppingEffect = Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>

type GrantModifiers = Extract<
  ActiveRuleEffectRecord['definition']['stateContributions'][number],
  { kind: 'MODIFIER_GRANT' }
>['modifiers']

/** What a finished rest does to one effect that steps down with rests: shrink its grants, or end it. */
export type RestStepDownOutcome = 'STEP' | 'END'

function fixedAmount(modifier: GrantModifiers[number]): number {
  const { payload } = modifier
  return payload !== undefined && 'valueKind' in payload && payload.valueKind === 'FIXED'
    ? payload.amount
    : 0
}

/**
 * The rests a step-down effect lasts: how many steps the largest fixed bonus or penalty needs to
 * reach 0. The runtime stores this as the lifecycle's `restStepsRemaining`.
 */
export function initialRestSteps(modifiers: Readonly<GrantModifiers>, step: number): number {
  return Math.ceil(Math.max(...modifiers.map(fixedAmount)) / step)
}

/** The grants after one step: each fixed amount lowered by `step`, a grant that reaches 0 dropped. */
export function steppedDownModifiers(
  modifiers: Readonly<GrantModifiers>,
  step: number
): GrantModifiers {
  return modifiers.flatMap((modifier) => {
    const amount = fixedAmount(modifier) - step
    return amount > 0 ? [{ ...modifier, payload: { valueKind: 'FIXED' as const, amount } }] : []
  })
}

/**
 * The effect's state after one step: its grants shrunk by the authored step and one rest fewer
 * counted. The definition is rewritten (not just the lifecycle) so every reader sees the smaller
 * grant without knowing about step-down.
 */
export function steppedDownEffectState(
  effect: Pick<ActiveRuleEffectRecord, 'definition' | 'lifecycle'>
): Pick<ActiveRuleEffectRecord, 'definition' | 'lifecycle'> {
  const { restStepDown } = effect.definition.recurrence
  if (restStepDown === undefined) throw new Error('This effect does not step down with rests.')
  return {
    definition: {
      ...effect.definition,
      stateContributions: effect.definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? {
              ...contribution,
              modifiers: steppedDownModifiers(contribution.modifiers, restStepDown.step)
            }
          : contribution
      )
    },
    lifecycle: {
      ...effect.lifecycle,
      restStepsRemaining: (effect.lifecycle.restStepsRemaining ?? 1) - 1
    }
  }
}

/**
 * What finishing a rest does to this effect, or null when the rest does not touch it. Only a long
 * rest matches today's single trigger; the last remaining step ends the effect.
 */
export function restStepDownOutcome(
  effect: Pick<ActiveRuleEffectRecord, 'definition' | 'lifecycle'>,
  restKind: 'SHORT' | 'LONG'
): RestStepDownOutcome | null {
  const { restStepDown } = effect.definition.recurrence
  if (restStepDown === undefined || restStepDown.trigger !== 'LONG_REST' || restKind !== 'LONG')
    return null
  return (effect.lifecycle.restStepsRemaining ?? 1) <= 1 ? 'END' : 'STEP'
}

/** The effects a finished rest eases, the last step that ends one included, for the preview. */
export function listSteppedDownEffects<Effect extends SteppingEffect>(
  effects: readonly Effect[],
  restKind: 'SHORT' | 'LONG'
): Effect[] {
  return effects.filter((effect) => restStepDownOutcome(effect, restKind) !== null)
}
