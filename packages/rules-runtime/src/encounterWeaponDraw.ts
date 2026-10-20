import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { AttackKind } from '@artificer-toolkit/schema/shared/enums'
import {
  EQUIPMENT_PROPERTY_CODE,
  isHandSlot,
  planHandDraw,
  type EquipmentSlotCode,
  type HandOccupancyItem,
  type HandSlotCode
} from '@artificer-toolkit/shared/core'

export type EncounterWeaponDraw =
  | { kind: 'NONE' }
  | { kind: 'DRAW'; itemId: string; slot: HandSlotCode }
  | { kind: 'THROW'; itemId: string; slot: HandSlotCode }
  | { kind: 'RELEASE_REQUIRED' }

/** Whether the attack changes the actor's equipment: a draw into a hand or a throw out of it. */
export function movesEncounterWeapon(
  draw: EncounterWeaponDraw
): draw is Extract<EncounterWeaponDraw, { kind: 'DRAW' | 'THROW' }> {
  return draw.kind === 'DRAW' || draw.kind === 'THROW'
}

/** The weapon an attack is bound to: `thrown` when the attack hurls it (a ranged attack through a Thrown weapon). */
export type EncounterAttackWeapon = {
  id: string
  twoHanded: boolean
  drawn: boolean
  thrown: boolean
}

/** Whether an attack of this kind through a weapon with these properties throws the weapon (D107). */
function throwsWeapon(attackKind: AttackKind | null, properties: readonly string[]): boolean {
  return attackKind === 'RANGED' && properties.includes(EQUIPMENT_PROPERTY_CODE.THROWN)
}

/**
 * What an attack does with its bound weapon (D107). A thrown weapon leaves the hand it is in and
 * needs no hand to be thrown from carried; any other weapon is drawn: a weapon already in a hand,
 * an attack with no bound weapon (a natural attack) and hands full of items (swapping stays free)
 * draw nothing, a free hand draws, and hands kept occupied only by held creatures need a release
 * first.
 */
export function evaluateEncounterWeaponDraw(input: {
  weapon: EncounterAttackWeapon | null
  hands: readonly HandOccupancyItem[]
  /** The hands the creatures the actor holds fill (`SOURCE_OCCUPIES_HAND`). */
  holds: number
}): EncounterWeaponDraw {
  const { weapon } = input
  if (!weapon) return { kind: 'NONE' }
  if (weapon.thrown) {
    const hand = input.hands.find(({ id }) => id === weapon.id)?.slot
    return weapon.drawn && hand && isHandSlot(hand)
      ? { kind: 'THROW', itemId: weapon.id, slot: hand }
      : { kind: 'NONE' }
  }
  if (weapon.drawn) return { kind: 'NONE' }
  const plan = planHandDraw(weapon, input.hands, input.holds)
  switch (plan.kind) {
    case 'DRAW':
      return { kind: 'DRAW', itemId: weapon.id, slot: plan.slot }
    case 'RELEASE_REQUIRED':
      return { kind: 'RELEASE_REQUIRED' }
    case 'NO_HAND':
      return { kind: 'NONE' }
  }
}

/** The weapon a Character's attack action draws; null for an action with no wielded grip. */
export function characterActionDrawWeapon(
  equipment: CharacterActionCandidate['equipment'] | undefined,
  attackKind: AttackKind | null
): EncounterAttackWeapon | null {
  const properties = equipment?.properties ?? []
  return equipment?.grip
    ? {
        id: equipment.itemInstanceId,
        twoHanded: properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED),
        drawn: equipment.equipped,
        thrown: throwsWeapon(attackKind, properties)
      }
    : null
}

/** The loadout weapon a Creature's action is bound to; natural attacks bind none. */
export function creatureActionDrawWeapon(
  items: readonly {
    entry: { id: string; useState: EquipmentSlotCode }
    source: { payload: { properties: readonly string[] } }
  }[],
  loadoutEntryId: string | undefined,
  attackKind: AttackKind | null
): EncounterAttackWeapon | null {
  const item = items.find(({ entry }) => entry.id === loadoutEntryId)
  if (!item) return null
  const { properties } = item.source.payload
  return {
    id: item.entry.id,
    twoHanded: properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED),
    drawn: isHandSlot(item.entry.useState),
    thrown: throwsWeapon(attackKind, properties)
  }
}
