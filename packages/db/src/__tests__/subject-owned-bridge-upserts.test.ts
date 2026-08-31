import { describe, expect, it } from 'vitest'
import type { DBLike } from '#types'
import { upsertCreature } from '../domains/subjects/upserts/creature.js'
import { upsertFeat } from '../domains/subjects/upserts/feat.js'
import { upsertVehicle } from '../domains/subjects/upserts/vehicle.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

const systemId = 'system-1'
const userId = 'user-1'
const contentSourceId = 'content-source-1'

type TestDb = DBLike & InMemoryDb

function createDb(): TestDb {
  return new InMemoryDb() as unknown as TestDb
}

function feature(id: string) {
  return {
    id,
    label: 'Repeatable Feature',
    description: 'A feature that should survive repeat subject upserts.',
    order: 1
  }
}

describe('subject owned bridge upserts', () => {
  it('keeps creature-owned features after a repeat upsert', async () => {
    const db = createDb()
    const creature = {
      id: 'creature-1',
      label: 'Test Creature',
      userId,
      systemId,
      category: 'MONSTER',
      creatureTypeId: 'creature-type-1',
      size: 'MEDIUM',
      abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 10,
        CONSTITUTION: 10,
        INTELLIGENCE: 10,
        WISDOM: 10,
        CHARISMA: 10
      },
      armorClass: 10,
      hitPoints: 1,
      speeds: [],
      features: [feature('creature-feature-1')]
    } satisfies Parameters<typeof upsertCreature>[1]

    await upsertCreature(db, creature, systemId, contentSourceId)
    await upsertCreature(db, creature, systemId, contentSourceId)

    expect(db.snapshot('features')).toEqual([expect.objectContaining({ id: 'creature-feature-1' })])
    expect(db.snapshot('creature_features')).toEqual([
      expect.objectContaining({
        creature_id: 'creature-1',
        feature_id: 'creature-feature-1'
      })
    ])
    expect(db.snapshot('creatures')).toEqual([
      expect.objectContaining({ content_source_id: contentSourceId })
    ])
  })

  it('keeps feat-owned features after a repeat upsert', async () => {
    const db = createDb()
    const feat = {
      id: 'feat-1',
      label: 'Test Feat',
      description: 'A feat with an owned feature.',
      userId,
      systemId,
      features: [feature('feat-feature-1')]
    } satisfies Parameters<typeof upsertFeat>[1]

    await upsertFeat(db, feat, systemId, contentSourceId)
    await upsertFeat(db, feat, systemId, contentSourceId)

    expect(db.snapshot('features')).toEqual([expect.objectContaining({ id: 'feat-feature-1' })])
    expect(db.snapshot('feat_features')).toEqual([
      expect.objectContaining({
        feat_id: 'feat-1',
        feature_id: 'feat-feature-1'
      })
    ])
    expect(db.snapshot('feats')).toEqual([
      expect.objectContaining({ content_source_id: contentSourceId })
    ])
  })

  it('keeps vehicle-owned features after a repeat upsert', async () => {
    const db = createDb()
    const vehicle = {
      id: 'vehicle-1',
      label: 'Test Vehicle',
      userId,
      systemId,
      category: 'LAND',
      features: [feature('vehicle-feature-1')]
    } satisfies Parameters<typeof upsertVehicle>[1]

    await upsertVehicle(db, vehicle, systemId, contentSourceId)
    await upsertVehicle(db, vehicle, systemId, contentSourceId)

    expect(db.snapshot('features')).toEqual([expect.objectContaining({ id: 'vehicle-feature-1' })])
    expect(db.snapshot('vehicle_features')).toEqual([
      expect.objectContaining({
        vehicle_id: 'vehicle-1',
        feature_id: 'vehicle-feature-1'
      })
    ])
    expect(db.snapshot('vehicles')).toEqual([
      expect.objectContaining({ content_source_id: contentSourceId })
    ])
  })
})
