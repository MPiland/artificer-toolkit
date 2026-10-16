import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterGrantFoldOutput,
  CharacterGrantFoldRestriction
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'

import { characterPolicyRecord } from './characterPolicyValues.js'

type ItemCondition = CharacterGrantFoldRestriction[number]['conditions'][number]

/** The conditions read from the attacking item; any other deferred condition is the encounter's. */
export const DND5E_ITEM_CONDITION_KINDS: ReadonlySet<ItemCondition['kind']> = new Set([
  'ITEM_IDENTITY',
  'ITEM_CATEGORY',
  'ITEM_PROPERTY',
  'ITEM_SOLE_WEAPON',
  'ITEM_ATTACK_ABILITY'
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
 * attacking item for item facets, the ability the attack uses for attack-ability facets and the
 * spell for spell facets.
 */
export type Dnd5eModifierTarget = {
  readonly sourceIds: readonly string[]
  readonly item: Dnd5eAttackingItem | null
  readonly attackAbility: string | null
  readonly spellId: string | null
}

/** Character-wide values (saves, skills, initiative, spellcasting) evaluate no source or item. */
export const DND5E_CHARACTER_WIDE_TARGET: Dnd5eModifierTarget = {
  sourceIds: [],
  item: null,
  attackAbility: null,
  spellId: null
}

/** The facts of one folded modifier that decide where it applies. */
type Dnd5eModifierApplicability = {
  readonly sourceId: string
  readonly scope: 'GLOBAL' | 'SOURCE'
  readonly deferredRequirements: CharacterGrantFoldRestriction
  readonly scopeSpellIds: string[]
}

/** An unknown scope narrows to the modifier's own source. */
function dnd5eModifierScope(grant: unknown): 'GLOBAL' | 'SOURCE' {
  return characterPolicyRecord(grant).scope === 'GLOBAL' ? 'GLOBAL' : 'SOURCE'
}

/** An attack-ability condition needs no item, so an unarmed strike can meet it. */
function itemConditionMatches(
  condition: ItemCondition,
  item: Dnd5eAttackingItem | null,
  attackAbility: string | null
): boolean {
  if (condition.kind === 'ITEM_ATTACK_ABILITY')
    return attackAbility !== null && condition.abilityId === attackAbility
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
 * group of attack-ability conditions alone.
 */
export function dnd5eItemRequirementsMet(
  requirements: CharacterGrantFoldRestriction,
  item: Dnd5eAttackingItem | null,
  attackAbility: string | null
): boolean {
  if (requirements.length === 0) return true
  return requirements.some(
    (group) =>
      (item !== null || group.conditions.length > 0) &&
      group.conditions.every((condition) => {
        // A holder-state condition is decided where the holder's state is known, never here.
        if (!DND5E_ITEM_CONDITION_KINDS.has(condition.kind)) return false
        if (item === null && condition.kind !== 'ITEM_ATTACK_ABILITY') return false
        const matches = itemConditionMatches(condition, item, attackAbility)
        return condition.constraint === 'INCLUDE' ? matches : !matches
      })
  )
}

/**
 * A saving-throw advantage or disadvantage that holds only while the holder sees the effect's
 * source. The roll's sight, not the Character's rules, decides it, so no Character-wide save
 * evidence carries it (ATTACK-10.5, D100).
 */
export function dnd5eSaveRequiresSourceSight(grant: unknown): boolean {
  if (typeof grant !== 'object' || grant === null) return false
  const { valueDomainCode, domain } = grant as { valueDomainCode?: unknown; domain?: unknown }
  return (
    valueDomainCode === 'SAVING_THROW_MODIFIER' &&
    typeof domain === 'object' &&
    domain !== null &&
    (domain as { requiresHolderSeesSource?: unknown }).requiresHolderSeesSource === true
  )
}

/**
 * The single D&D modifier scope rule: a GLOBAL modifier applies Character-wide and a SOURCE
 * modifier only while its own source is evaluated (an attack with that item, that item's armor
 * class). Item and spell facets then narrow either kind to the attacking item and the spell.
 */
export function dnd5eModifierApplies(
  modifier: Dnd5eModifierApplicability,
  target: Dnd5eModifierTarget
): boolean {
  return (
    (modifier.scope === 'GLOBAL' || target.sourceIds.includes(modifier.sourceId)) &&
    dnd5eItemRequirementsMet(modifier.deferredRequirements, target.item, target.attackAbility) &&
    (modifier.scopeSpellIds.length === 0 ||
      (target.spellId !== null && modifier.scopeSpellIds.includes(target.spellId)))
  )
}

export function dnd5eAcceptedModifierApplicability(
  modifier: CharacterGrantFoldOutput['modifiers'][number]
): Dnd5eModifierApplicability {
  return {
    sourceId: modifier.sourceId,
    scope: dnd5eModifierScope(modifier.grant),
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

/** A Character action evaluates its own source and, for an item action, the item it attacks with. */
export function dnd5eCharacterActionTarget(
  candidate: Pick<CharacterActionCandidate, 'sourceId' | 'equipment' | 'mechanicsOwner'>
): Dnd5eModifierTarget {
  return {
    sourceIds: [candidate.sourceId],
    item: dnd5eAttackingItem(candidate.equipment),
    attackAbility: null,
    spellId: candidate.mechanicsOwner.kind === 'SPELL' ? candidate.mechanicsOwner.id : null
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
