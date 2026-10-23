import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'

export type TurnMovementEntry = EncounterSessionStateDto['turnMovement'][number]

/**
 * The speed type the movement readout measures against and a voluntary move names (SPELLS-5.6): the
 * member's own choice, else the speed type of the actor's latest move this turn, else the System default movement type, else
 * the first speed type the actor has. Null for an actor with no allowances.
 */
export function selectMovementAllowance(
  movement: Pick<TurnMovementEntry, 'allowances' | 'speedId'>,
  chosenSpeedId: string | null
): TurnMovementEntry['allowances'][number] | null {
  const { allowances } = movement
  return (
    allowances.find(({ speedId }) => chosenSpeedId !== null && speedId === chosenSpeedId) ??
    allowances.find(({ speedId }) => movement.speedId !== null && speedId === movement.speedId) ??
    allowances.find(({ isDefault }) => isDefault) ??
    allowances[0] ??
    null
  )
}
