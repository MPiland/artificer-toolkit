import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { baseEquipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { describe, expect, it } from 'vitest'

import {
  pinCreatureEquipmentSources,
  resolveEquipmentSourceRecord,
  snapshotCreatureEquipmentSources
} from '../encounterCreatureEquipmentSources.js'

const equipmentById = new Map(srdEquipment.map((document) => [document.id, document]))
const shieldPlus1 = srdEquipment.find((document) => document.label === 'Shield +1')
const shield = srdEquipment.find((document) => document.label === 'Shield')
if (!shieldPlus1 || !shield) throw new Error('SRD shields are missing.')

const SOURCE_VERSION_ID = '00000000-0000-4000-8000-00000000e002'
const LOADOUT_ENTRY_ID = '00000000-0000-4000-8000-00000000f001'

const goblin = {
  systemId: SRD_SYSTEM_ID,
  abilityScores: { DEXTERITY: 14 },
  naturalArmorBonus: 0
}

function record(document: unknown) {
  return {
    document,
    checksum: checksumRuleDocument(document),
    version: 3,
    versionId: SOURCE_VERSION_ID
  }
}

function pinShieldPlus1() {
  const authored = resolveEquipmentSourceRecord(record(shieldPlus1), (id) => equipmentById.get(id))
  const loadout = [
    {
      id: LOADOUT_ENTRY_ID,
      equipmentId: shieldPlus1!.id,
      quantity: 1,
      useState: 'OFF_HAND' as const,
      attuned: false,
      actionFeatureIds: []
    }
  ]
  const [source] = pinCreatureEquipmentSources({
    creature: { ...goblin, equipmentLoadout: loadout },
    equipmentRecords: new Map([[shieldPlus1!.id, { authored }]])
  })
  return { authored, loadout, source: source! }
}

describe('Creature Equipment variant pins', () => {
  it('pins a variant as its resolved Equipment under the variant identity', () => {
    const { authored, source } = pinShieldPlus1()
    expect(source.equipmentId).toBe(shieldPlus1.id)
    expect(source.payload.id).toBe(shieldPlus1.id)
    expect(source.payload.category).toBe('SHIELD')
    expect(source.payload).toHaveProperty('armorClass', 2)
    expect(source.sourceChecksum).toBe(authored.checksum)
    expect(source.sourceRevision).toBe(3)
  })

  it('parses the pinned variant back from an Encounter snapshot', () => {
    const { loadout, source } = pinShieldPlus1()
    const [parsed] = snapshotCreatureEquipmentSources({
      kind: 'CREATURE',
      systemId: SRD_SYSTEM_ID,
      snapshot: { payload: { equipmentLoadout: loadout }, equipmentSources: [source] }
    })
    expect(parsed?.compiled.category).toBe('SHIELD')
    expect(parsed?.compiled.modifiers?.some((modifier) => modifier.modifierKind === 'BONUS')).toBe(
      true
    )
  })

  it('refuses a pinned variant whose payload no longer matches its checksum', () => {
    const { loadout, source } = pinShieldPlus1()
    expect(() =>
      snapshotCreatureEquipmentSources({
        kind: 'CREATURE',
        systemId: SRD_SYSTEM_ID,
        snapshot: {
          payload: { equipmentLoadout: loadout },
          equipmentSources: [{ ...source, payload: { ...source.payload, armorClass: 9 } }]
        }
      })
    ).toThrow(/checksum/)
  })

  it('refuses to pin Equipment whose armor class a Creature cannot evaluate', () => {
    const resolved = resolveEquipmentSourceRecord(record(shieldPlus1), (id) =>
      equipmentById.get(id)
    )
    const pinned = baseEquipmentAuthoredDtoSchema.parse(resolved.document)
    // A conditional modifier is any armor class modifier that is not the while-equipped form.
    const document = {
      ...pinned,
      modifiers: pinned.modifiers?.map(({ restrictions: _restrictions, ...modifier }) => modifier)
    }
    expect(() =>
      pinCreatureEquipmentSources({
        creature: {
          ...goblin,
          equipmentLoadout: [
            {
              id: LOADOUT_ENTRY_ID,
              equipmentId: shieldPlus1.id,
              useState: 'OFF_HAND' as const,
              actionFeatureIds: []
            }
          ]
        },
        equipmentRecords: new Map([[shieldPlus1.id, { authored: { ...record(document) } }]])
      })
    ).toThrow(
      `Equipment "${shieldPlus1.id}" has an armor class modifier that is not the while-equipped form, which a Creature cannot evaluate.`
    )
  })

  it('refuses a variant whose parent cannot be resolved', () => {
    expect(() => resolveEquipmentSourceRecord(record(shieldPlus1), () => undefined)).toThrow(
      /missing parent/
    )
  })
})
