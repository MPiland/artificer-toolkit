import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

/** A feature charge a passive effect raises when its holder rolls initiative. */
export type InitiativeRestoreSource = {
  chargeId: string
  floor: number
  whenAtOrBelow: number
}

/** The restores a passive effect authors for its holder rolling initiative; none for any other effect. */
export function initiativeRestoreSources(
  effect: Pick<CompiledEffectGroup, 'invocation' | 'entries'>
): InitiativeRestoreSource[] {
  if (effect.invocation.kind !== 'PASSIVE' || effect.invocation.triggerCode !== 'ROLL_INITIATIVE')
    return []
  return effect.entries.flatMap((entry) =>
    'outcome' in entry && entry.outcome.effectKind === 'RESTORE_RESOURCE'
      ? [
          {
            chargeId: entry.outcome.chargeId,
            floor: entry.outcome.floor,
            whenAtOrBelow: entry.outcome.whenAtOrBelow
          }
        ]
      : []
  )
}
