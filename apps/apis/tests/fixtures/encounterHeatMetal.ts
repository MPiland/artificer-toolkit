import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { seededSrdCreature } from './srdCreatures'

/** The SRD Ogre holding a Longsword (metal) in its main hand, the manufactured object Heat Metal heats. */
export function createHeatMetalOgre(id: string, label: string) {
  const ogre = seededSrdCreature('Ogre')
  return creatureAuthoredDtoSchema.parse({
    ...ogre,
    id,
    label,
    equipmentLoadout: ogre.equipmentLoadout?.map((entry) =>
      entry.useState === 'MAIN_HAND' ? { ...entry, equipmentId: longsword.id } : entry
    )
  })
}
