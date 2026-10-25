import type { CharacterMechanicSourceRef } from '../character/sheetCalculation.js'
import type { FacingArc } from '../vtt/facingArc.js'

export const ROLL_MODE_CONTRIBUTOR_SOURCE_KINDS = [
  'ACTIVE_EFFECT',
  'CONDITION',
  'AUTHORED',
  'RULE'
] as const

/**
 * Where a d20 roll-mode contributor comes from, as identities: reason labels are a lookup by `kind`
 * and `id`, never a parse of the contributor's opaque `sourceId` or `domainKey`. `id` is the active
 * effect, System condition or authored definition that names the contributor, or the platform rule
 * (`ROLL_MODE_RULE_SOURCE_IDS`); `holderActorId` is the Encounter actor the contributor applies to,
 * when the producer knows it.
 */
export interface RollModeContributorSource {
  kind: (typeof ROLL_MODE_CONTRIBUTOR_SOURCE_KINDS)[number]
  id: string
  holderActorId: string | null
}

/** The rules-owned contributors that no authored source names. */
export const ROLL_MODE_RULE_SOURCE_IDS = {
  FACING: 'facing',
  LONG_RANGE: 'long-range',
  UNSEEN_ATTACKER: 'unseen-attacker',
  UNSEEN_TARGET: 'unseen-target'
} as const

/** The roll-mode source of a Character mechanic source: its active effect, or the definition naming it. */
export function rollModeContributorSourceOfMechanicSource(
  source: CharacterMechanicSourceRef,
  holderActorId: string | null = null
): RollModeContributorSource {
  switch (source.kind) {
    case 'ACTIVE_EFFECT':
      return { kind: 'ACTIVE_EFFECT', id: source.activeEffectId, holderActorId }
    case 'AUTHORED':
      return { kind: 'AUTHORED', id: source.definitionId, holderActorId }
    case 'EQUIPMENT_INSTANCE':
      return { kind: 'AUTHORED', id: source.equipmentId, holderActorId }
    case 'COMPANION_INSTANCE':
      return { kind: 'AUTHORED', id: source.creatureId, holderActorId }
    case 'SYSTEM':
      return { kind: 'AUTHORED', id: source.systemId, holderActorId }
    case 'MANUAL_ADJUSTMENT':
      return { kind: 'AUTHORED', id: source.adjustmentId, holderActorId }
  }
}

export interface CanonicalD20Contributor<TInfluence extends string = string> {
  sourceId: string
  grantId?: string | null
  domainKey?: string | null
  /** A roll-mode influence code from the Game System's vocabulary; the kernel never reads its meaning. */
  influence: TInfluence
}

/** A recorded d20 contributor: its canonical identity plus the typed source its reason label reads. */
export interface D20Contributor<
  TInfluence extends string = string
> extends CanonicalD20Contributor<TInfluence> {
  grantId: string | null
  domainKey: string | null
  source: RollModeContributorSource
  /** The facing arc a positional rule found the attacker in, which the reason names (ATTACK-12). */
  positional?: { arc: FacingArc }
}

export function canonicalD20ContributorKey(input: CanonicalD20Contributor): string {
  return `${input.sourceId}\u0000${input.grantId ?? ''}\u0000${input.domainKey ?? ''}\u0000${input.influence}`
}

export function compareCanonicalD20Contributors(
  left: CanonicalD20Contributor,
  right: CanonicalD20Contributor
): number {
  const leftKey = canonicalD20ContributorKey(left)
  const rightKey = canonicalD20ContributorKey(right)
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
}
