import { ACTIVATION_CODE, TRIGGER, type HandOccupancy } from '@artificer-toolkit/shared/core'

/** An action the actor may choose now, with the held item it attacks through, if any. */
export type DefaultAttackChoice = {
  id: string
  /** It resolves without a warning (its activation is still available). */
  available: boolean
  /** It would make the next attack of the Attack action open this turn. */
  continuesAttack: boolean
  /** The Character item instance or Creature loadout entry the action is bound to. */
  itemId: string | null
  activationCode: string | null
  triggerCode: string | null
}

const WEAPON_ATTACK_TRIGGERS: ReadonlySet<string> = new Set([
  TRIGGER.MELEE_WEAPON_ATTACK,
  TRIGGER.RANGED_WEAPON_ATTACK
])

/**
 * The action the drawer starts on (D107): the open Attack action's last weapon while it has an attack
 * left, otherwise the main-hand weapon's Action attack, otherwise the off-hand weapon's bonus attack.
 */
export function encounterDefaultAttackActionId(input: {
  choices: readonly DefaultAttackChoice[]
  hands: Pick<HandOccupancy, 'mainHandId' | 'offHandId'>
  /** The action of the last attack in the Attack action open this turn, if one is open. */
  lastAttackActionId: string | null
}): string | null {
  const { choices, hands } = input
  const continued = choices.find(
    (choice) => choice.id === input.lastAttackActionId && choice.continuesAttack
  )
  if (continued) return continued.id
  const heldAttack = (itemId: string | null, activationCode: string) =>
    itemId === null
      ? undefined
      : choices.find(
          (choice) =>
            choice.available &&
            choice.itemId === itemId &&
            choice.activationCode === activationCode &&
            choice.triggerCode !== null &&
            WEAPON_ATTACK_TRIGGERS.has(choice.triggerCode)
        )
  return (
    (
      heldAttack(hands.mainHandId, ACTIVATION_CODE.ACTION) ??
      heldAttack(hands.offHandId, ACTIVATION_CODE.BONUS_ACTION)
    )?.id ?? null
  )
}
