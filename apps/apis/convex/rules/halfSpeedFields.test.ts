import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { SpatialRuleEffectPlacementDto } from '@artificer-toolkit/schema/shared/spatial'
import { halfSpeedFieldsOf } from '@artificer-toolkit/encounter-persistence/halfSpeedFields'
import { readSceneSpatialRows } from '@artificer-toolkit/encounter-persistence/sceneSpatialRows'
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
  campaign: '00000000-0000-4000-8000-000000000009'
}

const effectId = (offset: number) =>
  `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`

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
    consumeOnFirstEvents: [],
    endOnEvents: [],
    endOnTriggers: [],
    endOnConditionIds: [],
    holderEnd: null,
    lifetimeScope: 'ENCOUNTER',
    expiration: { kind: 'INDEFINITE' }
  }
}

const square = {
  kind: 'POLYGON' as const,
  points: [
    { x: 200, y: 300 },
    { x: 300, y: 300 },
    { x: 300, y: 400 },
    { x: 200, y: 400 }
  ]
}

const placement = (
  overrides: Partial<SpatialRuleEffectPlacementDto>
): SpatialRuleEffectPlacementDto => ({
  schemaVersion: 1,
  anchorKind: 'FIXED',
  sourceTokenId: null,
  geometry: { frame: 'SCENE_ABSOLUTE', shape: square },
  triggerModes: ['ENTER'],
  movementKinds: ['VOLUNTARY'],
  activation: 'REPEATABLE',
  visibility: 'PUBLIC',
  revealOnTrigger: false,
  ...overrides
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
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      {
        encounterId: ids.encounter,
        sceneId: ids.scene
      }
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

const read = (t: Awaited<ReturnType<typeof seed>>, encounterId = ids.encounter) =>
  t.run(async (ctx) =>
    halfSpeedFieldsOf(
      await readSceneSpatialRows({ db: createConvexEncounterStore(ctx) }, encounterId)
    )
  )

describe('readHalfSpeedFields', () => {
  it('lists the visible half-speed fields with their label and shape, in creation order', async () => {
    const t = await seed([
      placement({ label: 'Caltrop field', bypassAtHalfSpeed: true }),
      placement({ bypassAtHalfSpeed: true })
    ])
    expect(await read(t)).toEqual([
      { id: effectId(20), label: 'Caltrop field', shape: square },
      { id: effectId(21), label: null, shape: square }
    ])
  })

  it('leaves out hidden fields, fields that must be saved against, and other Runs', async () => {
    const t = await seed([
      placement({ bypassAtHalfSpeed: true, visibility: 'HIDDEN' }),
      placement({}),
      placement({ bypassAtHalfSpeed: false, label: 'Spike growth' })
    ])
    expect(await read(t)).toEqual([])
    expect(await read(t, effectId(99))).toEqual([])
  })

  it('lists a hidden field once it has been revealed', async () => {
    const t = await seed(
      [
        placement({ bypassAtHalfSpeed: true, visibility: 'HIDDEN', label: 'Pit' }),
        placement({ bypassAtHalfSpeed: true, visibility: 'HIDDEN' })
      ],
      [0]
    )
    expect(await read(t)).toEqual([{ id: effectId(20), label: 'Pit', shape: square }])
  })

  it('reads nothing when the Run has no bound Scene', async () => {
    const t = convexTest(schema)
    expect(await read(t)).toEqual([])
  })
})
