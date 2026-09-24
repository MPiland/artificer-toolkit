import { Migrations } from '@convex-dev/migrations'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import { sceneFogPatchInputSchema } from '@artificer-toolkit/schema/api/sceneFog'
import { campaignLiveScenePresentationReceiptDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { encounterStoredRunSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { sceneStoredPresentationSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneVisionRevisionSchema } from '@artificer-toolkit/schema/projections/sceneVisionRevisions'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * ADR 0033 backfill: strips every Session key from Campaign-owned play rows. The schema is widened
 * only while these run on a deployment; the committed schema is already narrow.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

type JsonObject = Record<string, unknown>

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonObject(json: string) {
  const value: unknown = JSON.parse(json)
  if (!isJsonObject(value)) throw new Error('Stored play JSON is not an object.')
  return value
}

function withoutSessionId({ sessionId: _sessionId, ...value }: JsonObject) {
  return value
}

/** Returns the Session-free command result, or null when the stored result is already current. */
function migrateCommandResult(resultJson: string) {
  const result = parseJsonObject(resultJson)
  if (!isJsonObject(result.projection) || !('sessionId' in result.projection)) return null
  const next = encounterCommandResultDtoSchema.parse({
    ...result,
    projection: withoutSessionId(result.projection)
  })
  return { resultJson: JSON.stringify(next), resultChecksum: checksumCanonicalJson(next) }
}

/** Returns the presentation-fenced fog input, or null when the stored input is already current. */
function migrateFogInput(input: JsonObject) {
  if (!('session' in input)) return null
  const { session, ...current } = input
  if (!isJsonObject(session) || typeof session.expectedPresentationVersion !== 'number')
    throw new Error('Stored fog Session fence is invalid.')
  const next = sceneFogPatchInputSchema.parse({
    ...current,
    presentation: { expectedPresentationVersion: session.expectedPresentationVersion }
  })
  return { input: next, inputChecksum: checksumCanonicalJson(next) }
}

// Session-keyed authorities belong to retired Session-named rooms; the Campaign room reclaims.
export const liveAuthorities = migrations.define({
  table: 'campaignLiveAuthorities',
  migrateOne: async (ctx, authority) => {
    if ('sessionId' in authority) await ctx.db.delete(authority._id)
  }
})

export const deletionJobs = migrations.define({
  table: 'campaignDeletionJobs',
  migrateOne: async (ctx, job) => {
    if (job.liveAuthority && 'sessionId' in job.liveAuthority)
      await ctx.db.patch(job._id, { liveAuthority: { epoch: job.liveAuthority.epoch } })
  }
})

// Keeps each Campaign's most recently updated presentation and restores its active map.
export const presentations = migrations.define({
  table: 'campaignScenePresentations',
  migrateOne: async (ctx, presentation) => {
    if (!('sessionId' in presentation)) return
    const rows = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', presentation.campaignId))
      .collect()
    const latest = rows.reduce((current, row) =>
      row.updatedAt > current.updatedAt ||
      (row.updatedAt === current.updatedAt && row._creationTime > current._creationTime)
        ? row
        : current
    )
    if (latest._id !== presentation._id) {
      await ctx.db.delete(presentation._id)
      return
    }
    const sceneId = presentation.sceneId
    const scene =
      sceneId === null
        ? null
        : await ctx.db
            .query('campaignScenes')
            .withIndex('by_publicId', (q) => q.eq('id', sceneId))
            .unique()
    const { _id, _creationTime, ...stored } = presentation
    await ctx.db.replace(
      presentation._id,
      sceneStoredPresentationSchema.parse({
        ...withoutSessionId(stored),
        activeMapAssetId: scene ? scene.map.assetId.toLowerCase() : stored.activeMapAssetId
      })
    )
  }
})

// Former Session markers are disposable; PLAY markers are created by the next play write.
export const visionRevisions = migrations.define({
  table: 'sceneVisionRevisions',
  migrateOne: async (ctx, revision) => {
    if (!sceneVisionRevisionSchema.shape.scope.safeParse(revision.scope).success)
      await ctx.db.delete(revision._id)
  }
})

export const encounterRuns = migrations.define({
  table: 'encounterRuns',
  // Run state and projections can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, run) => {
    if (!('sessionId' in run)) return
    const state = encounterRunStateSchema.parse(withoutSessionId(parseJsonObject(run.stateJson)))
    const projection = encounterGmProjectionDtoSchema.parse(
      withoutSessionId(parseJsonObject(run.projectionJson))
    )
    const { _id, _creationTime, ...stored } = run
    await ctx.db.replace(
      run._id,
      encounterStoredRunSchema.parse({
        ...withoutSessionId(stored),
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state),
        projectionJson: JSON.stringify(projection),
        projectionChecksum: checksumCanonicalJson(projection)
      })
    )
  }
})

export const encounterRunCommands = migrations.define({
  table: 'encounterRunCommands',
  batchSize: 1,
  migrateOne: async (ctx, command) => {
    if (command.commandType === 'CREATE') return
    const result = migrateCommandResult(command.resultJson)
    if (result) await ctx.db.patch(command._id, result)
  }
})

export const encounterRuleReceipts = migrations.define({
  table: 'encounterRuleReceipts',
  batchSize: 1,
  migrateOne: async (ctx, receipt) => {
    const metadata = parseJsonObject(receipt.commandMetadataJson)
    const commandResult = metadata.commandResult
    if (!isJsonObject(commandResult) || typeof commandResult.resultJson !== 'string') return
    const result = migrateCommandResult(commandResult.resultJson)
    if (!result) return
    const next = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
      ...metadata,
      commandResult: result
    })
    await ctx.db.patch(receipt._id, { commandMetadataJson: JSON.stringify(next) })
  }
})

export const geometrySaves = migrations.define({
  table: 'sceneGeometrySaves',
  migrateOne: async (ctx, save) => {
    const vision = save.sessionVision
    if (!vision || !('sessionId' in vision)) return
    // The former Session revision cannot prove play freshness; staged saves must recapture.
    await ctx.db.patch(save._id, {
      sessionVision: {
        campaignId: vision.campaignId,
        systemId: vision.systemId,
        sceneId: vision.sceneId,
        expectedSceneVersion: vision.expectedSceneVersion,
        expectedPresentationVersion: vision.expectedPresentationVersion,
        freshness: {
          system: vision.freshness.system,
          campaign: vision.freshness.campaign,
          play: null
        }
      }
    })
  }
})

export const fogSaves = migrations.define({
  table: 'sceneFogSaves',
  migrateOne: async (ctx, save) => {
    const fog = migrateFogInput(save.input)
    if (fog) await ctx.db.patch(save._id, fog)
  }
})

export const fogCommands = migrations.define({
  table: 'sceneLiveCommands',
  migrateOne: async (ctx, command) => {
    if (command.encoding !== 'FOG_PATCH') return
    const fog = migrateFogInput(command.input)
    if (fog) await ctx.db.patch(command._id, fog)
  }
})

export const presentationEvents = migrations.define({
  table: 'campaignEvents',
  migrateOne: async (ctx, event) => {
    if (event.type !== 'SESSION_SCENE_PRESENTATION_SET') return
    const receipt = parseJsonObject(event.payloadJson)
    if (!isJsonObject(receipt.result) || !('sessionId' in receipt.result)) return
    const next = campaignLiveScenePresentationReceiptDtoSchema.parse({
      ...receipt,
      result: { ...withoutSessionId(receipt.result), campaignId: event.campaignId }
    })
    await ctx.db.patch(event._id, { payloadJson: JSON.stringify(next) })
  }
})

export const run = migrations.runner([
  internal.campaigns.playMigrations.liveAuthorities,
  internal.campaigns.playMigrations.deletionJobs,
  internal.campaigns.playMigrations.presentations,
  internal.campaigns.playMigrations.visionRevisions,
  internal.campaigns.playMigrations.encounterRuns,
  internal.campaigns.playMigrations.encounterRunCommands,
  internal.campaigns.playMigrations.encounterRuleReceipts,
  internal.campaigns.playMigrations.geometrySaves,
  internal.campaigns.playMigrations.fogSaves,
  internal.campaigns.playMigrations.fogCommands,
  internal.campaigns.playMigrations.presentationEvents
])
