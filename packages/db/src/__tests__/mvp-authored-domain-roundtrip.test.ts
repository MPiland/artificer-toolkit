import { describe, expect, it } from 'vitest'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { CREATURE_NODE_MAP } from '@artificer-toolkit/shared/subjects/maps'
import type {
  CreatureAuthored,
  SubclassAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { createClassRepository } from '../domains/subjects/repositories/class.js'
import { createCreatureRepository } from '../domains/subjects/repositories/creature.js'
import { createVehicleRepository } from '../domains/subjects/repositories/vehicle.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

const systemId = 'system-mvp-audit'
const userId = 'user-mvp-audit'

function creatureFixture(): CreatureAuthored {
  return {
    id: 'creature-mvp-audit',
    label: 'Audit Dragon',
    userId,
    systemId,
    category: 'MONSTER',
    creatureTypeId: 'dragon',
    size: 'MEDIUM',
    tags: ['dragon', 'audit'],
    speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }],
    abilityScores: {
      STRENGTH: 16,
      DEXTERITY: 12,
      CONSTITUTION: 14,
      INTELLIGENCE: 10,
      WISDOM: 10,
      CHARISMA: 12
    },
    armorClass: 14,
    hitPoints: 22,
    equipmentLoadout: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        equipmentId: '00000000-0000-4000-8000-000000000102',
        quantity: 1,
        useState: 'WORN',
        attuned: false,
        actionFeatureIds: []
      }
    ],
    senses: ['darkvision-60'],
    damageResistances: ['FIRE'],
    features: [
      {
        id: 'creature-feature-mvp-audit',
        label: 'Bite',
        description: 'A sharp bite.',
        section: 'ACTION',
        order: 1
      }
    ]
  }
}

function vehicleFixture(): VehicleAuthored {
  return {
    id: 'vehicle-mvp-audit',
    label: 'Audit Wagon',
    userId,
    systemId,
    category: 'LAND',
    size: 'LARGE',
    armorClass: 12,
    hitPoints: 30,
    speed: 40,
    weight: { amount: 400, unit: 'POUNDS' },
    properties: ['CARGO', 'WHEELED']
  }
}

function subclassFixture(): SubclassAuthored {
  return {
    id: 'subclass-mvp-audit',
    label: 'Audit Champion',
    userId,
    systemId,
    category: 'SUBCLASS',
    parentClassId: 'fighter',
    attributes: ['SPECIALIZATION'],
    specializations: [{ id: 'specialization-mvp-audit', label: 'Audit Path', order: 1 }]
  }
}

describe('MVP authored-domain persistence audit', () => {
  it('proves Creature replacement and hydration preserve primitive arrays and child features', async () => {
    const db = new InMemoryDb()
    const repository = createCreatureRepository(db as never)
    const initial = creatureFixture()

    await repository.upsert(initial, { contentSourceId: 'content-source-1' })
    await expect(repository.findById(initial.id)).resolves.toMatchObject({
      id: initial.id,
      tags: ['dragon', 'audit'],
      senses: ['darkvision-60'],
      damageResistances: ['FIRE'],
      equipmentLoadout: initial.equipmentLoadout,
      features: [{ id: 'creature-feature-mvp-audit', section: 'ACTION' }]
    })

    await repository.upsert(
      {
        ...initial,
        label: 'Updated Audit Dragon',
        tags: ['updated'],
        senses: ['blindsight-30'],
        damageResistances: [],
        features: []
      },
      { contentSourceId: 'content-source-1' }
    )

    const updated = await repository.findById(initial.id)
    expect(updated).toMatchObject({
      label: 'Updated Audit Dragon',
      tags: ['updated'],
      senses: ['blindsight-30'],
      features: undefined
    })
    expect(updated).not.toHaveProperty('damageResistances')
    expect(db.snapshot('creature_damage_resistances')).toEqual([])
    expect(db.snapshot('creature_features')).toEqual([])
    expect(db.snapshot('features')).toEqual([])
  })

  it('proves Vehicle replacement and hydration preserve weight and properties', async () => {
    const db = new InMemoryDb()
    const repository = createVehicleRepository(db as never)
    const initial = vehicleFixture()

    await repository.upsert(initial, { contentSourceId: 'content-source-1' })
    await expect(repository.findById(initial.id)).resolves.toMatchObject({
      id: initial.id,
      weight: { amount: 400, unit: 'POUNDS' },
      properties: ['CARGO', 'WHEELED']
    })

    await repository.upsert(
      {
        ...initial,
        label: 'Updated Audit Wagon',
        weight: { amount: 600, unit: 'POUNDS' },
        properties: ['ARMORED']
      },
      { contentSourceId: 'content-source-1' }
    )

    await expect(repository.findById(initial.id)).resolves.toMatchObject({
      label: 'Updated Audit Wagon',
      weight: { amount: 600, unit: 'POUNDS' },
      properties: ['ARMORED']
    })
    expect(db.snapshot('vehicles')).toEqual([
      expect.objectContaining({
        id: initial.id,
        weight_amount: 600,
        weight_unit: 'POUNDS',
        properties: ['ARMORED']
      })
    ])
  })

  it('proves subclass Class replacement and hydration preserve attributes and specializations', async () => {
    const db = new InMemoryDb()
    const repository = createClassRepository(db as never)
    const initial = subclassFixture()

    await repository.upsert(initial, { contentSourceId: 'content-source-1' })
    await expect(repository.findById(initial.id)).resolves.toMatchObject({
      id: initial.id,
      category: 'SUBCLASS',
      parentClassId: 'fighter',
      attributes: ['SPECIALIZATION'],
      specializations: [{ id: 'specialization-mvp-audit', label: 'Audit Path', order: 1 }]
    })

    await repository.upsert(
      {
        ...initial,
        label: 'Updated Audit Champion',
        attributes: ['RESOURCE'],
        specializations: [{ id: 'specialization-mvp-audit-2', label: 'Updated Path', order: 1 }]
      },
      { contentSourceId: 'content-source-1' }
    )

    await expect(repository.findById(initial.id)).resolves.toMatchObject({
      label: 'Updated Audit Champion',
      attributes: ['RESOURCE'],
      specializations: [{ id: 'specialization-mvp-audit-2', label: 'Updated Path', order: 1 }]
    })
    expect(db.snapshot('class_specializations')).toEqual([
      expect.objectContaining({ id: 'specialization-mvp-audit-2', class_id: initial.id })
    ])
    expect(db.snapshot('class_specializations')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'specialization-mvp-audit' })])
    )
  })

  it('normalizes Creature node-map logistics rows to the canonical primitive array', () => {
    const logisticsNotesNode = CREATURE_NODE_MAP.nodes.logisticsNotes
    expect(logisticsNotesNode?.kind).toBe('GROUP')

    const parsed = creatureAuthoredDtoSchema.safeParse({
      ...creatureFixture(),
      logisticsNotes: [{ value: 'Stored as a node-map row' }]
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.logisticsNotes).toEqual(['Stored as a node-map row'])
    expect(
      creatureAuthoredDtoSchema.safeParse({
        ...creatureFixture(),
        logisticsNotes: ['Stored as an authored primitive']
      }).success
    ).toBe(true)
  })
})
