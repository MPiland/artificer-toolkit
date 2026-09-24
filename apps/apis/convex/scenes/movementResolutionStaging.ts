import { z } from 'zod'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import {
  sceneGeometryBeginResultSchema,
  sceneGeometryExecuteInputSchema,
  type SceneGeometryBeginResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation } from '../lib/mutations'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireUnusedEvidenceCommandId } from '../encounters/timelineEntries'
import { beginSceneGeometry } from './geometryStaging'
import { parseGeometrySave, readMovementResolution } from './geometryDocuments'
import { readMovementResponseAuthority } from './movementResolutionDocuments'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { readPresentedVisionScene } from './sessionVisionDocuments'

/** Null selects the existing non-spatial response mutation; only the server classifies the occurrence. */
export const begin = internalMutation({
  args: zodToConvexFields(resolveRuleOccurrenceInputDtoSchema.shape),
  returns: zodToConvex(z.nullable(sceneGeometryBeginResultSchema)),

  handler: (ctx, args) => beginMovementResolution(ctx, args)
})

/** Native and live-authority responses share the same issued-decision and receipt checks. */
export async function beginMovementResolution(
  ctx: MutationCtx,
  args: z.input<typeof resolveRuleOccurrenceInputDtoSchema>,
  liveAuthority?: Parameters<typeof beginSceneGeometry>[4]
): Promise<SceneGeometryBeginResult | null> {
  const command = resolveRuleOccurrenceInputDtoSchema.parse(args)
  const { userId } = await requireIdentity(ctx)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign } = await requireCampaignAuthority(ctx, run.campaignId, userId)
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', command.occurrenceId))
    .unique()
  if (!occurrence || occurrence.encounterId !== run.id || occurrence.campaignId !== campaign.id)
    throw new Error('Rule occurrence is unavailable.')
  const receipt = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (q) =>
      q.eq('encounterId', run.id).eq('commandId', command.commandId)
    )
    .unique()
  const metadata = receipt
    ? serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
        JSON.parse(receipt.commandMetadataJson)
      )
    : null
  const snapshot = occurrence.pendingSnapshotJson
    ? serverRuleExecutionPendingSnapshotDtoSchema.parse(JSON.parse(occurrence.pendingSnapshotJson))
    : null
  const context = snapshot?.applicationContext
  const pending =
    snapshot &&
    (context?.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
      context?.kind === 'ENCOUNTER_MOVEMENT_REACTION' ||
      context?.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' ||
      (context?.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' && context.movementContinuation))
      ? readEncounterMovementPendingContext(snapshot)
      : null
  const sceneId =
    metadata?.transition === 'SPATIAL_MOVEMENT' ? metadata.sceneId : (pending?.root.sceneId ?? null)
  if (!sceneId) return null
  const priorRow = await ctx.db
    .query('sceneGeometrySaves')
    .withIndex('by_sceneId_commandId', (q) =>
      q.eq('sceneId', sceneId).eq('commandId', command.commandId)
    )
    .unique()
  if (priorRow) {
    const save = parseGeometrySave(priorRow)
    const resolution = readMovementResolution(save)
    if (
      !resolution ||
      save.actorUserId !== userId ||
      checksumCanonicalJson(command) !== save.movementResolution!.commandChecksum ||
      !save.sessionVision
    )
      throw new Error('Movement response command ID was already used.')
    if (save.status !== 'PUBLISHED') await readMovementResponseAuthority(ctx, command)
    return beginSceneGeometry(
      ctx,
      {
        input: save.input,
        presentation: {
          expectedPresentationVersion: save.sessionVision.expectedPresentationVersion
        }
      },
      save.movementResolution,
      true,
      liveAuthority
    )
  }
  if (receipt) throw new Error('Movement response receipt has no Scene publication.')
  const current = await readMovementResponseAuthority(ctx, command)
  await requireUnusedEvidenceCommandId(ctx, campaign.id, command.commandId)
  const { presentation } = await readPresentedVisionScene(ctx, {
    campaignId: campaign.id,
    sceneId
  })
  const root = current.root
  return beginSceneGeometry(
    ctx,
    sceneGeometryExecuteInputSchema.parse({
      input: {
        type: 'MOVE_SCENE_TOKEN',
        commandId: command.commandId,
        sceneId,
        tokenId: root.tokenId,
        expectedSceneVersion: root.currentSceneVersion,
        expectedEncounterVersion: command.expectedVersion,
        correlationId: command.correlationId,
        movementKind: root.movementKind,
        path: root.originalPath
      },
      presentation: { expectedPresentationVersion: presentation.version }
    }),
    {
      commandJson: JSON.stringify(command),
      commandChecksum: checksumCanonicalJson(command),
      pendingSnapshotJson: current.occurrence.pendingSnapshotJson!,
      pendingSnapshotChecksum: current.occurrence.pendingSnapshotChecksum!
    },
    true,
    liveAuthority
  )
}
