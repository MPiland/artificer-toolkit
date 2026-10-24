import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { AttackKind } from '@artificer-toolkit/schema/shared/enums'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { DamageDefenseBypassCode } from '@artificer-toolkit/shared/core'

import type {
  AttackDamageDefense,
  AttackProfileCapabilityAdapter,
  AttackTraits,
  QualifiedDamageDefense
} from '../../attackProfileCapability.js'
import { dnd5eAttackKind, dnd5eAttackModifierDomain, isDnd5eSpellAttackKind } from './attackKind.js'
import {
  effectReadsEnemyProximity,
  effectReadsMoveToward,
  effectReadsTurnUses,
  reduceEffectRestrictions,
  spentTurnUses
} from './attackRestrictions.js'
import { dnd5eAttackCriticalRules } from './characterCriticalRules.js'
import { dnd5eAttackRollContributors } from './characterRollModes.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import {
  dnd5eAcceptedModifierApplicability,
  dnd5eCharacterActionTarget,
  dnd5eCharacterAttackTarget,
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eModifierApplies,
  type Dnd5eModifierApplicability,
  type Dnd5eModifierTarget
} from './modifierApplicability.js'

const TRAIT_BY_BYPASS: Record<DamageDefenseBypassCode, keyof AttackTraits> = {
  MAGICAL: 'magical',
  SILVERED: 'silvered',
  ADAMANTINE: 'adamantine'
}

/**
 * The defenses one damage roll meets. A qualified defense protects only against an attack that has
 * none of its bypassing traits; damage that is not from an attack (`traits` null) is not "from
 * nonmagical attacks", so qualified defenses never apply to it. A defense limited to authored
 * content (`sourceEffectIds`) applies only to damage from an action that content owns
 * (`sourceId`); it comes back as a plain defense.
 */
export function dnd5eAttackDamageDefenses(
  defenses: readonly AttackDamageDefense[],
  qualified: readonly QualifiedDamageDefense[],
  traits: AttackTraits | null,
  sourceId: string | null
): { kind: AttackDamageDefense['kind']; damageTypeId: string }[] {
  const applicable = new Map(
    defenses
      .filter(
        ({ sourceEffectIds }) =>
          !sourceEffectIds?.length || (sourceId !== null && sourceEffectIds.includes(sourceId))
      )
      .map(({ kind, damageTypeId }) => [`${kind}:${damageTypeId}`, { kind, damageTypeId }] as const)
  )
  if (traits !== null)
    for (const defense of qualified)
      if (!defense.bypassedBy.some((bypass) => traits[TRAIT_BY_BYPASS[bypass]]))
        applicable.set(`${defense.kind}:${defense.damageTypeId}`, {
          kind: defense.kind,
          damageTypeId: defense.damageTypeId
        })
  return [...applicable.values()]
}

/** An `ATTACK_TRAIT` grant: the trait it gives and where it applies. */
export type Dnd5eAttackTraitGrant = {
  readonly trait: DamageDefenseBypassCode
  readonly applicability: Dnd5eModifierApplicability
}

/** The `ATTACK_TRAIT` grants among a holder's modifiers, whichever fold shape they come in. */
export function dnd5eAttackTraitGrants<
  M extends { valueDomainCode: string; domain: { trait?: DamageDefenseBypassCode } }
>(
  modifiers: readonly M[],
  applicability: (modifier: M) => Dnd5eModifierApplicability
): Dnd5eAttackTraitGrant[] {
  return modifiers.flatMap((modifier) =>
    modifier.valueDomainCode === 'ATTACK_TRAIT' && modifier.domain.trait !== undefined
      ? [{ trait: modifier.domain.trait, applicability: applicability(modifier) }]
      : []
  )
}

/** The traits the grants that apply to this attack give it. */
export function dnd5eGrantedAttackTraits(
  grants: readonly Dnd5eAttackTraitGrant[],
  target: Dnd5eModifierTarget
): ReadonlySet<DamageDefenseBypassCode> {
  return new Set(
    grants.flatMap(({ trait, applicability }) =>
      dnd5eModifierApplies(applicability, target) ? [trait] : []
    )
  )
}

/**
 * A Character attack is magical when it is a spell attack or made with a magic item; silvered and
 * adamantine come from the item's Sheet properties. An ATTACK_TRAIT grant that applies to the
 * attack adds its trait (Magic Weapon's weapon becomes magical).
 */
export function dnd5eCharacterAttackTraits(input: {
  candidate: Pick<
    CharacterActionCandidate,
    'sourceId' | 'equipment' | 'mechanicsOwner' | 'mechanicFacts' | 'activationSourceKind'
  >
  attackKind: AttackKind | null
  policy: Pick<CharacterRulePolicyOutput, 'itemMechanics' | 'grantFold'>
}): AttackTraits {
  const equipment = input.candidate.equipment
  const item =
    equipment === null
      ? undefined
      : input.policy.itemMechanics.find(
          (entry) => entry.itemInstanceId === equipment.itemInstanceId
        )
  const attackDomain =
    input.attackKind === null ? null : dnd5eAttackModifierDomain(input.attackKind)
  const granted = dnd5eGrantedAttackTraits(
    dnd5eAttackTraitGrants(
      input.policy.grantFold.modifiers.filter(
        ({ domain }) => domain.attackDomain === undefined || domain.attackDomain === attackDomain
      ),
      dnd5eAcceptedModifierApplicability
    ),
    dnd5eCharacterActionTarget(input.candidate)
  )
  return {
    magical:
      isDnd5eSpellAttackKind(input.attackKind) ||
      (equipment?.properties ?? []).includes('MAGIC') ||
      granted.has('MAGICAL'),
    silvered: item?.properties.silvered === true || granted.has('SILVERED'),
    adamantine: item?.properties.adamantine === true || granted.has('ADAMANTINE')
  }
}

/** The attack traits a holder's grants give every attack it makes, whatever it attacks with. */
function dnd5eHolderAttackTraits(
  modifiers: CharacterGrantFoldOutput['modifiers']
): DamageDefenseBypassCode[] {
  return [
    ...dnd5eGrantedAttackTraits(
      dnd5eAttackTraitGrants(modifiers, dnd5eAcceptedModifierApplicability),
      DND5E_CHARACTER_WIDE_TARGET
    )
  ]
}

export const dnd5eAttackProfileCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  attackKind: dnd5eAttackKind,
  attackDomain: dnd5eAttackModifierDomain,
  grantedAttackTraits: dnd5eHolderAttackTraits,
  // Whatever a spell does, it does by magic: its conditions and zones come from a magical source.
  spellCastSourceTraits: ['MAGICAL'],
  // A spell attack is magical; any other non-Character-action attack is only what its grants make it.
  featureAttackTraits: (kind, granted) => ({
    magical: isDnd5eSpellAttackKind(kind) || granted.includes('MAGICAL'),
    silvered: granted.includes('SILVERED'),
    adamantine: granted.includes('ADAMANTINE')
  }),
  characterAttackTraits: dnd5eCharacterAttackTraits,
  characterAttackCriticalRules: (policy, domain, attack) =>
    dnd5eAttackCriticalRules(policy, domain, dnd5eCharacterAttackTarget(attack)),
  characterAttackRollContributors: (policy, domain, attack) =>
    dnd5eAttackRollContributors(policy, domain, dnd5eCharacterAttackTarget(attack)),
  attackDamageDefenses: dnd5eAttackDamageDefenses,
  reduceItemlessAttackRestrictions: (effect) => reduceEffectRestrictions(effect, null),
  compiledAttackReads: (compiledEffect) => {
    const effect = compiledEffect as CompiledEffectGroup
    return {
      enemyProximity: effectReadsEnemyProximity(effect),
      moveToward: effectReadsMoveToward(effect),
      turnUses: effectReadsTurnUses(effect)
    }
  },
  spentTurnUses: (compiledEffect, dealtEntryIds) =>
    spentTurnUses(compiledEffect as CompiledEffectGroup, dealtEntryIds)
} as const satisfies AttackProfileCapabilityAdapter
