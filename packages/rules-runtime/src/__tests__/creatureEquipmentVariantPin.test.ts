import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { baseEquipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import {
  resolveEquipmentAuthored,
  type ResolvedEquipment
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { describe, expect, it } from 'vitest'

import {
  pinCreatureEquipmentSources,
  snapshotCreatureEquipmentSources
} from '../encounterCreatureEquipmentSources.js'
import { storedEquipmentSource } from '../testing/storedEquipmentSource.js'

const equipmentById = new Map(srdEquipment.map((document) => [document.id, document]))
const shieldPlus1 = srdEquipment.find((document) => document.label === 'Shield +1')
if (!shieldPlus1) throw new Error('SRD shields are missing.')

const LOADOUT_ENTRY_ID = '00000000-0000-4000-8000-00000000f001'

const goblin = {
  systemId: SRD_SYSTEM_ID,
  abilityScores: { DEXTERITY: 14 },
  naturalArmorBonus: 0
}

function offHandLoadout(equipmentId: string) {
  return [
    {
      id: LOADOUT_ENTRY_ID,
      equipmentId,
      quantity: 1,
      useState: 'OFF_HAND' as const,
      attuned: false,
      actionFeatureIds: []
    }
  ]
}

function pinShieldPlus1() {
  const stored = storedEquipmentSource(shieldPlus1, (id) => equipmentById.get(id), { version: 3 })
  const loadout = offHandLoadout(shieldPlus1!.id)
  const [source] = pinCreatureEquipmentSources({
    creature: { ...goblin, equipmentLoadout: loadout },
    equipment: new Map([[shieldPlus1!.id, stored]])
  })
  return { stored, loadout, source: source! }
}

describe('Creature Equipment variant pins', () => {
  it('pins a variant as the stored compilation of its resolved Equipment under the variant identity', () => {
    const { stored, loadout, source } = pinShieldPlus1()
    expect(source.equipmentId).toBe(shieldPlus1.id)
    expect(source.compilation).toEqual(stored.compilation)
    expect(source.sourceChecksum).toBe(stored.checksum)
    expect(source.sourceRevision).toBe(3)
    expect(source).not.toHaveProperty('payload')
    const [parsed] = snapshotCreatureEquipmentSources({
      kind: 'CREATURE',
      systemId: SRD_SYSTEM_ID,
      snapshot: { payload: { equipmentLoadout: loadout }, equipmentSources: [source] }
    })
    expect(parsed?.compiled.id).toBe(shieldPlus1.id)
    expect(parsed?.compiled.category).toBe('SHIELD')
    expect(parsed?.compiled.armorClass).toBe(2)
    expect(parsed?.compiled.parentEquipmentIds).toHaveLength(1)
    expect(parsed?.compiled.modifiers?.some((modifier) => modifier.modifierKind === 'BONUS')).toBe(
      true
    )
  })

  it('refuses a pinned variant whose compilation no longer matches its checksum', () => {
    const { loadout, source } = pinShieldPlus1()
    const projection = JSON.parse(source.compilation.projectionJson) as Record<string, unknown>
    expect(() =>
      snapshotCreatureEquipmentSources({
        kind: 'CREATURE',
        systemId: SRD_SYSTEM_ID,
        snapshot: {
          payload: { equipmentLoadout: loadout },
          equipmentSources: [
            {
              ...source,
              compilation: {
                ...source.compilation,
                projectionJson: JSON.stringify({ ...projection, armorClass: 9 })
              }
            }
          ]
        }
      })
    ).toThrow(/checksum/)
  })

  it('refuses a pinned source whose compilation belongs to another document version', () => {
    const { loadout, source } = pinShieldPlus1()
    expect(() =>
      snapshotCreatureEquipmentSources({
        kind: 'CREATURE',
        systemId: SRD_SYSTEM_ID,
        snapshot: {
          payload: { equipmentLoadout: loadout },
          equipmentSources: [{ ...source, sourceChecksum: 'a'.repeat(64) }]
        }
      })
    ).toThrow(/stale/)
  })

  it('refuses to pin Equipment whose armor class a Creature cannot evaluate', () => {
    const resolved: ResolvedEquipment = resolveEquipmentAuthored(
      shieldPlus1 as EquipmentAuthored,
      (id) => equipmentById.get(id) as EquipmentAuthored | undefined
    )
    const pinned = baseEquipmentAuthoredDtoSchema.parse(JSON.parse(JSON.stringify(resolved)))
    // ATTACK-6.T4a: a Creature folds any modifier restriction as a Character does, so the one armor
    // class it cannot evaluate is a held shield without one (D143).
    const { armorClass: _armorClass, ...document } = pinned
    expect(() =>
      pinCreatureEquipmentSources({
        creature: { ...goblin, equipmentLoadout: offHandLoadout(shieldPlus1.id) },
        equipment: new Map([[shieldPlus1.id, storedEquipmentSource(document)]])
      })
    ).toThrow(`Equipment "${shieldPlus1.id}" is armor or a shield without an armor class.`)
  })
})
