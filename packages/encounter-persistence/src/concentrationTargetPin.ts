import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'

/**
 * True when a Concentration check's pinned Character stream no longer fits its holder: a Character
 * must still be at the pinned stream version, and a Creature or custom actor has no stream to pin.
 */
export async function concentrationTargetPinChanged(
  target: Pick<EncounterRunActorState, 'kind' | 'sourceId'>,
  pin: { streamVersion: number } | null,
  currentCharacterStreamVersion: (characterId: string) => Promise<number>
) {
  if (target.kind !== 'CHARACTER') return pin !== null
  if (pin === null || target.sourceId === null) return true
  return (await currentCharacterStreamVersion(target.sourceId)) !== pin.streamVersion
}
