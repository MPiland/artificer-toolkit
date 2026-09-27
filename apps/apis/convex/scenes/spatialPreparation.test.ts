import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { movementCompleteRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionSpatialResults'

import {
  sceneSpatialPreparationSchema,
  type SceneSpatialPreparation
} from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { createSpatialPreparationFixture as setup } from '../../tests/fixtures/spatialPreparation'
import { internal } from '../_generated/api'
import { readRunState } from '../encounters/documents'
import { readGeometrySave, readSpatialPreparation } from './geometryDocuments'
import { readSessionVisionScope } from './sessionVisionDocuments'
import { advanceLiveState, readLiveScene } from './liveDocuments'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { persistSpatialPreparation } from './spatialPreparationPersistence'

beforeEach(() =>
  vi.stubEnv('BETTER_AUTH_SECRET', 'spatial-preparation-test-secret-at-least-32-bytes')
)
afterEach(() => vi.unstubAllEnvs())

async function preparation(
  value: Awaited<ReturnType<typeof setup>>
): Promise<SceneSpatialPreparation> {
  const { base, saveId, tokenId } = value
  return base.owner.caller.run(async (ctx) => {
    const valueOccurrenceId = crypto.randomUUID()
    const { save } = await readGeometrySave(ctx, saveId)
    const { presentation } = await readSessionVisionScope(ctx, save.sessionVision!)
    return {
      encounterId: base.run.id,
      expectedEncounterVersion: value.input.expectedEncounterVersion!,
      occurrenceId: valueOccurrenceId,
      occurredAt: new Date().toISOString(),
      outcome: {
        kind: 'TERMINAL',
        result: movementCompleteRuleExecutionResultDtoSchema.parse({
          status: 'MOVEMENT_COMPLETE',
          schemaVersion: 1,
          occurrenceId: valueOccurrenceId,
          occurrenceVersion: 0,
          encounterId: base.run.id,
          encounterVersion: value.input.expectedEncounterVersion! + 1,
          sceneId: base.sceneId,
          sceneVersion: 1,
          tokenId,
          movementKind: 'VOLUNTARY',
          reactionExecutions: [],
          terminalPosition: { x: 10, y: 0 }
        }),
        selectionChecksum: checksumCanonicalJson({ presentation: presentation.version }),
        currentnessChecksum: checksumCanonicalJson({ scene: save.snapshotVersion })
      }
    } satisfies SceneSpatialPreparation
  })
}

describe('spatial preparation persistence', () => {
  it('retains pending evidence and refuses a different command root', async () => {
    const value = await setup()
    const terminal = await preparation(value)
    const checksum = checksumCanonicalJson({ fixture: 'pending' })
    const effectId = crypto.randomUUID()
    const pendingSnapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      snapshotKind: 'KERNEL_EVIDENCE',
      schemaVersion: 1,
      occurrenceId: terminal.occurrenceId,
      graph: {
        schemaVersion: 1,
        source: {
          definitionId: crypto.randomUUID(),
          gameSystemId: value.base.campaign.gameSystemId,
          definitionFamilyKey: 'test-resolution',
          checksum
        },
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [{ id: 'roll', operation: { key: 'test.roll', contractVersion: 1 }, inputs: {} }],
        outputs: { result: { kind: 'NODE_OUTPUT', nodeId: 'roll', port: 'value' } }
      },
      facts: {},
      nextNodeIndex: 0,
      nodeOutputs: {},
      trace: [],
      request: {
        requestId: 'spatial-roll',
        kind: 'INTEGER_RANGE',
        nodeId: 'roll',
        ordinal: 0,
        min: 1,
        max: 20
      },
      authority: 'APPLICATION_SERVICE',
      redaction: 'SERVER_ONLY',
      seal: checksum,
      applicationContext: {
        kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
        schemaVersion: 1,
        root: {
          commandId: value.input.commandId,
          commandFingerprint: checksumCanonicalJson(value.input),
          initiatorUserId: value.base.owner.userId,
          correlationId: null,
          encounterId: terminal.encounterId,
          sceneId: value.base.sceneId,
          tokenId: value.tokenId,
          expectedEncounterVersion: terminal.expectedEncounterVersion,
          expectedSceneVersion: 0,
          currentSceneVersion: 0,
          movementKind: 'VOLUNTARY',
          originalPath: value.input.path,
          pathChecksum: checksumRuleDocument(value.input.path),
          pathStartDistance: 0,
          currentPosition: { x: 0, y: 0 },
          resolutionCommands: []
        },
        selectionChecksum: checksum,
        completedExecutions: [],
        currentCandidate: {
          ordinal: 0,
          candidate: {
            contact: { x: 0, y: 0 },
            effectId,
            pathDistance: 0,
            sourceActorId: null,
            sourceMoved: false,
            targetActorId: value.base.run.actors[0]!.id,
            trigger: 'ENTER'
          },
          effect: {
            effectId,
            version: 1,
            definitionChecksum: checksum,
            lifecycleChecksum: checksum,
            placementChecksum: checksum,
            spatialStateChecksum: checksum,
            authoredEffectId: crypto.randomUUID(),
            compiledEntryId: crypto.randomUUID(),
            frozenGraphNodeId: 'effect',
            frozenSourceChecksum: checksum,
            capabilityContractVersion: 1,
            activation: 'REPEATABLE',
            revealed: false,
            revealOnTrigger: true
          },
          target: { kind: 'ENCOUNTER_ACTOR', targetStateChecksum: checksum },
          d20Policy: null
        },
        remainingCandidates: []
      }
    })
    const pending: SceneSpatialPreparation = {
      ...terminal,
      outcome: {
        kind: 'PENDING',
        pendingSnapshot,
        movementIntent: { tokenId: value.tokenId, position: { x: 0, y: 0 } }
      }
    }
    for (const invalidSnapshot of [
      { ...pendingSnapshot, applicationContext: { kind: 'NONE' } },
      { ...pendingSnapshot, phaseReceipts: [] }
    ]) {
      expect(
        sceneSpatialPreparationSchema.safeParse({
          ...pending,
          outcome: { ...pending.outcome, pendingSnapshot: invalidSnapshot }
        }).success
      ).toBe(false)
    }
    await expect(
      value.base.owner.caller.run((ctx) => persistSpatialPreparation(ctx, value.saveId, pending))
    ).resolves.toEqual({ preparation: pending, checksum: checksumCanonicalJson(pending) })
    await value.base.owner.caller.run(async (ctx) => {
      const { row, save } = await readGeometrySave(ctx, value.saveId)
      expect(readSpatialPreparation(save)).toEqual(pending)
      const context = pendingSnapshot.applicationContext
      if (context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT') throw new Error('Expected spatial fixture')
      const corrupted = {
        ...pending,
        outcome: {
          ...pending.outcome,
          pendingSnapshot: {
            ...pendingSnapshot,
            applicationContext: {
              ...context,
              root: { ...context.root, commandId: crypto.randomUUID() }
            }
          }
        }
      }
      await ctx.db.patch(row._id, {
        spatialPreparationJson: JSON.stringify(corrupted),
        spatialPreparationChecksum: checksumCanonicalJson(corrupted)
      })
    })
    await expect(
      value.base.owner.caller.run((ctx) => readGeometrySave(ctx, value.saveId))
    ).rejects.toThrow('Spatial pending preparation identity is inconsistent.')
  })

  it.each(['actor', 'run', 'binding', 'presentation', 'scene', 'expired', 'fog'] as const)(
    'rejects a stale %s fence without retaining evidence',
    async (fence) => {
      const value = await setup()
      const frozen = await preparation(value)
      await value.base.owner.caller.run(async (ctx) => {
        if (fence === 'run') {
          const row = await ctx.db
            .query('encounterRuns')
            .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
            .unique()
          if (!row) throw new Error('Fixture Run missing')
          const state = { ...readRunState(row), version: row.version + 1 }
          await ctx.db.patch(row._id, {
            version: state.version,
            stateJson: JSON.stringify(state),
            stateChecksum: checksumCanonicalJson(state)
          })
        } else if (fence === 'binding') {
          const row = await ctx.db
            .query('encounterSceneBindings')
            .withIndex('by_encounterId', (q) => q.eq('encounterId', value.base.run.id))
            .unique()
          if (!row) throw new Error('Fixture binding missing')
          await ctx.db.patch(row._id, { sceneId: crypto.randomUUID() })
        } else if (fence === 'presentation') {
          const row = await ctx.db
            .query('campaignScenePresentations')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', value.base.campaign.id))
            .unique()
          if (!row) throw new Error('Fixture presentation missing')
          await ctx.db.patch(row._id, { version: row.version + 1 })
        } else if (fence === 'scene') {
          const { header, live } = await readLiveScene(ctx, value.base.sceneId, 'MEMBER')
          await ctx.db.insert('sceneLiveStates', advanceLiveState(header, live))
        } else if (fence === 'expired' || fence === 'fog') {
          const { row } = await readGeometrySave(ctx, value.saveId)
          await ctx.db.patch(
            row._id,
            fence === 'expired'
              ? { expiresAt: 0 }
              : { fogSaves: [{ saveId: crypto.randomUUID(), ownerUserId: null }] }
          )
        }
      })
      const caller = fence === 'actor' ? value.base.other.caller : value.base.owner.caller
      const message = {
        actor: 'Scene geometry save is unavailable or expired.',
        run: 'Spatial preparation Encounter scope is stale.',
        binding: 'Spatial preparation Scene binding is stale.',
        presentation: 'Scene vision presentation is stale.',
        scene: 'Scene changed before geometry publication.',
        expired: 'Scene geometry save is unavailable or expired.',
        fog: 'Spatial preparation must precede fog staging.'
      }[fence]
      await expect(
        caller.run((ctx) => persistSpatialPreparation(ctx, value.saveId, frozen))
      ).rejects.toThrow(message)
      const stored = await value.base.t.run((ctx) =>
        ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
          .unique()
      )
      expect(stored?.spatialPreparationJson).toBeUndefined()
      expect(stored?.spatialPreparationChecksum).toBeUndefined()
    }
  )

  it('persists and reads exact terminal evidence, including an identical retry after fog staging', async () => {
    const value = await setup()
    const frozen = await preparation(value)
    const first = await value.base.owner.caller.run((ctx) =>
      persistSpatialPreparation(ctx, value.saveId, frozen)
    )
    expect(first).toEqual({ preparation: frozen, checksum: checksumCanonicalJson(frozen) })
    const stored = await value.base.owner.caller.run(async (ctx) => {
      const { save } = await readGeometrySave(ctx, value.saveId)
      return readSpatialPreparation(save)
    })
    expect(stored).toEqual(frozen)
    await value.base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
        .unique()
      if (!row) throw new Error('Geometry save missing')
      await ctx.db.patch(row._id, {
        fogSaves: [{ saveId: crypto.randomUUID(), ownerUserId: null }]
      })
    })
    await expect(
      value.base.owner.caller.run((ctx) => persistSpatialPreparation(ctx, value.saveId, frozen))
    ).resolves.toEqual({ preparation: frozen, checksum: checksumCanonicalJson(frozen) })
  })

  it('rejects different evidence and rolls back a preparation write when its parent throws', async () => {
    const value = await setup()
    const frozen = await preparation(value)
    await expect(
      value.base.owner.caller.run(async (ctx) => {
        await persistSpatialPreparation(ctx, value.saveId, frozen)
        throw new Error('parent failure')
      })
    ).rejects.toThrow('parent failure')
    const afterRollback = await value.base.owner.caller.run(
      async (ctx) => (await readGeometrySave(ctx, value.saveId)).save
    )
    expect(afterRollback.spatialPreparationJson).toBeUndefined()
    const persisted = await value.base.owner.caller.run((ctx) =>
      persistSpatialPreparation(ctx, value.saveId, frozen)
    )
    if (frozen.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
    const changed = {
      ...frozen,
      outcome: { ...frozen.outcome, currentnessChecksum: checksumCanonicalJson({ changed: true }) }
    }
    await expect(
      value.base.owner.caller.run((ctx) => persistSpatialPreparation(ctx, value.saveId, changed))
    ).rejects.toThrow('Spatial preparation cannot replace previously frozen evidence.')
    expect(persisted.preparation).toEqual(frozen)
  })

  it('refuses to replace prepared Character revisions', async () => {
    const value = await setup()
    const frozen = await preparation(value)
    await value.base.owner.caller.run((ctx) => persistSpatialPreparation(ctx, value.saveId, frozen))
    const before = await value.base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
        .unique()
      if (!row) throw new Error('Geometry save missing')
      await ctx.db.patch(row._id, {
        characterRevisions: [{ characterId: crypto.randomUUID(), revision: crypto.randomUUID() }]
      })
      return ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
        .unique()
    })

    await expect(
      value.base.owner.caller.mutation(internal.scenes.geometryStaging.observe, {
        saveId: value.saveId,
        characterRevisions: []
      })
    ).rejects.toThrow('Spatial preparation is stale and cannot be rebased.')

    expect(
      await value.base.t.run((ctx) =>
        ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
          .unique()
      )
    ).toEqual(before)
  })

  it('rejects incomplete pairs, bad checksums, and mismatched root identities on read', async () => {
    const value = await setup()
    const frozen = await preparation(value)
    await value.base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
        .unique()
      if (!row) throw new Error('Geometry save missing')
      await ctx.db.patch(row._id, { spatialPreparationJson: JSON.stringify(frozen) })
    })
    await expect(
      value.base.owner.caller.run((ctx) => readGeometrySave(ctx, value.saveId))
    ).rejects.toThrow('Stored spatial preparation is incomplete.')
    await value.base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
        .unique()
      if (!row) throw new Error('Geometry save missing')
      await ctx.db.patch(row._id, {
        spatialPreparationJson: JSON.stringify(frozen),
        spatialPreparationChecksum: checksumCanonicalJson({ bad: true })
      })
    })
    await expect(
      value.base.owner.caller.run((ctx) => readGeometrySave(ctx, value.saveId))
    ).rejects.toThrow('Stored spatial preparation checksum is inconsistent.')
    const valid = await setup()
    const validFrozen = await preparation(valid)
    await valid.base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', valid.saveId))
        .unique()
      if (!row) throw new Error('Geometry save missing')
      const mismatched = { ...validFrozen, encounterId: crypto.randomUUID() }
      await ctx.db.patch(row._id, {
        spatialPreparationJson: JSON.stringify(mismatched),
        spatialPreparationChecksum: checksumCanonicalJson(mismatched)
      })
    })
    await expect(
      valid.base.owner.caller.run((ctx) => readGeometrySave(ctx, valid.saveId))
    ).rejects.toThrow('Spatial terminal preparation identity is inconsistent.')
  })
})
