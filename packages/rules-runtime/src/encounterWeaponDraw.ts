import { planHandDraw, type HandOccupancyItem, type HandSlotCode } from '@artificer-toolkit/shared/core'

export type EncounterWeaponDraw =
  | { kind: 'NONE' }
  | { kind: 'DRAW'; itemId: string; slot: HandSlotCode }
  | { kind: 'RELEASE_REQUIRED' }

/**
 * Whether an attack draws its bound weapon (D107). A weapon already in a hand, an attack with no
 * bound weapon (a natural attack) and hands full of items (swapping stays free) draw nothing; a
 * free hand draws; hands kept occupied only by held creatures need a release first.
 */
export function evaluateEncounterWeaponDraw(input: {
  weapon: { id: string; twoHanded: boolean; drawn: boolean } | null
  hands: readonly HandOccupancyItem[]
  /** The hands the creatures the actor holds fill (`SOURCE_OCCUPIES_HAND`). */
  holds: number
}): EncounterWeaponDraw {
  const { weapon } = input
  if (!weapon || weapon.drawn) return { kind: 'NONE' }
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
