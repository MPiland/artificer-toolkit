import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldOutput,
  CharacterGrantFoldRestriction
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'

import type { CharacterAttack } from '../../attackProfileCapability.js'
import type { ModifierScopeCapabilityAdapter } from '../../modifierScopeCapability.js'
import { DND5E_SYSTEM_ID } from './identity.js'

type ItemCondition = CharacterGrantFoldRestriction[number]['conditions'][number]
type AttackFacts = Pick<Dnd5eModifierTarget, 'item' | 'attackAbility' | 'activation'>

/** The conditions read from the attacking item; any other deferred condition is the encounter's. */
export const DND5E_ITEM_CONDITION_KINDS: ReadonlySet<ItemCondition['kind']> = new Set([
  'ITEM_IDENTITY',
  'ITEM_CATEGORY',
  'ITEM_PROPERTY',
  'ITEM_SOLE_WEAPON',
  'ITEM_ATTACK_ABILITY',
  'ITEM_ACTIVATION'
])

/**
 * The item an attack is made with: its identity then variant ancestry, the grip used, and whether
 * another weapon is equipped alongside it.
 */
export type Dnd5eAttackingItem = {
  readonly equipmentIds: readonly string[]
  readonly category: string | null
  readonly properties: readonly string[]
  readonly grip: 'ONE_HANDED' | 'TWO_HANDED' | null
  readonly otherWeaponEquipped: boolean
}

/**
 * What a modifier consumer evaluates: the sources whose own (SOURCE-scoped) modifiers apply, the
 * attacking item for item facets, the ability the attack uses for attack-ability facets, the
 * activation it is made with and the spell for spell facets.
 */
export type Dnd5eModifierTarget = {
  readonly sourceIds: readonly string[]
  readonly item: Dnd5eAttackingItem | null
  readonly attackAbility: string | null
  readonly activation: string | null
  readonly spellId: string | null
}

/** Character-wide values (saves, skills, initiative, spellcasting) evaluate no source or item. */
export const DND5E_CHARACTER_WIDE_TARGET: Dnd5eModifierTarget = {
  sourceIds: [],
  item: null,
  attackAbility: null,
  activation: null,
  spellId: null
}

/** The facts of one folded modifier that decide where it applies. */
export type Dnd5eModifierApplicability = {
  readonly sourceId: string
  /** The item a SOURCE modifier is bound to; it applies while that item is evaluated instead. */
  readonly boundSourceId?: string
  readonly scope: 'GLOBAL' | 'SOURCE'
  readonly deferredRequirements: CharacterGrantFoldRestriction
  readonly scopeSpellIds: string[]
}

/** An attack-ability or activation condition needs no item, so an unarmed strike can meet it. */
function itemConditionMatches(
  condition: ItemCondition,
  { item, attackAbility, activation }: AttackFacts
): boolean {
  if (condition.kind === 'ITEM_ATTACK_ABILITY')
    return attackAbility !== null && condition.abilityId === attackAbility
  if (condition.kind === 'ITEM_ACTIVATION')
    return activation !== null && condition.requiredIds.includes(activation)
  if (item === null) return false
  switch (condition.kind) {
    case 'ITEM_IDENTITY':
      return (
        condition.mode === 'ALL' ||
        item.equipmentIds.some((id) => condition.requiredIds.includes(id))
      )
    case 'ITEM_CATEGORY':
      return item.category === condition.category
    case 'ITEM_PROPERTY': {
      // An attack made two-handed wields its item as a two-handed weapon.
      const properties =
        item.grip === 'TWO_HANDED' ? [...item.properties, 'TWO_HANDED'] : item.properties
      return (
        (condition.category === null || item.category === condition.category) &&
        condition.requiredProperties.every((property) => properties.includes(property))
      )
    }
    case 'ITEM_SOLE_WEAPON':
      return !item.otherWeaponEquipped
    default:
      return false
  }
}

/**
 * OR-of-AND item groups; a Character-wide value (no item) meets only an empty requirement, or a
 * group of attack-ability and activation conditions alone.
 */
export function dnd5eItemRequirementsMet(
  requirements: CharacterGrantFoldRestriction,
  target: AttackFacts
): boolean {
  if (requirements.length === 0) return true
  return requirements.some(
    (group) =>
      (target.item !== null || group.conditions.length > 0) &&
      group.conditions.every((condition) => {
        // A holder-state condition is decided where the holder's state is known, never here.
        if (!DND5E_ITEM_CONDITION_KINDS.has(condition.kind)) return false
        if (
          target.item === null &&
          condition.kind !== 'ITEM_ATTACK_ABILITY' &&
          condition.kind !== 'ITEM_ACTIVATION'
        )
          return false
        const matches = itemConditionMatches(condition, target)
        return condition.constraint === 'INCLUDE' ? matches : !matches
      })
  )
}

/**
 * A saving-throw advantage or disadvantage that holds only while the holder sees the effect's
 * source. The roll's sight, not the Character's rules, decides it, so no Character-wide save
 * evidence carries it (ATTACK-10.5, D100).
 */
export function dnd5eSaveRequiresSourceSight(
  modifier: Pick<CharacterGrantFoldModifier, 'valueDomainCode' | 'domain'>
): boolean {
  return (
    modifier.valueDomainCode === 'SAVING_THROW_MODIFIER' &&
    modifier.domain.requiresHolderSeesSource === true
  )
}

/**
 * Whether an attack roll grant holds only against the source of the effect holding it (Bestow
 * Curse). The holder's policy leaves it out; the attack reads it once its target is known.
 */
export function dnd5eAttackRequiresEffectSource(
  modifier: Pick<CharacterGrantFoldModifier, 'valueDomainCode' | 'domain'>
): boolean {
  return modifier.valueDomainCode === 'ATTACK_ROLL' && modifier.domain.againstEffectSource === true
}

/**
 * The single D&D modifier scope rule: a GLOBAL modifier applies Character-wide and a SOURCE
 * modifier only while its own source is evaluated (an attack with that item, that item's armor
 * class), or the item it is bound to (Magic Weapon's weapon). Item and spell facets then narrow either kind to the attacking item and the spell.
 */
export function dnd5eModifierApplies(
  modifier: Dnd5eModifierApplicability,
  target: Dnd5eModifierTarget
): boolean {
  return (
    (modifier.scope === 'GLOBAL' ||
      target.sourceIds.includes(modifier.boundSourceId ?? modifier.sourceId)) &&
    dnd5eItemRequirementsMet(modifier.deferredRequirements, target) &&
    (modifier.scopeSpellIds.length === 0 ||
      (target.spellId !== null && modifier.scopeSpellIds.includes(target.spellId)))
  )
}

export const dnd5eModifierScopeCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  appliesCharacterWide: (modifier) =>
    dnd5eModifierApplies(dnd5eAcceptedModifierApplicability(modifier), DND5E_CHARACTER_WIDE_TARGET),
  saveRequiresSourceSight: dnd5eSaveRequiresSourceSight
} as const satisfies ModifierScopeCapabilityAdapter

export function dnd5eAcceptedModifierApplicability(
  modifier: CharacterGrantFoldOutput['modifiers'][number]
): Dnd5eModifierApplicability {
  return {
    sourceId: modifier.sourceId,
    ...(modifier.boundSourceId !== undefined && { boundSourceId: modifier.boundSourceId }),
    scope: modifier.scope,
    deferredRequirements: modifier.deferredRequirements,
    scopeSpellIds: modifier.scopeSpellIds ?? []
  }
}

/** Reads a resolved contribution's applicability from the grant fold that accepted it. */
export function dnd5eFoldedModifierApplicability(
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'>,
  contribution: { readonly acceptedModifierIndex?: number }
): Dnd5eModifierApplicability {
  const modifier =
    contribution.acceptedModifierIndex === undefined
      ? undefined
      : grantFold.modifiers[contribution.acceptedModifierIndex]
  if (modifier === undefined) throw new Error('Character modifier provenance is missing.')
  return dnd5eAcceptedModifierApplicability(modifier)
}

/**
 * A Character action evaluates its own source and, for an item action, the item it attacks with. A
 * Feature attack made with a wielded weapon also takes that weapon's own modifiers (D156). The
 * ammunition an attack fires is a source of that attack only.
 */
export function dnd5eCharacterActionTarget(
  candidate: Pick<
    CharacterActionCandidate,
    'sourceId' | 'equipment' | 'mechanicsOwner' | 'mechanicFacts' | 'activationSourceKind'
  >,
  ammunition?: { itemInstanceId: string; equipmentId: string } | null
): Dnd5eModifierTarget {
  const weapon = candidate.equipment
  const equipmentKey = (item: { itemInstanceId: string; equipmentId: string }) =>
    createCharacterMechanicSourceKey({ kind: 'EQUIPMENT_INSTANCE', ...item })
  return {
    sourceIds: [
      candidate.sourceId,
      ...(candidate.activationSourceKind === 'ACTIVE_SOURCE_AND_EQUIPMENT' && weapon?.equipmentId
        ? [equipmentKey({ equipmentId: weapon.equipmentId, itemInstanceId: weapon.itemInstanceId })]
        : []),
      // The ammunition drawn for this attack is a source of this attack alone (ATTACK-19.4).
      ...(ammunition ? [equipmentKey(ammunition)] : [])
    ],
    item: dnd5eAttackingItem(candidate.equipment),
    attackAbility: null,
    activation: candidate.mechanicFacts.invocation.activation?.code ?? null,
    spellId: candidate.mechanicsOwner.kind === 'SPELL' ? candidate.mechanicsOwner.id : null
  }
}

/** One Character attack's target: its action's sources and item, and the ability it attacks with. */
export function dnd5eCharacterAttackTarget(attack: CharacterAttack): Dnd5eModifierTarget {
  return {
    ...dnd5eCharacterActionTarget(attack.candidate, attack.ammunition),
    attackAbility: attack.attackAbility
  }
}

export function dnd5eAttackingItem(
  equipment: CharacterActionCandidate['equipment']
): Dnd5eAttackingItem | null {
  if (equipment === null) return null
  return {
    equipmentIds: [
      ...(equipment.equipmentId ? [equipment.equipmentId] : []),
      ...equipment.parentEquipmentIds
    ],
    category: equipment.category ?? null,
    properties: equipment.properties ?? [],
    grip: equipment.grip,
    otherWeaponEquipped: equipment.otherWeaponEquipped
  }
}
