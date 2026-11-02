import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { ancientRedDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-red-dragon.js'
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'
import { srdCreatureRecord, srdWolf } from './srdCreatures'

/**
 * The SRD Ancient Red Dragon's Legendary Actions narrowed to its Wing Attack and redrawn as a
 * 90-foot cone the owner aims (SPELLS-15): the same save, damage and prone, as an area breath.
 */
function legendaryBreath() {
  const legendary = srdCreatureRecord(ancientRedDragon.id).features?.find(
    (feature) => feature.label === 'Legendary Actions'
  )
  if (!legendary) throw new Error('The SRD Legendary Actions are missing.')
  return {
    ...legendary,
    options: legendary.options
      ?.filter((option) => option.label.startsWith('Wing Attack'))
      .map((option) => ({
        ...option,
        effects: option.effects?.map((effect) =>
          effect.invocation.kind === 'ACTION' && effect.invocation.shape
            ? {
                ...effect,
                invocation: {
                  ...effect.invocation,
                  shape: {
                    id: effect.invocation.shape.id,
                    shapeKind: 'CONE' as const,
                    length: { amount: 90, unit: 'FEET' as const }
                  }
                }
              }
            : effect
        )
      }))
  }
}

/**
 * An SRD Wolf that casts the SRD Black Dragon Wyrmling's Acid Breath (5d8, DC 11 Dexterity, half on
 * a success) over a 20-foot sphere anywhere within 150 feet, the shape of Fireball. It also holds
 * a Legendary breath option: a 90-foot cone it aims at the end of another Creature's turn.
 */
export function createAreaCaster(id: string, label: string) {
  const breath = srdCreatureRecord(blackDragonWyrmling.id).features?.find((feature) =>
    feature.label.startsWith('Acid Breath')
  )
  if (!breath) throw new Error('The SRD Acid Breath action is missing.')
  return creatureAuthoredDtoSchema.parse({
    ...srdWolf,
    id,
    label,
    features: [
      ...(srdWolf.features ?? []),
      legendaryBreath(),
      {
        ...breath,
        effects: breath.effects?.map((effect) => {
          if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action.')
          return {
            ...effect,
            invocation: {
              ...effect.invocation,
              range: {
                id: effect.invocation.range.id,
                rangeKind: 'DISTANCE' as const,
                amount: 150,
                unit: 'FEET' as const
              },
              targeting: {
                selectionKind: 'AREA_CONTENTS' as const,
                dispositionKind: 'ANY' as const
              },
              shape: {
                id: '00000000-0000-4000-8000-000000000c97',
                shapeKind: 'SPHERE' as const,
                radius: { amount: 20, unit: 'FEET' as const }
              }
            }
          }
        })
      }
    ]
  })
}

/** An SRD Wolf under another label, a creature the area can catch or miss. */
export function createAreaWolf(id: string, label: string) {
  return creatureAuthoredDtoSchema.parse({ ...srdWolf, id, label })
}
