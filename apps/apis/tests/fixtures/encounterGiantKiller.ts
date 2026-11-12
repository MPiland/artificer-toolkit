import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { seededSrdCreature } from './srdCreatures'

/** The SRD Ogre as seeded: a Large creature whose Greatclub reaches 5 feet. */
export function createGiantKillerOgre(id: string, label: string) {
  return creatureAuthoredDtoSchema.parse({ ...seededSrdCreature('Ogre'), id, label })
}

/** The SRD Hunter's Giant Killer option as a Feature the Character has at 1st level, exactly as authored. */
export function createGiantKillerFeatures() {
  const option = hunterConclave.features
    ?.find(({ label }) => label === "Hunter's Prey")
    ?.options?.find(({ label }) => label === 'Giant Killer')
  if (!option?.effects) throw new Error('The SRD Hunter has no Giant Killer.')
  // A Character's own Feature owns its ids: each authored id is replaced, references among them kept.
  const fresh = new Map<string, string>()
  const effects: typeof option.effects = JSON.parse(
    JSON.stringify(option.effects).replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      (id) => {
        const replacement = fresh.get(id) ?? crypto.randomUUID()
        fresh.set(id, replacement)
        return replacement
      }
    )
  )
  return [
    {
      id: crypto.randomUUID(),
      label: option.label,
      description: option.description,
      availableAtLevel: 1,
      order: 90,
      effects
    }
  ]
}
