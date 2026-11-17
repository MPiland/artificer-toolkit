import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { SpatialRuleEffectPlacementDto } from '@artificer-toolkit/schema/shared/spatial'

import schema from '../schema'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { readActorMovableZones } from '@artificer-toolkit/encounter-persistence/zoneMoveReads'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000001',
  scene: '00000000-0000-4000-8000-000000000002',
  definition: '00000000-0000-4000-8000-000000000004',
  entry: '00000000-0000-4000-8000-000000000005',
  occurrence: '00000000-0000-4000-8000-000000000006',
  command: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-4000-8000-000000000008',
  caster: '00000000-0000-4000-8000-0000000000a1',
  bystander: '00000000-0000-4000-8000-0000000000a2',
  maintainedState: '00000000-0000-4000-8000-0000000000b1'
}

function effectId(offset: number) {
  return `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
}

function definitionOf(sourceActorId: string): ActiveRuleEffectDefinitionDto {
  return {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    stateContributions: [],
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: ids.encounter,
      sourceOccurrenceId: ids.occurrence,
      rootCommandId: ids.command,
      sourceActorId
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
      expiration: { kind: 'TICKS', initialRemaining: 3, decrementStage: 'END_OF_TURN' }
    }
  }
}

const lifecycle = { schemaVersion: 1 as const, remainingTicks: 3 }
const spatialState = { schemaVersion: 1 as const, revealed: true }
const move = { activation: 'ACTION' as const, maxDistance: { amount: 60, unit: 'FEET' as const } }

function placementOf(
  extra: Pick<Partial<SpatialRuleEffectPlacementDto>, 'label' | 'move'>
): SpatialRuleEffectPlacementDto {
  return {
    schemaVersion: 1,
    anchorKind: 'FIXED',
    sourceTokenId: null,
    geometry: {
      frame: 'SCENE_ABSOLUTE',
      shape: { kind: 'CIRCLE', center: { x: 300, y: 300 }, radius: 100 }
    },
    triggerModes: ['ENTER'],
    movementKinds: ['VOLUNTARY'],
    activation: 'ONE_SHOT',
    visibility: 'PUBLIC',
    revealOnTrigger: false,
    ...extra
  }
}

/** A Run bound to a Scene holding four zones: three the caster placed, one a bystander placed. */
async function boundRunWithZones() {
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
  await t.run(async (ctx) => {
    const scope = await createSpatialRuleEffectStore({
      db: createConvexEncounterStore(ctx)
    }).scope({ encounterId: ids.encounter, sceneId: ids.scene })
    if (!scope) throw new Error('Missing fixture scope.')
    const zones = [
      {
        id: effectId(21),
        maintainedEffectStateId: ids.maintainedState,
        definition: definitionOf(ids.caster),
        placement: placementOf({ label: 'Moonbeam', move })
      },
      {
        id: effectId(22),
        maintainedEffectStateId: ids.maintainedState,
        definition: definitionOf(ids.caster),
        placement: placementOf({ move })
      },
      {
        id: effectId(23),
        maintainedEffectStateId: null,
        definition: definitionOf(ids.caster),
        placement: placementOf({ label: 'Lapsed', move })
      },
      {
        id: effectId(24),
        maintainedEffectStateId: ids.maintainedState,
        definition: definitionOf(ids.caster),
        placement: placementOf({ label: 'Still' })
      },
      {
        id: effectId(25),
        maintainedEffectStateId: ids.maintainedState,
        definition: definitionOf(ids.bystander),
        placement: placementOf({ label: 'Theirs', move })
      }
    ]
    for (const zone of zones) await scope.create({ ...zone, lifecycle, spatialState })
  })
  return t
}

describe('the zones an actor may move (QUALITY-15.T3y8b)', () => {
  it('lists the maintained zones the actor placed that carry a move, each with its authored move', async () => {
    const t = await boundRunWithZones()

    const zones = await t.run((ctx) =>
      readActorMovableZones({ db: createConvexEncounterStore(ctx) }, ids.encounter, ids.caster)
    )

    expect(zones).toEqual([
      { spatialEffectId: effectId(21), label: 'Moonbeam', move },
      { spatialEffectId: effectId(22), label: 'Zone', move }
    ])
  })

  it('lists nothing for an actor that placed no zone', async () => {
    const t = await boundRunWithZones()

    const zones = await t.run((ctx) =>
      readActorMovableZones({ db: createConvexEncounterStore(ctx) }, ids.encounter, effectId(99))
    )

    expect(zones).toEqual([])
  })

  it('lists nothing for a Run that is not bound to a Scene', async () => {
    const t = convexTest(schema)

    const zones = await t.run((ctx) =>
      readActorMovableZones({ db: createConvexEncounterStore(ctx) }, ids.encounter, ids.caster)
    )

    expect(zones).toEqual([])
  })
})
