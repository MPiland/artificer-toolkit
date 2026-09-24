import { describe, expect, it } from 'vitest'
import {
  collectTopLevelReferenceCandidates,
  stripPortableMetadata
} from '../utils/portableContent.js'

describe('portable content utilities', () => {
  it('recursively strips transport metadata while preserving authored and unknown ids', () => {
    expect(
      stripPortableMetadata({
        id: 'root',
        userId: 'owner',
        status: 'ACTIVE',
        nested: [
          {
            id: 'nested',
            updatedAt: 'now',
            unknownId: 'keep-me',
            value: { permissions: { canEdit: true }, label: 'Keep this' }
          }
        ]
      })
    ).toEqual({
      id: 'root',
      nested: [{ id: 'nested', unknownId: 'keep-me', value: { label: 'Keep this' } }]
    })
  })

  it('collects every recognized reference key in first-seen order and deduplicates ids', () => {
    const candidates = collectTopLevelReferenceCandidates({
      parentClassId: 'class-1',
      nested: [
        { classIds: ['class-2', 'class-1'], parentRaceId: 'race-1' },
        { raceId: 'race-2', backgroundId: 'background-1' }
      ],
      parentEquipmentId: 'equipment-parent',
      equipmentId: 'equipment-1',
      equipmentIds: ['equipment-2', 'equipment-1'],
      featId: 'feat-1',
      featIds: ['feat-2'],
      spellId: 'spell-1',
      spellIds: ['spell-2'],
      creatureId: 'creature-1',
      creatureIds: ['creature-2'],
      vehicleId: 'vehicle-1',
      vehicleIds: ['vehicle-2']
    })

    expect(candidates).toEqual([
      { kind: 'CLASS', id: 'class-1' },
      { kind: 'CLASS', id: 'class-2' },
      { kind: 'RACE', id: 'race-1' },
      { kind: 'RACE', id: 'race-2' },
      { kind: 'BACKGROUND', id: 'background-1' },
      { kind: 'EQUIPMENT', id: 'equipment-parent' },
      { kind: 'EQUIPMENT', id: 'equipment-1' },
      { kind: 'EQUIPMENT', id: 'equipment-2' },
      { kind: 'FEAT', id: 'feat-1' },
      { kind: 'FEAT', id: 'feat-2' },
      { kind: 'SPELL', id: 'spell-1' },
      { kind: 'SPELL', id: 'spell-2' },
      { kind: 'CREATURE', id: 'creature-1' },
      { kind: 'CREATURE', id: 'creature-2' },
      { kind: 'VEHICLE', id: 'vehicle-1' },
      { kind: 'VEHICLE', id: 'vehicle-2' }
    ])
  })
})
