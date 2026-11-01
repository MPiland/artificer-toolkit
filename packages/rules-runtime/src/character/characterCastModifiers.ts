import type {
  CastModifierAuthored,
  SparesCreaturesAuthored
} from '@artificer-toolkit/shared/authored'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

/** A cost a Character may pay on casting a spell, authored as a passive Effect's `castModifier`. */
export type CastModifierSource = {
  /** The id of the Effect that carries the cost; the cast command names it. */
  modifierId: string
  /** The label of the Feature, option or feat that holds it. */
  label: string
  cost: CastModifierAuthored
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

/**
 * The most creatures a paid cast modifier may name: its base, plus the holder's modifier in the
 * authored ability, never below the authored minimum (1 when an ability is added).
 */
export function castModifierTargetCap(
  targets: NonNullable<CastModifierAuthored['targets']>,
  abilityModifier: (abilityDefinitionId: string) => number
): number {
  const added = targets.abilityDefinitionId ? abilityModifier(targets.abilityDefinitionId) : 0
  const minimum = targets.minimum ?? (targets.abilityDefinitionId ? 1 : 0)
  return Math.max(minimum, targets.base + added)
}

/** Creatures a Character may spare from an area spell it casts, authored as a passive Effect's `sparesCreatures`. */
export type SparesCreaturesSource = SparesCreaturesAuthored

export function collectSparesCreatures(
  effects: readonly CompiledEffectGroup[] | undefined
): SparesCreaturesSource[] {
  return (effects ?? []).flatMap((effect) =>
    effect.invocation.kind === 'PASSIVE' && 'sparesCreatures' in effect.invocation
      ? effect.invocation.sparesCreatures
        ? [effect.invocation.sparesCreatures]
        : []
      : []
  )
}

/** How many creatures the sources let a cast of this spell spare; each source that fits adds its own. */
export function sparedCreatureCap(
  sources: readonly SparesCreaturesSource[],
  spell: { level: number; magicSchoolId: string }
): number {
  return sources.reduce(
    (total, { base, plusSpellLevel, magicSchoolIds }) =>
      magicSchoolIds && !magicSchoolIds.includes(spell.magicSchoolId)
        ? total
        : total + base + (plusSpellLevel ? spell.level : 0),
    0
  )
}
