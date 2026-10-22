import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { SpatialRuleEffectPlacementDto } from '@artificer-toolkit/schema/shared/spatial'
import { readSceneSpatialRows } from '@artificer-toolkit/encounter-persistence/sceneSpatialRows'
import { readSessionMovementCostZones } from '@artificer-toolkit/encounter-persistence/sessionMovementCostZones'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'

import { convexTest } from '../../tests/convexTest'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import schema from '../schema'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000001',
  scene: '00000000-0000-4000-8000-000000000002',
  definition: '00000000-0000-4000-8000-000000000004',
  entry: '00000000-0000-4000-8000-000000000005',
  occurrence: '00000000-0000-4000-8000-000000000006',
  command: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-4000-8000-000000000008',
  campaign: '00000000-0000-4000-8000-000000000009',
  casterActor: '00000000-0000-4000-8000-0000000000a1',
  casterToken: '00000000-0000-4000-8000-0000000000b1',
  creatureActor: '00000000-0000-4000-8000-0000000000a2',
  creatureToken: '00000000-0000-4000-8000-0000000000b2',
  maintained: '00000000-0000-4000-8000-0000000000c1'
}

const effectId = (offset: number) =>
  `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`

const definition: ActiveRuleEffectDefinitionDto = {
  schemaVersion: 2,
  linkedEffectId: null,
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
    consumeOnFirstEvents: [],
    endOnEvents: [],
    endOnTriggers: [],
    endOnConditionIds: [],
    holderEnd: null,
    lifetimeScope: 'ENCOUNTER',
    expiration: { kind: 'INDEFINITE' }
  }
}

const circle = { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: 400 }

const aura = (
  sourceTokenId: string,
  overrides: Partial<SpatialRuleEffectPlacementDto> = {}
): SpatialRuleEffectPlacementDto => ({
  schemaVersion: 1,
  anchorKind: 'TOKEN',
  sourceTokenId,
  geometry: { frame: 'TOKEN_LOCAL', shape: circle },
  triggerModes: ['ENTER'],
  movementKinds: ['VOLUNTARY'],
  activation: 'REPEATABLE',
  visibility: 'PUBLIC',
  revealOnTrigger: false,
  label: 'Spirit Guardians',
  movementCostMultiplier: 2,
  ...overrides
})

const fixedZone = (): SpatialRuleEffectPlacementDto => ({
  schemaVersion: 1,
  anchorKind: 'FIXED',
  sourceTokenId: null,
  geometry: { frame: 'SCENE_ABSOLUTE', shape: circle },
  triggerModes: ['ENTER'],
  movementKinds: ['VOLUNTARY'],
  activation: 'REPEATABLE',
  visibility: 'PUBLIC',
  revealOnTrigger: false
})

async function seed(
  placements: readonly SpatialRuleEffectPlacementDto[],
  revealedHidden: readonly number[] = [],
  maintainedIndexes: readonly number[] = []
) {
  const t = convexTest(schema)
  await t.run(async (ctx) => {
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: ids.encounter,
      campaignId: ids.campaign,
      sceneId: ids.scene,
      commandId: ids.command,
      commandFingerprint: 'b'.repeat(64),
      createdAt: new Date().toISOString()
    })
    for (const [actorId, tokenId] of [
      [ids.casterActor, ids.casterToken],
      [ids.creatureActor, ids.creatureToken]
    ] as const)
      await ctx.db.insert('encounterActorTokenBindings', {
        actorId,
        encounterId: ids.encounter,
        sceneId: ids.scene,
        tokenId
      })
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      { encounterId: ids.encounter, sceneId: ids.scene }
    )
    if (!scope) throw new Error('Missing fixture scope.')
    for (const [index, entry] of placements.entries())
      await scope.create({
        id: effectId(20 + index),
        maintainedEffectStateId: maintainedIndexes.includes(index) ? ids.maintained : null,
        definition,
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        placement: entry,
        spatialState: {
          schemaVersion: 1,
          revealed: entry.visibility === 'PUBLIC' || revealedHidden.includes(index)
        }
      })
  })
  return t
}

type Seen = { id: string; defeated?: boolean }

const read = (t: Awaited<ReturnType<typeof seed>>, seen: readonly Seen[]) =>
  t.run(async (ctx) => {
    const store = { db: createConvexEncounterStore(ctx) }
    return readSessionMovementCostZones(store, {
      encounterId: ids.encounter,
      rows: await readSceneSpatialRows(store, ids.encounter),
      actors: seen.map(({ id, defeated = false }) => ({ id, defeated }))
    })
  })

const casterAura = {
  id: effectId(20),
  multiplier: 2,
  anchorKind: 'TOKEN',
  geometry: { frame: 'TOKEN_LOCAL', shape: circle },
  sourceTokenId: ids.casterToken,
  unaffectedActorIds: []
}

describe('readSessionMovementCostZones (SPELLS-20 T4d)', () => {
  it('lists a fixed zone and an aura with their multiplier, area and anchor', async () => {
    const t = await seed([aura(ids.casterToken), { ...fixedZone(), movementCostMultiplier: 4 }])
    expect(await read(t, [{ id: ids.casterActor }])).toEqual([
      casterAura,
      {
        id: effectId(21),
        multiplier: 4,
        anchorKind: 'FIXED',
        geometry: { frame: 'SCENE_ABSOLUTE', shape: circle },
        sourceTokenId: null,
        unaffectedActorIds: []
      }
    ])
  })

  it('names only the designated creatures the viewer sees', async () => {
    const t = await seed([
      aura(ids.casterToken, { unaffectedActorIds: [ids.casterActor, ids.creatureActor] })
    ])
    expect(await read(t, [{ id: ids.casterActor }])).toEqual([
      { ...casterAura, unaffectedActorIds: [ids.casterActor] }
    ])
  })

  it('leaves out a zone that prices no movement, a hidden one until revealed, and an aura whose source the viewer cannot see', async () => {
    const t = await seed(
      [
        fixedZone(),
        aura(ids.casterToken, { visibility: 'HIDDEN' }),
        aura(ids.creatureToken),
        aura(ids.casterToken, { visibility: 'HIDDEN' })
      ],
      [3]
    )
    expect(await read(t, [{ id: ids.casterActor }])).toEqual([{ ...casterAura, id: effectId(23) }])
  })

  it('rests a defeated Creature’s passive aura, but not an aura its source maintains', async () => {
    const t = await seed([aura(ids.creatureToken), aura(ids.creatureToken)], [], [1])
    expect(await read(t, [{ id: ids.creatureActor, defeated: true }])).toEqual([
      { ...casterAura, id: effectId(21), sourceTokenId: ids.creatureToken }
    ])
    expect(await read(t, [{ id: ids.creatureActor }])).toHaveLength(2)
  })

  it('reads nothing when the Run has no bound Scene', async () => {
    expect(await read(convexTest(schema), [{ id: ids.casterActor }])).toEqual([])
  })
})
