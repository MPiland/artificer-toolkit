import type { AttackDomainCode } from '@artificer-toolkit/shared/core'

/**
 * The one D&D attack classification of an action's trigger. Character actions, Creature feature
 * actions, roll modes, flanking, Cleaving and Disarm all read it; an unarmed strike is its own
 * kind but is a melee attack.
 */
export function dnd5eAttackKind(triggerCode: string): AttackDomainCode | null {
  switch (triggerCode) {
    case 'MELEE_WEAPON_ATTACK':
      return 'MELEE'
    case 'RANGED_WEAPON_ATTACK':
      return 'RANGED'
    case 'UNARMED_ATTACK':
      return 'UNARMED'
    case 'SPELL_ATTACK':
      return 'SPELL'
    default:
      return null
  }
}

/** Melee weapon attacks and unarmed strikes; a spell attack's reach is not classified. */
export function isDnd5eMeleeAttackKind(kind: unknown): boolean {
  return kind === 'MELEE' || kind === 'UNARMED'
}
