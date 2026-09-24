import migrations from '@convex-dev/migrations/test'
import { defineSchema, makeFunctionReference, type WithoutSystemFields } from 'convex/server'
import { convexTest } from 'convex-test'
import { expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRunSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { sceneStoredPresentationSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import type { Doc, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
const runPlayMigrations = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'campaigns/playMigrations:run'
)
// Development rows predate the narrow schema, so the legacy store must accept removed fields.
const legacySchema = defineSchema(schema.tables, { schemaValidation: false })

/** Rows written before ADR 0033 carry fields the narrow data model no longer types. */
function insertLegacy<T extends TableNames>(ctx: MutationCtx, table: T, row: object) {
  return ctx.db.insert(table, row as WithoutSystemFields<Doc<T>>)
}

function parseObject(json: string): Record<string, unknown> {
  const value: unknown = JSON.parse(json)
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected stored JSON object.')
  return Object.fromEntries(Object.entries(value))
}

it('strips Session keys from every Campaign-owned play row and narrows presentations', async ({
  onTestFinished
}) => {
  const base = await createEncounterSceneFixture()
  await base.other.caller.mutation(execute, {
    command: {
      type: 'UPSERT_REMINDER',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      reminder: {
        label: 'Legacy',
        timing: 'ROUND_NUMBER',
        round: 2,
        actorId: null,
        public: false,
        notes: null,
        order: 0
      }
    }
  })
  const current = await base.t.run(async (ctx) => ({
    campaign: await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique(),
    scene: await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique(),
    command: (
      await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
        .collect()
    ).find((row) => row.commandType === 'UPSERT_REMINDER')
  }))
  const { campaign, scene, run, command } = current
  if (!campaign || !scene || !run || command?.commandType !== 'UPSERT_REMINDER')
    throw new Error('Missing current play rows.')

  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const t = convexTest(legacySchema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  migrations.register(t)
  const sessionId = crypto.randomUUID()
  const now = new Date().toISOString()
  const earlier = new Date(Date.parse(now) - 60_000).toISOString()
  const legacyState = { ...parseObject(run.stateJson), sessionId }
  const legacyProjection = { ...parseObject(run.projectionJson), sessionId }
  const currentResult = parseObject(command.resultJson)
  const legacyCommandResult = {
    ...currentResult,
    projection: { ...parseObject(JSON.stringify(currentResult.projection)), sessionId }
  }
  const fogInput = {
    type: 'PATCH_SCENE_FOG',
    sceneId: base.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    session: { sessionId, expectedSessionVersion: 3, expectedPresentationVersion: 1 },
    layer: { ownerUserId: null, width: 1, height: 1 },
    chunkManifest: []
  }
  const ids = await t.run(async (ctx) => {
    const { _id: _campaignId, _creationTime: _campaignTime, ...storedCampaign } = campaign
    const campaignRootId = await ctx.db.insert('campaigns', storedCampaign)
    const { _id: _sceneId, _creationTime: _sceneTime, ...storedScene } = scene
    await ctx.db.insert('campaignScenes', storedScene)
    const { _id: _runId, _creationTime: _runTime, ...storedRun } = run
    const { _id: _commandId, _creationTime: _commandTime, ...storedCommand } = command
    const epoch = crypto.randomUUID()
    return {
      authority: await insertLegacy(ctx, 'campaignLiveAuthorities', {
        campaignId: campaign.id,
        sessionId,
        epoch,
        phase: 'DO_ACTIVE',
        activationFingerprint: '0'.repeat(64),
        persistedSequence: 0,
        persistedStateChecksum: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      }),
      job: await insertLegacy(ctx, 'campaignDeletionJobs', {
        campaignId: campaign.id,
        campaignRootId,
        liveAuthority: { sessionId, epoch }
      }),
      olderPresentation: await insertLegacy(ctx, 'campaignScenePresentations', {
        campaignId: campaign.id,
        sessionId: crypto.randomUUID(),
        sceneId: null,
        version: 4,
        activeMapAssetId: null,
        createdAt: earlier,
        updatedAt: earlier
      }),
      presentation: await insertLegacy(ctx, 'campaignScenePresentations', {
        campaignId: campaign.id,
        sessionId,
        sceneId: scene.id,
        version: 2,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      }),
      sessionMarker: await insertLegacy(ctx, 'sceneVisionRevisions', {
        scope: 'SESSION',
        id: sessionId,
        revision: crypto.randomUUID()
      }),
      campaignMarker: await insertLegacy(ctx, 'sceneVisionRevisions', {
        scope: 'CAMPAIGN',
        id: campaign.id,
        revision: crypto.randomUUID()
      }),
      run: await insertLegacy(ctx, 'encounterRuns', {
        ...storedRun,
        sessionId,
        stateJson: JSON.stringify(legacyState),
        stateChecksum: checksumCanonicalJson(legacyState),
        projectionJson: JSON.stringify(legacyProjection),
        projectionChecksum: checksumCanonicalJson(legacyProjection)
      }),
      command: await insertLegacy(ctx, 'encounterRunCommands', {
        ...storedCommand,
        resultJson: JSON.stringify(legacyCommandResult),
        resultChecksum: checksumCanonicalJson(legacyCommandResult)
      }),
      receipt: await insertLegacy(ctx, 'encounterRuleReceipts', {
        campaignId: campaign.id,
        encounterId: run.id,
        commandMetadataJson: JSON.stringify({
          schemaVersion: 1,
          transition: 'ACTION_EVIDENCE',
          rootCommandId: crypto.randomUUID(),
          rootCommandFingerprint: '0'.repeat(64),
          rootInitiatorUserId: base.other.userId,
          expectedAggregateVersion: 1,
          expectedOccurrenceVersion: 0,
          requestId: 'legacy-request',
          resolutionKind: 'SYSTEM_ROLL',
          commandResult: {
            resultJson: JSON.stringify(legacyCommandResult),
            resultChecksum: checksumCanonicalJson(legacyCommandResult)
          }
        })
      }),
      geometrySave: await insertLegacy(ctx, 'sceneGeometrySaves', {
        sceneId: scene.id,
        sessionVision: {
          campaignId: campaign.id,
          systemId: campaign.gameSystemId,
          sceneId: scene.id,
          expectedSceneVersion: 0,
          sessionId,
          expectedSessionVersion: 3,
          expectedPresentationVersion: 1,
          freshness: { system: null, campaign: null, session: crypto.randomUUID() }
        }
      }),
      fogSave: await insertLegacy(ctx, 'sceneFogSaves', {
        sceneId: scene.id,
        input: fogInput,
        inputChecksum: checksumCanonicalJson(fogInput)
      }),
      fogCommand: await insertLegacy(ctx, 'sceneLiveCommands', {
        sceneId: scene.id,
        encoding: 'FOG_PATCH',
        input: fogInput,
        inputChecksum: checksumCanonicalJson(fogInput)
      }),
      event: await insertLegacy(ctx, 'campaignEvents', {
        campaignId: campaign.id,
        type: 'SESSION_SCENE_PRESENTATION_SET',
        payloadJson: JSON.stringify({
          commandFingerprint: '0'.repeat(64),
          result: {
            commandId: crypto.randomUUID(),
            replayed: false,
            sessionId,
            sceneId: null,
            version: 0
          }
        })
      })
    }
  })

  await t.mutation(runPlayMigrations, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves every migration is idempotent on narrowed rows.
  await t.mutation(runPlayMigrations, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await t.run(async (ctx) => ({
    authority: await ctx.db.get(ids.authority),
    job: await ctx.db.get(ids.job),
    olderPresentation: await ctx.db.get(ids.olderPresentation),
    presentation: await ctx.db.get(ids.presentation),
    sessionMarker: await ctx.db.get(ids.sessionMarker),
    campaignMarker: await ctx.db.get(ids.campaignMarker),
    run: await ctx.db.get(ids.run),
    command: await ctx.db.get(ids.command),
    receipt: await ctx.db.get(ids.receipt),
    geometrySave: await ctx.db.get(ids.geometrySave),
    fogSave: await ctx.db.get(ids.fogSave),
    fogCommand: await ctx.db.get(ids.fogCommand),
    event: await ctx.db.get(ids.event)
  }))
  expect(migrated.authority).toBeNull()
  expect(migrated.job?.liveAuthority).toEqual({ epoch: expect.any(String) })
  expect(migrated.olderPresentation).toBeNull()
  const { _id, _creationTime, ...presentation } = migrated.presentation!
  expect(sceneStoredPresentationSchema.parse(presentation)).toEqual({
    campaignId: campaign.id,
    sceneId: scene.id,
    version: 2,
    activeMapAssetId: scene.map.assetId.toLowerCase(),
    createdAt: now,
    updatedAt: now
  })
  expect(migrated.sessionMarker).toBeNull()
  expect(migrated.campaignMarker).not.toBeNull()
  const { _id: _migratedRunId, _creationTime: _migratedRunTime, ...migratedRun } = migrated.run!
  const { _id: _currentRunId, _creationTime: _currentRunTime, ...currentRun } = run
  expect(encounterStoredRunSchema.parse(migratedRun)).toEqual(currentRun)
  expect(migrated.command).toMatchObject({
    resultJson: command.resultJson,
    resultChecksum: command.resultChecksum
  })
  expect(JSON.parse(migrated.receipt!.commandMetadataJson)).toMatchObject({
    commandResult: { resultJson: command.resultJson, resultChecksum: command.resultChecksum }
  })
  expect(migrated.geometrySave?.sessionVision).toEqual({
    campaignId: campaign.id,
    systemId: campaign.gameSystemId,
    sceneId: scene.id,
    expectedSceneVersion: 0,
    expectedPresentationVersion: 1,
    freshness: { system: null, campaign: null, play: null }
  })
  const { session: _session, ...currentFog } = fogInput
  const narrowedFog = { ...currentFog, presentation: { expectedPresentationVersion: 1 } }
  for (const row of [migrated.fogSave, migrated.fogCommand])
    expect(row).toMatchObject({
      input: narrowedFog,
      inputChecksum: checksumCanonicalJson(narrowedFog)
    })
  expect(JSON.parse(migrated.event!.payloadJson)).toMatchObject({
    result: { campaignId: campaign.id, sceneId: null, version: 0 }
  })
  expect(JSON.parse(migrated.event!.payloadJson).result).not.toHaveProperty('sessionId')
})
