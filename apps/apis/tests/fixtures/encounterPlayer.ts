import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { srdWolf } from './srdCreatures'

/** An SRD Wolf with hit points no single round of the player's attacks can finish. */
export function createPlayerJourneyWolf(id: string, label: string) {
  return creatureAuthoredDtoSchema.parse({ ...srdWolf, id, label, hitPoints: 200 })
}
