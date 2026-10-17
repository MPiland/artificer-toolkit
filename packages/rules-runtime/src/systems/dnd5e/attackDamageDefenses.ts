import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { DamageDefenseBypassCode } from '@artificer-toolkit/shared/core'

import { isDnd5eSpellAttackKind } from './attackKind.js'

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
      .map(
        ({ kind, damageTypeId }) => [`${kind}:${damageTypeId}`, { kind, damageTypeId }] as const
      )
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

/**
 * A Character attack is magical when it is a spell attack or made with a magic item; silvered and
 * adamantine come from the item's Sheet properties.
 */
export function dnd5eCharacterAttackTraits(input: {
  candidate: Pick<CharacterActionCandidate, 'equipment'>
  attackKind: string | null
  itemMechanics: CharacterRulePolicyOutput['itemMechanics']
}): Dnd5eAttackTraits {
  const equipment = input.candidate.equipment
  const item =
    equipment === null
      ? undefined
      : input.itemMechanics.find((entry) => entry.itemInstanceId === equipment.itemInstanceId)
  return {
    magical:
      isDnd5eSpellAttackKind(input.attackKind) || (equipment?.properties ?? []).includes('MAGIC'),
    silvered: item?.properties.silvered === true,
    adamantine: item?.properties.adamantine === true
  }
}
