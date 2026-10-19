import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { DamageDefenseBypassCode } from '@artificer-toolkit/shared/core'

import { isDnd5eSpellAttackKind } from './attackKind.js'
import {
  dnd5eAcceptedModifierApplicability,
  dnd5eCharacterActionTarget,
  dnd5eModifierApplies,
  type Dnd5eModifierApplicability,
  type Dnd5eModifierTarget
} from './modifierApplicability.js'

type DamageDefense = {
  kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
  damageTypeId: string
  /** Applies only to damage from actions owned by this authored content; absent or empty: any. */
  sourceEffectIds?: readonly string[]
}

/** A defense such as "bludgeoning, piercing, and slashing from nonmagical attacks". */
export type Dnd5eQualifiedDamageDefense = {
  readonly kind: 'RESISTANCE' | 'IMMUNITY'
  readonly damageTypeId: string
  readonly bypassedBy: readonly DamageDefenseBypassCode[]
}

type Dnd5eAttackTraits = Readonly<Record<'magical' | 'silvered' | 'adamantine', boolean>>

const TRAIT_BY_BYPASS: Record<DamageDefenseBypassCode, keyof Dnd5eAttackTraits> = {
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
  defenses: readonly DamageDefense[],
  qualified: readonly Dnd5eQualifiedDamageDefense[],
  traits: Dnd5eAttackTraits | null,
  sourceId: string | null
): { kind: DamageDefense['kind']; damageTypeId: string }[] {
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
  attackKind: string | null
  policy: Pick<CharacterRulePolicyOutput, 'itemMechanics' | 'grantFold'>
}): Dnd5eAttackTraits {
  const equipment = input.candidate.equipment
  const item =
    equipment === null
      ? undefined
      : input.policy.itemMechanics.find(
          (entry) => entry.itemInstanceId === equipment.itemInstanceId
        )
  const granted = dnd5eGrantedAttackTraits(
    dnd5eAttackTraitGrants(input.policy.grantFold.modifiers, dnd5eAcceptedModifierApplicability),
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
