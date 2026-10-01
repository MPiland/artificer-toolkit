import { readReceiptHeader } from '../lib/receiptLedgers'
import { encounterReadTransaction } from '../encounters/encounterPorts'
import { z } from 'zod'
import { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import {
  sceneGeometryExecuteInputSchema,
  type SceneGeometryBeginResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireUnusedEvidenceCommandId } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { isEncounterMovementContext } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { beginSceneGeometry } from './geometryStaging'
import {
  parseGeometrySave,
  readMovementResolution
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { readMovementResponseAuthority } from './movementResolutionDocuments'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { readPresentedVisionScene } from './sessionVisionDocuments'

/** Stages the room's movement decision on its Scene after the issued-decision and receipt checks. */
export async function beginMovementResolution(
  ctx: MutationCtx,
  args: z.input<typeof resolveRuleOccurrenceInputDtoSchema>,
  liveAuthority: NonNullable<Parameters<typeof beginSceneGeometry>[4]>
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
  const receiptHeader = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_commandId', (q) =>
      q.eq('encounterId', run.id).eq('commandId', command.commandId)
    )
    .unique()
  const receipt = receiptHeader
    ? await readReceiptHeader(ctx, 'encounterRuleReceipts', receiptHeader)
    : null
  const metadata = receipt
    ? serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
        JSON.parse(receipt.commandMetadataJson)
      )
    : null
  const snapshot = await readPendingSnapshot(encounterReadTransaction(ctx), occurrence)
  const context = snapshot?.applicationContext
  const pending =
    snapshot && isEncounterMovementContext(context)
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
  await requireUnusedEvidenceCommandId(
    encounterReadTransaction(ctx),
    campaign.id,
    command.commandId
  )
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
      pendingSnapshotJson: JSON.stringify(current.snapshot),
      pendingSnapshotChecksum: current.occurrence.pendingSnapshotChecksum!
    },
    true,
    liveAuthority
  )
}
