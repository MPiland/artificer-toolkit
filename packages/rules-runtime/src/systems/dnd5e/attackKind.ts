import type { AttackKind } from '@artificer-toolkit/schema/shared/enums'
import type { AttackDomainCode } from '@artificer-toolkit/shared/core'

/**
 * The one D&D attack classification of an action's trigger. Character actions, Creature feature
 * actions, roll modes, flanking, Cleaving and Disarm all read it; an unarmed strike is its own
 * kind but is a melee attack, and a spell attack is melee or ranged as its trigger says.
 */
export function dnd5eAttackKind(triggerCode: string): AttackKind | null {
  switch (triggerCode) {
    case 'MELEE_WEAPON_ATTACK':
      return 'MELEE'
    case 'RANGED_WEAPON_ATTACK':
      return 'RANGED'
    case 'UNARMED_ATTACK':
      return 'UNARMED'
    case 'MELEE_SPELL_ATTACK':
      return 'MELEE_SPELL'
    case 'RANGED_SPELL_ATTACK':
      return 'RANGED_SPELL'
    default:
      return null
  }
}

/** The modifier attack domain an attack reads: spell attacks of either reach read SPELL. */
export function dnd5eAttackModifierDomain(kind: AttackKind): AttackDomainCode {
  return kind === 'MELEE_SPELL' || kind === 'RANGED_SPELL' ? 'SPELL' : kind
}

export function isDnd5eSpellAttackKind(kind: unknown): boolean {
  return kind === 'MELEE_SPELL' || kind === 'RANGED_SPELL'
}

/** Melee weapon attacks, unarmed strikes and melee spell attacks (flanking, Cleaving). */
export function isDnd5eMeleeAttackKind(kind: unknown): boolean {
  return kind === 'MELEE' || kind === 'UNARMED' || kind === 'MELEE_SPELL'
}
