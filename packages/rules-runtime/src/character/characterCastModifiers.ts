import type { ResourceUseAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

/** A cost a Character may pay on casting a spell, authored as a passive Effect's `castModifier`. */
export type CastModifierSource = {
  /** The id of the Effect that carries the cost; the cast command names it. */
  modifierId: string
  /** The label of the Feature, option or feat that holds it. */
  label: string
  cost: ResourceUseAuthored
}

/** The cast modifiers a Feature, option or feat holds, one per passive Effect that authors a cost. */
export function collectCastModifiers(
  effects: readonly CompiledEffectGroup[] | undefined,
  label: string
): CastModifierSource[] {
  return (effects ?? []).flatMap((effect) =>
    effect.invocation.kind === 'PASSIVE' && 'castModifier' in effect.invocation
      ? effect.invocation.castModifier
        ? [{ modifierId: effect.id, label, cost: effect.invocation.castModifier }]
        : []
      : []
  )
}
