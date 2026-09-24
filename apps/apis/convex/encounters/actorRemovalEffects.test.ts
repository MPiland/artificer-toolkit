import { describe, expect, it } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type {
  EncounterExecuteInput,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { maintenanceCompleteRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResults'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createPlatformRulesRuntime,
  requireInstalledGameSystemRuleCapability
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto,
  EncounterMaintainedEffectDescriptorDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'

import { readRunActors, readRunState } from './documents'
import { cleanupRemovedActorEffects } from './actorRemovalEffects'
import { createActiveRuleEffectStore } from '../rules/effectStore'

const lifecycle: ActiveRuleEffectLifecycleDto = { schemaVersion: 1, remainingTicks: 3 }
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
type EmptyPolicy = 'V1' | 'TERMINATE_WHEN_EMPTY' | 'RETAIN_UNTIL_TERMINAL'

function definition(encounterId: string, sourceActorId: string): ActiveRuleEffectDefinitionDto {
  const sourceOccurrenceId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const authoredEffectId = crypto.randomUUID()
  const compiledEntryId = crypto.randomUUID()
  return {
    schemaVersion: 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: encounterId,
      sourceOccurrenceId,
      rootCommandId,
      sourceActorId
    },
    authoredEffectId,
    compiledEntryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: authoredEffectId,
        gameSystemId: crypto.randomUUID(),
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'TICKS', initialRemaining: 3, decrementStage: 'END_OF_TURN' }
    }
  }
}

function descriptor(
  sourceActorId: string,
  policy: EmptyPolicy
): EncounterMaintainedEffectDescriptorDto {
  const base = {
    maintenanceDefinitionId: crypto.randomUUID(),
    definitionChecksum: 'b'.repeat(64),
    sourceActionId: crypto.randomUUID(),
    sourceOccurrenceId: crypto.randomUUID(),
    sourceActorId,
    replacementPolicy: 'REPLACE_SAME_DEFINITION' as const
  }
  if (policy === 'V1') return { ...base, schemaVersion: 1 }
  return { ...base, schemaVersion: 2, emptyDependentPolicy: policy }
}

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

async function records(fixture: Awaited<ReturnType<typeof setupCharacterRun>>) {
  return fixture.t.run(async (ctx) => ({
    character: await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique(),
    receipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', fixture.character.id))
      .collect(),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    actorEffects: await ctx.db.query('encounterActiveRuleEffects').collect(),
    maintainedStates: await ctx.db.query('encounterMaintainedEffectStates').collect()
  }))
}

describe('native actor maintained-effect cleanup', () => {
  it.each(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'] as const)(
    'terminates an owned v2 state with %s after deleting Character and actor dependents',
    async (policy) => {
      const fixture = await setupCharacterRun()
      const removedActor = fixture.run.actors.find((actor) => actor.kind === 'CUSTOM')
      if (!removedActor) throw new Error('Fixture Custom actor is unavailable.')
      const state = await runState(fixture)
      const stateId = crypto.randomUUID()
      const characterEffectId = crypto.randomUUID()
      const actorEffectId = crypto.randomUUID()
      await fixture.t.run(async (ctx) => {
        const effects = createActiveRuleEffectStore(ctx)
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
      const before = await records(fixture)
      const command = {
        type: 'REMOVE_ACTOR' as const,
        encounterId: state.id,
        actorId: removedActor.id,
        expectedVersion: state.version,
        commandId: crypto.randomUUID()
      }
      const removed = await fixture.owner.caller.mutation(execute, { command })
      const result = await fixture.t.run(async (ctx) => {
        const receipt = await ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) =>
            q.eq('encounterId', state.id).eq('commandId', command.commandId)
          )
          .unique()
        if (!receipt) throw new Error('Missing maintenance receipt')
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', state.id))
          .unique()
        if (!run) throw new Error('Missing Run')
        const mirror = (await readRunActors(ctx, readRunState(run))).find(
          (actor) => actor.id === fixture.actor.id
        )!
        expect(mirror.sourceRevision).toBe(before.character!.streamVersion + 1)
        expect(mirror.snapshot).toMatchObject({
          sourceRevision: before.character!.streamVersion + 1
        })
        expect(
          removed.projection.actors.find((actor) => actor.id === fixture.actor.id)!.sourceRevision
        ).toBe(mirror.sourceRevision)
        return maintenanceCompleteRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
      })
      expect(result).toMatchObject({
        terminatedStates: [{ id: stateId, ownerActorId: removedActor.id, expectedVersion: 1 }],
        removedEffects: [
          { activeEffectId: characterEffectId, kind: 'CHARACTER', ownerId: fixture.character.id },
          { activeEffectId: actorEffectId, kind: 'ENCOUNTER_ACTOR', ownerId: fixture.actor.id }
        ],
        characterOwnerTransitions: [
          {
            characterId: fixture.character.id,
            beforeStreamVersion: before.character!.streamVersion,
            afterStreamVersion: before.character!.streamVersion + 1
          }
        ]
      })
      const after = await records(fixture)
      expect(after.character).toEqual({
        ...before.character,
        streamVersion: before.character!.streamVersion + 1,
        updatedAt: removed.projection.updatedAt
      })
      expect(after.receipts).toEqual(before.receipts)
      expect(after.characterEffects).toEqual([])
      expect(after.actorEffects).toEqual([])
      expect(after.maintainedStates).toEqual([])
      expect(await fixture.owner.caller.mutation(execute, { command })).toEqual(removed)
      expect(await records(fixture)).toEqual(after)
      await fixture.owner.caller.mutation(execute, {
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
      createActiveRuleEffectStore(ctx).createMaintainedState({
        id: crypto.randomUUID(),
        encounterId: state.id,
        ownerActorId: target.id,
        descriptor: descriptor(target.id, 'RETAIN_UNTIL_TERMINAL')
      })
    )
    const occurrenceId = crypto.randomUUID()
    const graph = definition(state.id, target.id).frozenGraph
    const runtime = createPlatformRulesRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
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
            inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
          }
        ],
        outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'entry', port: 'value' } }
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
        kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK',
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
          contributors: [],
          contributorChecksum: checksum
        },
        targetCharacter: {
          streamVersion: target.sourceRevision,
          baseProjectionChecksum: checksum,
          campaignOverlayChecksum: checksum,
          mechanicalContextChecksum: checksum
        },
        systemVocabularySnapshot: { id: state.gameSystemId, version: 1, checksum },
        contextChecksum: checksum,
        remaining: []
      }
    })
    const now = new Date().toISOString()
    const pendingId = await fixture.t.run((ctx) =>
      ctx.db.insert('encounterRuleOccurrences', {
        id: occurrenceId,
        campaignId: state.campaignId,
        encounterId: state.id,
        rootCommandId: crypto.randomUUID(),
        state: 'PENDING',
        version: 2,
        expectedEncounterVersion: state.version,
        pendingSnapshotJson: JSON.stringify(snapshot),
        pendingSnapshotChecksum: checksumCanonicalJson(snapshot),
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
    const before = await records(fixture)
    await expect(
      fixture.owner.caller.mutation(execute, { command: { ...command, actorId: other.id } })
    ).rejects.toThrow('pending Encounter occurrence')
    expect(await records(fixture)).toEqual(before)
    if (snapshot.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK')
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
    await fixture.t.run((ctx) =>
      ctx.db.patch(pendingId, {
        pendingSnapshotJson: JSON.stringify(mismatched),
        pendingSnapshotChecksum: checksumCanonicalJson(mismatched)
      })
    )
    await expect(fixture.owner.caller.mutation(execute, { command })).rejects.toThrow(
      'did not terminate'
    )
    expect(await records(fixture)).toEqual(before)
    await fixture.t.run((ctx) =>
      ctx.db.patch(pendingId, {
        pendingSnapshotJson: JSON.stringify(snapshot),
        pendingSnapshotChecksum: checksumCanonicalJson(snapshot)
      })
    )
    const result = await fixture.owner.caller.mutation(execute, { command })
    const completed = await fixture.t.run((ctx) => ctx.db.get(pendingId))
    expect(completed).toMatchObject({
      state: 'COMPLETED',
      version: 3,
      expectedEncounterVersion: state.version + 1,
      pendingSnapshotJson: null,
      pendingSnapshotChecksum: null
    })
    expect((await records(fixture)).maintainedStates).toEqual([])
    expect(await fixture.owner.caller.mutation(execute, { command })).toEqual(result)
  })

  it.each([
    ['V1', true],
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
      const effects = createActiveRuleEffectStore(ctx)
      await effects.createMaintainedState({
        id: foreignStateId,
        encounterId: state.id,
        ownerActorId: fixture.actor.id,
        descriptor: descriptor(fixture.actor.id, policy)
      })
      await effects.create({
        id: effectId,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: state.id, targetActorId: removedActor.id },
        definition: definition(state.id, fixture.actor.id),
        lifecycle,
        maintainedEffectStateId: foreignStateId
      })
    })
    const result = await fixture.t.run((ctx) =>
      cleanupRemovedActorEffects(ctx, {
        state,
        actorId: removedActor.id,
        occurredAt: '2026-09-13T00:00:00.000Z'
      })
    )
    expect(result?.removedEffects).toHaveLength(1)
    expect(result?.terminatedStates).toHaveLength(terminates ? 1 : 0)
    expect(
      await fixture.t.run((ctx) =>
        createActiveRuleEffectStore(ctx).findMaintainedStateById({
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
      const effects = createActiveRuleEffectStore(ctx)
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
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: state.id, targetActorId: removedActor.id },
        definition: definition(state.id, fixture.actor.id),
        lifecycle,
        maintainedEffectStateId: foreignStateId
      })
    })
    const before = await records(fixture)
    const result = await fixture.t.run((ctx) =>
      cleanupRemovedActorEffects(ctx, {
        state,
        actorId: removedActor.id,
        occurredAt: '2026-09-13T00:00:00.000Z'
      })
    )
    expect(result).toMatchObject({ terminatedStates: [], characterOwnerTransitions: [] })
    const after = await records(fixture)
    expect(after.character).toEqual(before.character)
    expect(
      await fixture.t.run((ctx) =>
        createActiveRuleEffectStore(ctx).findById(
          { kind: 'CHARACTER', characterId: fixture.character.id },
          retainedCharacterEffectId
        )
      )
    ).not.toBeNull()
    expect(
      await fixture.t.run((ctx) =>
        createActiveRuleEffectStore(ctx).findMaintainedStateById({
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
        cleanupRemovedActorEffects(ctx, {
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
      const effects = createActiveRuleEffectStore(ctx)
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
        await cleanupRemovedActorEffects(ctx, {
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
      const effects = createActiveRuleEffectStore(ctx)
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
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique()
      if (!character) throw new Error('Fixture Character is unavailable.')
      await ctx.db.patch(character._id, { checksum: '0'.repeat(64) })
    })
    const before = await records(fixture)
    await expect(
      fixture.t.run((ctx) =>
        cleanupRemovedActorEffects(ctx, {
          state,
          actorId: removedActor.id,
          occurredAt: '2026-09-13T00:00:00.000Z'
        })
      )
    ).rejects.toThrow('checksum')
    expect(await records(fixture)).toEqual(before)
  })
})
