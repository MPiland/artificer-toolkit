import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import { createCreature } from './sheetTestFixtures.js'

const mocks = vi.hoisted(() => ({
  findActiveByIds: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAuthoredVersionRepository: () => ({ findActiveByIds: mocks.findActiveByIds })
  }
})

const { loadActiveCharacterCreatures, loadActiveCharacterVehicles } =
  await import('./characterActiveAuthoredSources.js')

const input = {
  characterId: 'character-1',
  db: {} as DBLike,
  systemId: 'system-1',
  userId: 'user-1'
}

describe('active Character authored sources', () => {
  beforeEach(() => {
    mocks.findActiveByIds.mockReset()
  })

  it('uses the owner-or-master envelope for active Creature and Vehicle documents', async () => {
    const creature = createCreature()
    const vehicle = {
      id: 'vehicle-1',
      label: 'Cart',
      userId: 'user-1',
      systemId: 'system-1',
      category: 'LAND'
    }
    mocks.findActiveByIds
      .mockResolvedValueOnce(new Map([[creature.id, { authored: { document: creature } }]]))
      .mockResolvedValueOnce(new Map([[vehicle.id, { authored: { document: vehicle } }]]))

    await expect(
      loadActiveCharacterCreatures({ ...input, creatureIds: [creature.id] })
    ).resolves.toEqual(new Map([[creature.id, creature]]))
    await expect(
      loadActiveCharacterVehicles({ ...input, vehicleIds: [vehicle.id] })
    ).resolves.toEqual(new Map([[vehicle.id, vehicle]]))
    expect(mocks.findActiveByIds).toHaveBeenNthCalledWith(1, {
      subjectKind: 'CREATURE',
      subjectIds: [creature.id],
      systemId: input.systemId,
      userId: input.userId,
      includeMaster: true
    })
    expect(mocks.findActiveByIds).toHaveBeenNthCalledWith(2, {
      subjectKind: 'VEHICLE',
      subjectIds: [vehicle.id],
      systemId: input.systemId,
      userId: input.userId,
      includeMaster: true
    })
  })

  it('fails closed when an active Creature document belongs to another System', async () => {
    const creature = createCreature({ systemId: 'other-system' })
    mocks.findActiveByIds.mockResolvedValue(
      new Map([[creature.id, { authored: { document: creature } }]])
    )

    await expect(
      loadActiveCharacterCreatures({ ...input, creatureIds: [creature.id] })
    ).rejects.toThrow(
      `Character "${input.characterId}" requires an active Creature "${creature.id}" version.`
    )
  })
})
