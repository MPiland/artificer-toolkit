import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { arrows } from '@artificer-toolkit/source-data/srd/equipment/arrows.js'
import { blowgunNeedles } from '@artificer-toolkit/source-data/srd/equipment/blowgun-needles.js'
import { crossbowBoltCase } from '@artificer-toolkit/source-data/srd/equipment/crossbow-bolt-case.js'
import { mapOrScrollCase } from '@artificer-toolkit/source-data/srd/equipment/map-or-scroll-case.js'
import { pouch } from '@artificer-toolkit/source-data/srd/equipment/pouch.js'
import { quiver } from '@artificer-toolkit/source-data/srd/equipment/quiver.js'
import { slingBullets } from '@artificer-toolkit/source-data/srd/equipment/sling-bullets.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { itemCapacityRefusal } from '@artificer-toolkit/rules-runtime/containerCapacity'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-4.T4c (D217): the SRD's counted containers limit their contents through the generic
 * `itemCapacity` option, so a Builder author has the same option and it must pass the equipment
 * node map exactly as authored, and an authored container must fill the way the SRD one does.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

async function normalized(authored: EquipmentAuthored) {
  const result = await normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as unknown as Record<string, unknown>
  })
  expect(result.clearedPaths).toEqual([])
  return result.values
}

describe('item-count container capacity through the equipment node map (D217)', () => {
  it.each([quiver, crossbowBoltCase, mapOrScrollCase, pouch])(
    'keeps the SRD $label limits exactly as authored, with no closed rule',
    async (container) => {
      expect(container.itemCapacity?.length).toBeGreaterThan(0)
      expect(JSON.stringify(container.effects ?? [])).not.toContain('CLOSED_RULE')
      expect(getValueAtPath(await normalized(container), ['itemCapacity'])).toEqual(
        container.itemCapacity
      )
    }
  )

  it('fills an authored bandolier the same way it fills the SRD Pouch', async () => {
    const bandolier: EquipmentAuthored = {
      ...structuredClone(pouch),
      id: '00000000-0000-4000-8000-0000000d2170',
      label: 'Bandolier',
      itemCapacity: [
        { amount: 20, equipmentIds: [slingBullets.id] },
        { amount: 50, equipmentIds: [blowgunNeedles.id] }
      ]
    }
    const authored = await normalized(bandolier)
    expect(getValueAtPath(authored, ['itemCapacity'])).toEqual(bandolier.itemCapacity)

    const contents = [
      { equipmentIds: [slingBullets.id], quantity: 10 },
      { equipmentIds: [arrows.id], quantity: 7 }
    ]
    for (const added of [
      { equipmentIds: [blowgunNeedles.id], quantity: 26, label: blowgunNeedles.label },
      { equipmentIds: [blowgunNeedles.id], quantity: 25, label: blowgunNeedles.label },
      { equipmentIds: [slingBullets.id], quantity: 11, label: slingBullets.label }
    ]) {
      expect(itemCapacityRefusal({ ...bandolier, label: 'Pouch' }, contents, added)).toBe(
        itemCapacityRefusal(pouch, contents, added)
      )
    }
    expect(
      itemCapacityRefusal(pouch, contents, {
        equipmentIds: [blowgunNeedles.id],
        quantity: 26,
        label: blowgunNeedles.label
      })
    ).toBe('"Pouch" has room for only 25 more "Blowgun Needles".')
  })
})
