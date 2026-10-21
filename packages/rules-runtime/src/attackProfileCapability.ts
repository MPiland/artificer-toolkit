import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { AttackCriticalRulesDto } from '@artificer-toolkit/schema/shared/attackCriticalRules'
import type { AttackKind } from '@artificer-toolkit/schema/shared/enums'
import type { AttackDomainCode, DamageDefenseBypassCode } from '@artificer-toolkit/shared/core'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

type RollContributor = CharacterRulePolicyOutput['rollContributorEvidence']['initiative'][number]

/** The traits an attack carries that a qualified damage defense is bypassed by. */
export type AttackTraits = Readonly<Record<'magical' | 'silvered' | 'adamantine', boolean>>

export type AttackDamageDefense = {
  kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
  damageTypeId: string
  /** Applies only to damage from actions owned by this authored content; absent or empty: any. */
  sourceEffectIds?: readonly string[]
}

/** A defense such as "bludgeoning, piercing, and slashing from nonmagical attacks". */
export type QualifiedDamageDefense = {
  readonly kind: 'RESISTANCE' | 'IMMUNITY'
  readonly damageTypeId: string
  readonly bypassedBy: readonly DamageDefenseBypassCode[]
}

/** One Character attack: the action it is made with, the ammunition it fires and its ability. */
export type CharacterAttack = {
  readonly candidate: Pick<
    CharacterActionCandidate,
    'sourceId' | 'equipment' | 'mechanicsOwner' | 'mechanicFacts' | 'activationSourceKind'
  >
  /** The ammunition drawn for this attack, a source of this attack alone. */
  readonly ammunition: { itemInstanceId: string; equipmentId: string } | null
  readonly attackAbility: string | null
}

/**
 * How a System classifies an attack and evaluates what its attacker's grants and its target's
 * defenses make of it. A compiled Effect is the System's own document, so only it reads one.
 */
export interface AttackProfileCapabilityAdapter {
  readonly gameSystemId: string
  /** The attack an action's trigger makes; null for a trigger that makes none. */
  attackKind(triggerCode: string): AttackKind | null
  /** The modifier attack domain an attack reads. */
  attackDomain(kind: AttackKind): AttackDomainCode
  /** The attack traits a holder's accepted grant-fold modifiers give every attack it makes. */
  grantedAttackTraits(
    modifiers: CharacterGrantFoldOutput['modifiers']
  ): readonly DamageDefenseBypassCode[]
  /** The traits a non-Character-action attack has: its kind's own and its holder's granted ones. */
  featureAttackTraits(kind: AttackKind, granted: readonly DamageDefenseBypassCode[]): AttackTraits
  /** The traits a Character attack has from its item and the grants that apply to it. */
  characterAttackTraits(input: {
    candidate: CharacterAttack['candidate']
    attackKind: AttackKind | null
    policy: CharacterRulePolicyOutput
  }): AttackTraits
  /** The critical-hit rules a Character's grants give one attack. */
  characterAttackCriticalRules(
    policy: CharacterRulePolicyOutput,
    domain: AttackDomainCode,
    attack: CharacterAttack
  ): AttackCriticalRulesDto
  /** The attack-roll contributors of one domain that apply to a Character attack, canonically ordered. */
  characterAttackRollContributors(
    policy: CharacterRulePolicyOutput,
    domain: AttackDomainCode,
    attack: CharacterAttack
  ): RollContributor[]
  /** The defenses one damage roll meets; `traits` is null for damage that is not from an attack. */
  attackDamageDefenses(
    defenses: readonly AttackDamageDefense[],
    qualified: readonly QualifiedDamageDefense[],
    traits: AttackTraits | null,
    sourceId: string | null
  ): { kind: AttackDamageDefense['kind']; damageTypeId: string }[]
  /** Settles a compiled attack Effect's path restrictions that need no attacking item. */
  reduceItemlessAttackRestrictions<TEffect extends CompiledEffectGroup>(effect: TEffect): TEffect
  /** The circumstances a compiled attack Effect's paths ask about when it rolls. */
  compiledAttackReads(compiledEffect: unknown): {
    readonly enemyProximity: boolean
    readonly moveToward: boolean
    readonly turnUses: boolean
  }
  /** The once-per-turn uses an attack spent: those of its entries whose damage was dealt. */
  spentTurnUses(compiledEffect: unknown, dealtEntryIds: ReadonlySet<string>): string[]
}
