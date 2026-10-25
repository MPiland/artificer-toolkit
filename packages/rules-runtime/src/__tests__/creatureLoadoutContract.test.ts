import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import {
  encounterCreatureEquipmentReplacementSchema,
  encounterCreatureEquipmentSourceSchema
} from '@artificer-toolkit/schema/projections/encounterCreatureEquipment'
import {
  creatureAuthoredDtoSchema,
  type CreatureEquipmentLoadoutEntryDto
} from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureEquipmentLoadoutEntry } from '@artificer-toolkit/shared/subjects/authored'
import { describe, expect, it } from 'vitest'

import {
  pinCreatureEquipmentSources,
  snapshotCreatureEquipmentItems,
  snapshotCreatureEquipmentLoadout
} from '../encounterCreatureEquipmentSources.js'
import { storedEquipmentSource } from '../testing/storedEquipmentSource.js'

const goblin = srdCreatures.find((creature) => creature.label === 'Goblin')
if (!goblin?.equipmentLoadout) throw new Error('The SRD goblin loadout is missing.')
const authoredLoadout: CreatureEquipmentLoadoutEntryDto[] = goblin.equipmentLoadout
const equipmentById = new Map(srdEquipment.map((document) => [document.id, document]))
const ACTOR_ID = '00000000-0000-4000-8000-00000000a601'

function encounterActor(snapshot: Record<string, unknown>) {
  return { kind: 'CREATURE', systemId: goblin!.systemId, snapshot }
}

function pinGoblinLoadout() {
  return pinCreatureEquipmentSources({
    creature: goblin!,
    equipment: new Map(
      authoredLoadout.map(({ equipmentId }) => [
        equipmentId,
        storedEquipmentSource(equipmentById.get(equipmentId), (id) => equipmentById.get(id))
      ])
    )
  })
}

const [first, second] = authoredLoadout
const refusedLoadouts: [string, CreatureEquipmentLoadoutEntryDto[]][] = [
  ['a duplicate entry identity', [first!, { ...second!, id: first!.id }]],
  [
    'two entries in the main hand',
    authoredLoadout.map((entry) => ({ ...entry, useState: 'MAIN_HAND' as const }))
  ],
  ['a held entry with quantity 2', [{ ...first!, useState: 'MAIN_HAND', quantity: 2 }]],
  ['a non-UUID Equipment identity', [{ ...first!, equipmentId: 'scimitar' }]]
]

describe('Creature loadout contract shared by authoring and Encounters', () => {
  it('reads the authored loadout unchanged in an Encounter', () => {
    expect(creatureAuthoredDtoSchema.safeParse(goblin).success).toBe(true)
    expect(
      snapshotCreatureEquipmentLoadout(
        encounterActor({ payload: { equipmentLoadout: authoredLoadout } })
      )
    ).toEqual(authoredLoadout)
  })

  it.each(refusedLoadouts)(
    'refuses %s in authoring, in the Creature snapshot and in a GM override',
    (_, loadout) => {
      const authored = creatureAuthoredDtoSchema.safeParse({ ...goblin, equipmentLoadout: loadout })
      expect(authored.success).toBe(false)
      expect(authored.error?.issues.every(({ path }) => path[0] === 'equipmentLoadout')).toBe(true)
      expect(() =>
        snapshotCreatureEquipmentLoadout(encounterActor({ payload: { equipmentLoadout: loadout } }))
      ).toThrow('Creature Equipment source snapshot has an invalid loadout.')
      expect(() =>
        snapshotCreatureEquipmentLoadout(
          encounterActor({
            payload: { equipmentLoadout: authoredLoadout },
            equipmentLoadoutOverride: loadout
          })
        )
      ).toThrow('Creature Equipment source snapshot has an invalid loadout.')
    }
  )

  it('pins each authored entry with the shared pin contract and binds it back by loadout identity', () => {
    const sources = pinGoblinLoadout()
    for (const source of sources) {
      expect(encounterCreatureEquipmentSourceSchema.parse(source)).toEqual(source)
    }
    const items = snapshotCreatureEquipmentItems(
      encounterActor({ payload: { equipmentLoadout: authoredLoadout }, equipmentSources: sources })
    )
    expect(items.map(({ entry }) => entry)).toEqual(authoredLoadout)
    expect(items.map(({ source }) => source.loadoutEntryId)).toEqual(
      authoredLoadout.map(({ id }) => id)
    )
  })

  it('records replacement provenance as the pin without its compilation', () => {
    const [source] = pinGoblinLoadout()
    const { compilation: _compilation, ...pin } = source!
    expect(
      encounterCreatureEquipmentReplacementSchema.parse({ ...pin, actorId: ACTOR_ID })
    ).toEqual({ ...pin, actorId: ACTOR_ID })
    expect(
      encounterCreatureEquipmentReplacementSchema.safeParse({ ...source, actorId: ACTOR_ID })
        .success
    ).toBe(false)
  })

  it('keeps the authored domain loadout entry identical to the contract entry', () => {
    const contractEntry: CreatureEquipmentLoadoutEntryDto = first!
    const domainEntry: CreatureEquipmentLoadoutEntry = contractEntry
    const roundTrip: CreatureEquipmentLoadoutEntryDto = domainEntry
    expect(roundTrip).toBe(first)
  })
})
