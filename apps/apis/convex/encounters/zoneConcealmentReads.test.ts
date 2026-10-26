// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { SpatialRuleEffectStateDto } from '@artificer-toolkit/schema/shared/spatial'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'

import { activateFixtureRun, updateFixtureRunActors } from '../../tests/fixtures/activeInitiative'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

const activeState = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')

const effectId = (offset: number) =>
  `00000000-0000-4000-8000-${offset.toString().padStart(12, '0')}`
const square = {
  kind: 'POLYGON' as const,
  points: [
    { x: 200, y: 300 },
    { x: 300, y: 300 },
    { x: 300, y: 400 },
    { x: 200, y: 400 }
  ]
}
const spotDc = { value: 15, source: 'PLACER_ROLL' as const }
const disarmDc = { value: 12, source: 'FLAT' as const }

function definition(encounterId: string): ActiveRuleEffectDefinitionDto {
  const id = effectId(1)
  return {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    stateContributions: [],
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: encounterId,
      sourceOccurrenceId: effectId(2),
      rootCommandId: effectId(3),
      sourceActorId: null
    },
    authoredEffectId: id,
    compiledEntryId: effectId(4),
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: id,
        gameSystemId: effectId(5),
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: effectId(4), nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      anchor: 'HOLDER',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'INDEFINITE' }
    }
  }
}

it('reads a concealed zone only for the GM and the players whose Characters know of it (MOVE-3.3)', async () => {
  const base = await createEncounterSceneFixture()
  const [known, unknown] = base.run.actors
  if (!known || !unknown) throw new Error('The fixture Run has two actors.')
  // Three half-speed, double-cost zones: one the player's actor knows of, one only another actor
  // knows of, and one in plain sight with a disarm DC.
  const states: SpatialRuleEffectStateDto[] = [
    { schemaVersion: 1, revealed: true, concealment: { spotDc, knownByActorIds: [known.id] } },
    { schemaVersion: 1, revealed: true, concealment: { spotDc, knownByActorIds: [unknown.id] } },
    { schemaVersion: 1, revealed: true, disarmDc }
  ]
  await base.t.run(async (ctx) => {
    await activateFixtureRun(ctx, base.run.id)
    await updateFixtureRunActors(ctx, base.run.id, (actor) =>
      actor.id === known.id ? { ...actor, controllerUserIds: [base.owner.userId] } : actor
    )
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      commandFingerprint: 'b'.repeat(64),
      createdAt: new Date().toISOString()
    })
    const store = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      { encounterId: base.run.id, sceneId: base.sceneId }
    )
    if (!store) throw new Error('Missing the bound Scene.')
    for (const [index, spatialState] of states.entries())
      await store.create({
        id: effectId(20 + index),
        definition: definition(base.run.id),
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        placement: {
          schemaVersion: 1,
          anchorKind: 'FIXED',
          sourceTokenId: null,
          geometry: { frame: 'SCENE_ABSOLUTE', shape: square },
          triggerModes: ['ENTER'],
          movementKinds: ['VOLUNTARY'],
          activation: 'REPEATABLE',
          visibility: 'PUBLIC',
          revealOnTrigger: false,
          label: `Zone ${index}`,
          bypassAtHalfSpeed: true,
          movementCostMultiplier: 2
        },
        spatialState
      })
  })
  const input = { campaignId: base.campaign.id }
  const zone = (index: number, dcs: { spotDc: unknown; disarmDc: unknown }) => ({
    id: effectId(20 + index),
    label: `Zone ${index}`,
    shape: square,
    ...dcs
  })
  const zoneIds = (state: EncounterSessionStateDto) => ({
    halfSpeedFields: state.halfSpeedFields.map(({ id }) => id),
    movementCostZones: state.movementCostZones.map(({ id }) => id)
  })

  const gm = await base.other.caller.query(activeState, input)
  expect(gm.placedZones).toEqual([
    zone(0, { spotDc, disarmDc: null }),
    zone(1, { spotDc, disarmDc: null }),
    zone(2, { spotDc: null, disarmDc })
  ])
  expect(zoneIds(gm)).toEqual({
    halfSpeedFields: [effectId(20), effectId(21), effectId(22)],
    movementCostZones: [effectId(20), effectId(21), effectId(22)]
  })

  const player = await base.owner.caller.query(activeState, input)
  const noDcs = { spotDc: null, disarmDc: null }
  expect(player.placedZones).toEqual([zone(0, noDcs), zone(2, noDcs)])
  expect(zoneIds(player)).toEqual({
    halfSpeedFields: [effectId(20), effectId(22)],
    movementCostZones: [effectId(20), effectId(22)]
  })
  expect(JSON.stringify(player)).not.toContain(effectId(21))
}, 60000)
