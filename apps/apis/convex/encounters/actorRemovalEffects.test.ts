import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { describe, expect, it } from 'vitest'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  createPlatformRulesRuntime,
  requireInstalledGameSystemRuleCapability
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { definition, descriptor, lifecycle } from '../../tests/fixtures/maintainedEffects'
import { domainRejection } from '../../tests/fixtures/playerControl'

import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { writePendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { cleanupRemovedActorEffects } from '@artificer-toolkit/encounter-persistence/actorRemovalEffects'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  RoomCommandRefusal,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { encounterWriteTransaction } from './encounterPorts'
import { readCharacterRow } from '../characters/stateDocuments'

async function runState(fixture: Awaited<ReturnType<typeof setupCharacterRun>>) {
  return fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run is unavailable.')
    return readRunState(row)
  })
}

/** The rows Convex holds; while the room holds the Run, read them after `checkpointLiveRoom` (D85). */
async function records(fixture: Awaited<ReturnType<typeof setupCharacterRun>>) {
  return fixture.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    character: await readCharacterRow(ctx, fixture.character.id),
    receipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', fixture.character.id))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers)),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    actorEffects: await ctx.db.query('encounterActiveRuleEffects').collect(),
    maintainedStates: await ctx.db.query('encounterMaintainedEffectStates').collect()
  }))
}

/** An owned v2 maintained state with one Character dependent and one actor dependent. */
async function seedOwnedMaintainedState(policy: 'TERMINATE_WHEN_EMPTY' | 'RETAIN_UNTIL_TERMINAL') {
  const fixture = await setupCharacterRun()
  const removedActor = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!removedActor) throw new Error('Fixture Custom actor is unavailable.')
  const state = await runState(fixture)
  const stateId = crypto.randomUUID()
  const characterEffectId = crypto.randomUUID()
  const actorEffectId = crypto.randomUUID()
  await fixture.t.run(async (ctx) => {
    const effects = createActiveRuleEffectStore({
      db: createConvexEncounterStore(ctx)
    })
    await effects.createMaintainedState({
      id: stateId,
      encounterId: state.id,
      ownerActorId: removedActor.id,
      descriptor: descriptor(removedActor.id, policy)
    })
    await effects.create({
      id: characterEffectId,
      owner: { kind: 'CHARACTER', characterId: fixture.character.id },
      definition: definition(state.id, removedActor.id),
      lifecycle,
      maintainedEffectStateId: stateId
    })
    await effects.create({
      id: actorEffectId,
      owner: {
        kind: 'ENCOUNTER_ACTOR',
        encounterId: state.id,
        targetActorId: fixture.actor.id
      },
      definition: definition(state.id, removedActor.id),
      lifecycle,
      maintainedEffectStateId: stateId
    })
  })
  return { fixture, removedActor, state, stateId, characterEffectId, actorEffectId }
}

describe('native actor maintained-effect cleanup', () => {
  useLocalRoomWorker()

  // The room keeps a Run's receipts for the whole Run (D85), so the receipt the cleanup returns
  // (it becomes the MAINTENANCE_COMPLETE receipt) is observed at the producer, with no room.
  it.each(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'] as const)(
    'returns the cleanup receipt for an owned v2 state with %s',
    async (policy) => {
      const { fixture, removedActor, state, stateId, characterEffectId, actorEffectId } =
        await seedOwnedMaintainedState(policy)
      const before = await records(fixture)
      const receipt = await fixture.t.run((ctx) =>
        cleanupRemovedActorEffects(encounterWriteTransaction(ctx), {
          state,
          actorId: removedActor.id,
          occurredAt: new Date().toISOString()
        })
      )
      expect(receipt).toMatchObject({
        terminatedStates: [{ id: stateId, ownerActorId: removedActor.id, expectedVersion: 1 }],
        removedEffects: [
          {
            activeEffectId: characterEffectId,
            kind: 'CHARACTER',
            ownerId: fixture.character.id
          },
          {
            activeEffectId: actorEffectId,
            kind: 'ENCOUNTER_ACTOR',
            ownerId: fixture.actor.id
          }
        ],
        characterOwnerTransitions: [
          {
            characterId: fixture.character.id,
            beforeStreamVersion: before.character!.play.streamVersion,
            afterStreamVersion: before.character!.play.streamVersion + 1
          }
        ]
      })
    }
  )

  it.each(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'] as const)(
    'terminates an owned v2 state with %s after deleting Character and actor dependents',
    async (policy) => {
      const { fixture, removedActor, state, stateId, characterEffectId, actorEffectId } =
        await seedOwnedMaintainedState(policy)
      await attachFixtureRoom(fixture.t, fixture.campaign.id)
      const before = await records(fixture)
      const command = {
        type: 'REMOVE_ACTOR' as const,
        encounterId: state.id,
        actorId: removedActor.id,
        expectedVersion: state.version,
        commandId: crypto.randomUUID()
      }
      const removed = await executeInRoom(fixture.owner.caller, { command })
      expect(
        removed.projection.actors.find((actor) => actor.id === fixture.actor.id)
      ).toMatchObject({
        sourceRevision: null,
        currentHitPoints: fixture.actor.currentHitPoints
      })
      // The room holds the maintenance receipt until the Run ends (D85), so the cleanup's outcome
      // is read from the rows it published: the exact seeded state and both dependents are gone
      // and the Character advanced one stream version.
      expect(before.maintainedStates.map((row) => row.id)).toEqual([stateId])
      expect(before.characterEffects.map((row) => row.id)).toEqual([characterEffectId])
      expect(before.actorEffects.map((row) => row.id)).toEqual([actorEffectId])
      await checkpointLiveRoom(fixture.campaign.id)
      const after = await records(fixture)
      expect(after.character).toEqual({
        ...before.character,
        play: {
          ...before.character!.play,
          streamVersion: before.character!.play.streamVersion + 1,
          updatedAt: removed.projection.updatedAt
        }
      })
      expect(after.receipts).toEqual(before.receipts)
      expect(after.characterEffects).toEqual([])
      expect(after.actorEffects).toEqual([])
      expect(after.maintainedStates).toEqual([])
      expect(await executeInRoom(fixture.owner.caller, { command })).toEqual(removed)
      await checkpointLiveRoom(fixture.campaign.id)
      expect(await records(fixture)).toEqual(after)
      await executeInRoom(fixture.owner.caller, {
        command: {
          type: 'SET_INITIATIVE',
          encounterId: state.id,
          actorId: fixture.actor.id,
          expectedVersion: removed.projection.version,
          commandId: crypto.randomUUID(),
          initiative: 12,
          manualOrder: 0
        }
      })
    }
  )

  it('supersedes only the exact concentration target and exact maintained-state version atomically', async () => {
    const fixture = await setupCharacterRun()
    const state = await runState(fixture)
    const target = fixture.actor
    const other = fixture.run.actors.find((actor) => actor.id !== target.id)!
    const maintained = await fixture.t.run((ctx) =>
      createActiveRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      }).createMaintainedState({
        id: crypto.randomUUID(),
        encounterId: state.id,
        ownerActorId: target.id,
        descriptor: descriptor(target.id, 'RETAIN_UNTIL_TERMINAL')
      })
    )
    const occurrenceId = crypto.randomUUID()
    const graph = definition(state.id, target.id).frozenGraph
    const runtime = createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Frozen graph has no definition read')
        }
      }
    })
    const paused = await runtime.executeFrozen({
      graph: {
        ...graph,
        factContracts: requireInstalledGameSystemRuleCapability(state.gameSystemId).factContracts,
        source: {
          ...graph.source,
          gameSystemId: state.gameSystemId,
          definitionFamilyKey: 'rules-runtime-graph'
        },
        nodes: [
          {
            id: 'entry',
            operation: { key: 'evidence.integer-range', contractVersion: 1 },
            inputs: {
              min: { kind: 'LITERAL', value: 1 },
              max: { kind: 'LITERAL', value: 20 }
            }
          }
        ],
        outputs: {
          value: { kind: 'NODE_OUTPUT', nodeId: 'entry', port: 'value' }
        }
      },
      occurrenceId,
      facts: {}
    })
    if (paused.result.status !== 'PAUSED') throw new Error('Expected sealed evidence request')
    const checksum = 'a'.repeat(64)
    const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...paused.result.continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      applicationContext: {
        kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK',
        source: 'CONCENTRATION',
        schemaVersion: 1,
        parentOccurrenceId: crypto.randomUUID(),
        parentCommandFingerprint: checksum,
        finalizedDamageEnvelopeChecksum: checksum,
        application: {
          ordinal: 0,
          sourceNodeId: 'damage',
          sourceOperationKey: 'damage',
          targetActorId: target.id,
          appliedAmount: 1,
          damageTypeId: crypto.randomUUID()
        },
        sourceLabels: [],
        trigger: { sourceLabel: null, damageTypeLabel: null, dc: 10 },
        maintainedState: {
          id: maintained.id,
          version: maintained.version,
          maintenanceDefinitionId: maintained.maintenanceDefinitionId,
          descriptorChecksum: maintained.descriptorChecksum
        },
        concentrationDefinition: { id: crypto.randomUUID(), checksum },
        save: {
          savingThrowAbilityDefinitionId: crypto.randomUUID(),
          modifier: 1,
          rollMode: 'NORMAL',
          keep: 'FIRST',
          contributors: [],
          contributorChecksum: checksum
        },
        targetCharacter: {
          streamVersion: fixture.characterStreamVersion,
          baseProjectionChecksum: checksum,
          campaignOverlayChecksum: checksum,
          mechanicalContextChecksum: checksum
        },
        systemVocabularySnapshot: {
          id: state.gameSystemId,
          version: 1,
          checksum
        },
        contextChecksum: checksum,
        remaining: []
      }
    })
    const now = new Date().toISOString()
    const pendingOccurrence = { id: occurrenceId, encounterId: state.id }
    const pendingId = await fixture.t.run(async (ctx) =>
      ctx.db.insert('encounterRuleOccurrences', {
        id: occurrenceId,
        campaignId: state.campaignId,
        encounterId: state.id,
        rootCommandId: crypto.randomUUID(),
        state: 'PENDING',
        version: 2,
        expectedEncounterVersion: state.version,
        pendingSnapshotChecksum: await writePendingSnapshot(
          { db: createConvexEncounterStore(ctx) },
          pendingOccurrence,
          snapshot
        ),
        completedAt: null,
        createdAt: now,
        updatedAt: now
      })
    )
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: state.id,
      actorId: target.id,
      expectedVersion: state.version,
      commandId: crypto.randomUUID()
    }
    await attachFixtureRoom(fixture.t, fixture.campaign.id)
    const before = await records(fixture)
    await expect(
      domainRejection(
        executeInRoom(fixture.owner.caller, {
          command: { ...command, actorId: other.id }
        })
      )
    ).resolves.toMatchObject({ reason: 'PENDING_DECISION' })
    await checkpointLiveRoom(fixture.campaign.id)
    expect(await records(fixture)).toEqual(before)
    if (
      snapshot.applicationContext.kind !== 'ENCOUNTER_DAMAGE_SAVE_CHECK' ||
      snapshot.applicationContext.source !== 'CONCENTRATION'
    )
      throw new Error('Expected concentration')
    const mismatched = {
      ...snapshot,
      applicationContext: {
        ...snapshot.applicationContext,
        maintainedState: {
          ...snapshot.applicationContext.maintainedState,
          version: maintained.version + 1
        }
      }
    }
    // Convex writes under a held Run need the room closed first; it re-hydrates on the next command.
    await closeRoom(fixture.campaign.id)
    await fixture.t.run(async (ctx) =>
      ctx.db.patch(pendingId, {
        pendingSnapshotChecksum: await writePendingSnapshot(
          { db: createConvexEncounterStore(ctx) },
          pendingOccurrence,
          mismatched
        )
      })
    )
    await expect(executeInRoom(fixture.owner.caller, { command })).rejects.toThrow(
      RoomCommandRefusal
    )
    await checkpointLiveRoom(fixture.campaign.id)
    expect(await records(fixture)).toEqual(before)
    await closeRoom(fixture.campaign.id)
    await fixture.t.run(async (ctx) =>
      ctx.db.patch(pendingId, {
        pendingSnapshotChecksum: await writePendingSnapshot(
          { db: createConvexEncounterStore(ctx) },
          pendingOccurrence,
          snapshot
        )
      })
    )
    const result = await executeInRoom(fixture.owner.caller, { command })
    await checkpointLiveRoom(fixture.campaign.id)
    const completed = await fixture.t.run((ctx) => ctx.db.get(pendingId))
    expect(completed).toMatchObject({
      state: 'COMPLETED',
      version: 3,
      expectedEncounterVersion: state.version + 1,
      pendingSnapshotChecksum: null
    })
    expect((await records(fixture)).maintainedStates).toEqual([])
    expect(await executeInRoom(fixture.owner.caller, { command })).toEqual(result)
  })

  it.each([
    ['TERMINATE_WHEN_EMPTY', true],
    ['RETAIN_UNTIL_TERMINAL', false]
  ] as const)('applies foreign final-dependent policy %s', async (policy, terminates) => {
    const fixture = await setupCharacterRun()
    const removedActor = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!removedActor) throw new Error('Fixture Custom actor is unavailable.')
    const state = await runState(fixture)
    const foreignStateId = crypto.randomUUID()
    const effectId = crypto.randomUUID()
    await fixture.t.run(async (ctx) => {
      const effects = createActiveRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      })
      await effects.createMaintainedState({
        id: foreignStateId,
        encounterId: state.id,
        ownerActorId: fixture.actor.id,
        descriptor: descriptor(fixture.actor.id, policy)
      })
      await effects.create({
        id: effectId,
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: state.id,
          targetActorId: removedActor.id
        },
        definition: definition(state.id, fixture.actor.id),
        lifecycle,
        maintainedEffectStateId: foreignStateId
      })
    })
    const result = await fixture.t.run((ctx) =>
      cleanupRemovedActorEffects(encounterWriteTransaction(ctx), {
        state,
        actorId: removedActor.id,
        occurredAt: '2026-09-13T00:00:00.000Z'
      })
    )
    expect(result?.removedEffects).toHaveLength(1)
    expect(result?.terminatedStates).toHaveLength(terminates ? 1 : 0)
    expect(
      await fixture.t.run((ctx) =>
        createActiveRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).findMaintainedStateById({
          encounterId: state.id,
          stateId: foreignStateId
        })
      )
    ).toEqual(terminates ? null : expect.objectContaining({ id: foreignStateId }))
  })

  it('retains a foreign state and its remaining Character dependent without advancing that Character', async () => {
    const fixture = await setupCharacterRun()
    const removedActor = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!removedActor) throw new Error('Fixture Custom actor is unavailable.')
    const state = await runState(fixture)
    const foreignStateId = crypto.randomUUID()
    const retainedCharacterEffectId = crypto.randomUUID()
    await fixture.t.run(async (ctx) => {
      const effects = createActiveRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      })
      await effects.createMaintainedState({
        id: foreignStateId,
        encounterId: state.id,
        ownerActorId: fixture.actor.id,
        descriptor: descriptor(fixture.actor.id, 'TERMINATE_WHEN_EMPTY')
      })
      await effects.create({
        id: retainedCharacterEffectId,
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        definition: definition(state.id, fixture.actor.id),
        lifecycle,
        maintainedEffectStateId: foreignStateId
      })
      await effects.create({
        id: crypto.randomUUID(),
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: state.id,
          targetActorId: removedActor.id
        },
        definition: definition(state.id, fixture.actor.id),
        lifecycle,
        maintainedEffectStateId: foreignStateId
      })
    })
    const before = await records(fixture)
    const result = await fixture.t.run((ctx) =>
      cleanupRemovedActorEffects(encounterWriteTransaction(ctx), {
        state,
        actorId: removedActor.id,
        occurredAt: '2026-09-13T00:00:00.000Z'
      })
    )
    expect(result).toMatchObject({
      terminatedStates: [],
      characterOwnerTransitions: []
    })
    const after = await records(fixture)
    expect(after.character).toEqual(before.character)
    expect(
      await fixture.t.run((ctx) =>
        createActiveRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).findById(
          { kind: 'CHARACTER', characterId: fixture.character.id },
          retainedCharacterEffectId
        )
      )
    ).not.toBeNull()
    expect(
      await fixture.t.run((ctx) =>
        createActiveRuleEffectStore({
          db: createConvexEncounterStore(ctx)
        }).findMaintainedStateById({
          encounterId: state.id,
          stateId: foreignStateId
        })
      )
    ).not.toBeNull()
  })

  it('returns null and writes nothing when the actor owns no effects or states', async () => {
    const fixture = await setupCharacterRun()
    const removedActor = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!removedActor) throw new Error('Fixture Custom actor is unavailable.')
    const state = await runState(fixture)
    const before = await records(fixture)
    await expect(
      fixture.t.run((ctx) =>
        cleanupRemovedActorEffects(encounterWriteTransaction(ctx), {
          state,
          actorId: removedActor.id,
          occurredAt: '2026-09-13T00:00:00.000Z'
        })
      )
    ).resolves.toBeNull()
    expect(await records(fixture)).toEqual(before)
  })

  it('rolls back every cleanup write when the enclosing transaction aborts', async () => {
    const fixture = await setupCharacterRun()
    const removedActor = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!removedActor) throw new Error('Fixture Custom actor is unavailable.')
    const state = await runState(fixture)
    const stateId = crypto.randomUUID()
    await fixture.t.run(async (ctx) => {
      const effects = createActiveRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      })
      await effects.createMaintainedState({
        id: stateId,
        encounterId: state.id,
        ownerActorId: removedActor.id,
        descriptor: descriptor(removedActor.id, 'TERMINATE_WHEN_EMPTY')
      })
      await effects.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        definition: definition(state.id, removedActor.id),
        lifecycle,
        maintainedEffectStateId: stateId
      })
    })
    const before = await records(fixture)
    await expect(
      fixture.t.run(async (ctx) => {
        await cleanupRemovedActorEffects(encounterWriteTransaction(ctx), {
          state,
          actorId: removedActor.id,
          occurredAt: '2026-09-13T00:00:00.000Z'
        })
        throw new Error('Injected transaction abort')
      })
    ).rejects.toThrow('Injected transaction abort')
    expect(await records(fixture)).toEqual(before)
  })

  it('preflights corrupt Character state before deleting effects', async () => {
    const fixture = await setupCharacterRun()
    const removedActor = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!removedActor) throw new Error('Fixture Custom actor is unavailable.')
    const state = await runState(fixture)
    const stateId = crypto.randomUUID()
    await fixture.t.run(async (ctx) => {
      const effects = createActiveRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      })
      await effects.createMaintainedState({
        id: stateId,
        encounterId: state.id,
        ownerActorId: removedActor.id,
        descriptor: descriptor(removedActor.id, 'TERMINATE_WHEN_EMPTY')
      })
      await effects.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        definition: definition(state.id, removedActor.id),
        lifecycle,
        maintainedEffectStateId: stateId
      })
      const character = await ctx.db
        .query('characterBuildStates')
        .withIndex('by_characterId', (q) => q.eq('characterId', fixture.character.id))
        .unique()
      if (!character) throw new Error('Fixture Character is unavailable.')
      await ctx.db.patch(character._id, { checksum: '0'.repeat(64) })
    })
    const snapshot = () =>
      fixture.t.run(async (ctx) =>
        Object.fromEntries(
          await Promise.all(
            (
              [
                'characters',
                'characterBuildStates',
                'characterPlayStates',
                'characterInventoryItems',
                'characterCurrencyGroups',
                'characterClassSpellStates',
                'characterSpellCustomizations',
                'characterCreatureInstances',
                'characterVehicleInstances',
                'characterNotes',
                'characterNoteGroups',
                'characterExtraEquipment',
                'characterCommandReceipts',
                'characterActiveRuleEffects',
                'encounterActiveRuleEffects',
                'encounterMaintainedEffectStates',
                'receiptLedgers',
                'receiptLedgerParts'
              ] as const
            ).map(async (table) => [table, await ctx.db.query(table).collect()])
          )
        )
      )
    const before = await snapshot()
    await expect(
      fixture.t.run((ctx) =>
        cleanupRemovedActorEffects(encounterWriteTransaction(ctx), {
          state,
          actorId: removedActor.id,
          occurredAt: '2026-09-13T00:00:00.000Z'
        })
      )
    ).rejects.toThrow('build integrity mismatch')
    expect(await snapshot()).toEqual(before)
  })
})
