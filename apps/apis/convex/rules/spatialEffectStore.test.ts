import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { SpatialRuleEffectPlacementDto } from '@artificer-toolkit/schema/shared/spatial'

import schema from '../schema'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000001',
  scene: '00000000-0000-4000-8000-000000000002',
  foreignScene: '00000000-0000-4000-8000-000000000003',
  definition: '00000000-0000-4000-8000-000000000004',
  entry: '00000000-0000-4000-8000-000000000005',
  occurrence: '00000000-0000-4000-8000-000000000006',
  command: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-4000-8000-000000000008'
}

function effectId(offset: number) {
  return `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
}

const definition: ActiveRuleEffectDefinitionDto = {
  schemaVersion: 2,
  linkedEffectId: null,
  originLevel: null,
  stateContributions: [],
  origin: {
    kind: 'ENCOUNTER',
    sourceAggregateId: ids.encounter,
    sourceOccurrenceId: ids.occurrence,
    rootCommandId: ids.command,
    sourceActorId: null
  },
  authoredEffectId: ids.definition,
  compiledEntryId: ids.entry,
  frozenGraphNodeId: 'entry',
  frozenGraph: {
    schemaVersion: 1,
    source: {
      definitionId: ids.definition,
      gameSystemId: ids.system,
      definitionFamilyKey: 'effect',
      checksum: 'a'.repeat(64)
    },
    capabilityContractVersion: 1,
    factContracts: [],
    nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
    sourceEntryBindings: [{ sourceEntryId: ids.entry, nodeId: 'entry' }],
    outputs: { result: { kind: 'LITERAL', value: true } }
  },
  adapterFacts: {},
  perceptionContributions: [],
  recurrence: {
    recurrenceStage: 'NONE',
    anchor: 'HOLDER',
    endTriggers: [],
    endOnConditionIds: [],
    holderEnd: null,
    lifetimeScope: 'ENCOUNTER',
    expiration: {
      kind: 'TICKS',
      initialRemaining: 3,
      decrementStage: 'END_OF_TURN'
    }
  }
}

const lifecycle = { schemaVersion: 1 as const, remainingTicks: 3 }
const placement: SpatialRuleEffectPlacementDto = {
  schemaVersion: 1,
  anchorKind: 'FIXED',
  sourceTokenId: null,
  geometry: {
    frame: 'SCENE_ABSOLUTE',
    shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 5 }
  },
  triggerModes: ['ENTER'],
  movementKinds: ['VOLUNTARY'],
  activation: 'ONE_SHOT',
  visibility: 'PUBLIC',
  revealOnTrigger: false
}
const spatialState = { schemaVersion: 1 as const, revealed: true }

async function fixture() {
  const t = convexTest(schema)
  await t.run((ctx) =>
    ctx.db.insert('encounterSceneBindings', {
      encounterId: ids.encounter,
      campaignId: effectId(9),
      sceneId: ids.scene,
      commandId: ids.command,
      commandFingerprint: 'b'.repeat(64),
      createdAt: new Date().toISOString()
    })
  )
  return t
}

describe('native spatial Rule Effect store', () => {
  it('requires the exact Encounter Scene binding and persists normalized, immutable current state', async () => {
    const t = await fixture()
    await expect(
      t.run((ctx) =>
        createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope({
          encounterId: ids.encounter,
          sceneId: ids.foreignScene
        })
      )
    ).resolves.toBeNull()
    await expect(
      t.run((ctx) =>
        createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope({
          encounterId: effectId(99),
          sceneId: ids.scene
        })
      )
    ).resolves.toBeNull()
    const created = await t.run(async (ctx) => {
      const result = await createSpatialRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      }).scope({
        encounterId: ids.encounter,
        sceneId: ids.scene
      })
      if (!result) throw new Error('Missing fixture scope.')
      return result.create({
        id: effectId(20).toUpperCase(),
        definition,
        lifecycle,
        placement,
        spatialState
      })
    })
    expect(created).toMatchObject({
      id: effectId(20),
      encounterId: ids.encounter,
      sceneId: ids.scene,
      createdOrdinal: 1,
      version: 1
    })
    const updated = await t.run(async (ctx) => {
      const result = await createSpatialRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      }).scope({
        encounterId: ids.encounter,
        sceneId: ids.scene
      })
      if (!result) throw new Error('Missing fixture scope.')
      return result.updateCurrentStateCas({
        id: created.id,
        expectedVersion: 1,
        lifecycle,
        spatialState
      })
    })
    expect(updated).toMatchObject({
      version: 2,
      definition: created.definition,
      placement: created.placement
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_publicId', (q) => q.eq('id', created.id))
        .unique()
      if (!row) throw new Error('Missing spatial effect.')
      await ctx.db.patch(row._id, { placementChecksum: '0'.repeat(64) })
    })
    await expect(
      t.run(async (ctx) => {
        const result = await createSpatialRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).scope({
          encounterId: ids.encounter,
          sceneId: ids.scene
        })
        if (!result) throw new Error('Missing fixture scope.')
        return result.get(created.id)
      })
    ).rejects.toThrow('placement checksum')
  })

  it.each([
    ['definitionChecksum', 'definition'],
    ['lifecycleChecksum', 'lifecycle'],
    ['placementChecksum', 'placement'],
    ['spatialStateChecksum', 'spatial state']
  ] as const)('rejects %s tampering', async (field, label) => {
    const t = await fixture()
    await t.run(async (ctx) => {
      const result = await createSpatialRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      }).scope({
        encounterId: ids.encounter,
        sceneId: ids.scene
      })
      if (!result) throw new Error('Missing fixture scope.')
      const created = await result.create({
        id: effectId(21),
        definition,
        lifecycle,
        placement,
        spatialState
      })
      const row = await ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_publicId', (q) => q.eq('id', created.id))
        .unique()
      if (!row) throw new Error('Missing spatial effect.')
      await ctx.db.patch(row._id, { [field]: '0'.repeat(64) })
    })
    await expect(
      t.run(async (ctx) => {
        const result = await createSpatialRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).scope({
          encounterId: ids.encounter,
          sceneId: ids.scene
        })
        if (!result) throw new Error('Missing fixture scope.')
        return result.get(effectId(21))
      })
    ).rejects.toThrow(`${label} checksum`)
  })

  it('records the Concentration a zone depends on and reads it back', async () => {
    const t = await fixture()
    const stateId = effectId(40)
    const created = await t.run(async (ctx) => {
      const result = await createSpatialRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      }).scope({ encounterId: ids.encounter, sceneId: ids.scene })
      if (!result) throw new Error('Missing fixture scope.')
      const dependent = await result.create({
        id: effectId(41),
        maintainedEffectStateId: stateId,
        definition,
        lifecycle,
        placement,
        spatialState
      })
      const independent = await result.create({
        id: effectId(42),
        definition,
        lifecycle,
        placement,
        spatialState
      })
      return { dependent, independent, listed: await result.list() }
    })
    expect(created.dependent.maintainedEffectStateId).toBe(stateId)
    expect(created.independent.maintainedEffectStateId).toBeNull()
    expect(created.listed.map((effect) => effect.maintainedEffectStateId)).toEqual([stateId, null])
  })

  it('enforces limits and ordinals and rejects stale CAS', async () => {
    const t = await fixture()
    await t.run(async (ctx) => {
      const result = await createSpatialRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      }).scope({
        encounterId: ids.encounter,
        sceneId: ids.scene
      })
      if (!result) throw new Error('Missing fixture scope.')
      const first = await result.create({
        id: effectId(30),
        definition,
        lifecycle,
        placement,
        spatialState
      })
      const second = await result.create({
        id: effectId(31),
        definition,
        lifecycle,
        placement,
        spatialState
      })
      await result.deleteCas({ id: first.id, expectedVersion: 1 })
      expect(
        (await result.create({ id: effectId(32), definition, lifecycle, placement, spatialState }))
          .createdOrdinal
      ).toBe(3)
      await expect(
        result.updateCurrentStateCas({ id: second.id, expectedVersion: 2, lifecycle, spatialState })
      ).rejects.toThrow()
      await expect(result.deleteCas({ id: second.id, expectedVersion: 2 })).rejects.toThrow()
      for (let index = 0; index < 62; index += 1)
        await result.create({
          id: effectId(100 + index),
          definition,
          lifecycle,
          placement,
          spatialState
        })
      await expect(
        result.create({ id: effectId(200), definition, lifecycle, placement, spatialState })
      ).rejects.toThrow('at most')
      expect((await result.list()).map((effect) => effect.createdOrdinal)).toEqual(
        Array.from({ length: 64 }, (_, index) => index + 2)
      )
    })
  })

  it('rolls back a spatial effect when a later write fails', async () => {
    const t = await fixture()
    await expect(
      t.run(async (ctx) => {
        const result = await createSpatialRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).scope({
          encounterId: ids.encounter,
          sceneId: ids.scene
        })
        if (!result) throw new Error('Missing fixture scope.')
        await result.create({ id: effectId(201), definition, lifecycle, placement, spatialState })
        throw new Error('Injected transaction abort')
      })
    ).rejects.toThrow('Injected transaction abort')
    await expect(
      t.run(async (ctx) => {
        const result = await createSpatialRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).scope({
          encounterId: ids.encounter,
          sceneId: ids.scene
        })
        if (!result) throw new Error('Missing fixture scope.')
        return result.get(effectId(201))
      })
    ).resolves.toBeNull()
  })
})
