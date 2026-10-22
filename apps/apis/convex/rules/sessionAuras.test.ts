import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { SpatialRuleEffectPlacementDto } from '@artificer-toolkit/schema/shared/spatial'
import { readSceneSpatialRows } from '@artificer-toolkit/encounter-persistence/sceneSpatialRows'
import { readSessionAuras } from '@artificer-toolkit/encounter-persistence/sessionAuras'
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
  creatureToken: '00000000-0000-4000-8000-0000000000b2'
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
  revealedHidden: readonly number[] = []
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

const read = (t: Awaited<ReturnType<typeof seed>>, seenActorIds: readonly string[]) =>
  t.run(async (ctx) => {
    const store = { db: createConvexEncounterStore(ctx) }
    return readSessionAuras(store, {
      encounterId: ids.encounter,
      rows: await readSceneSpatialRows(store, ids.encounter),
      seenActorIds: new Set(seenActorIds)
    })
  })

describe('readSessionAuras', () => {
  it('lists an aura with its label, radius and source token for a viewer who sees the source', async () => {
    const t = await seed([aura(ids.casterToken)])
    expect(await read(t, [ids.casterActor])).toEqual([
      { id: effectId(20), label: 'Spirit Guardians', radius: 400, sourceTokenId: ids.casterToken }
    ])
  })

  it('leaves out an aura whose source the viewer cannot see, and lists the rest', async () => {
    const t = await seed([aura(ids.creatureToken), aura(ids.casterToken, { label: 'Aura' })])
    expect(await read(t, [ids.casterActor])).toEqual([
      { id: effectId(21), label: 'Aura', radius: 400, sourceTokenId: ids.casterToken }
    ])
    expect(await read(t, [])).toEqual([])
  })

  it('leaves out placed zones that are not centered on a token, and a hidden aura until revealed', async () => {
    const t = await seed(
      [
        fixedZone(),
        aura(ids.casterToken, { visibility: 'HIDDEN' }),
        aura(ids.casterToken, { visibility: 'HIDDEN', label: 'Revealed' })
      ],
      [2]
    )
    expect(await read(t, [ids.casterActor])).toEqual([
      { id: effectId(22), label: 'Revealed', radius: 400, sourceTokenId: ids.casterToken }
    ])
  })

  it('reads nothing when the Run has no bound Scene', async () => {
    expect(await read(convexTest(schema), [ids.casterActor])).toEqual([])
  })
})
