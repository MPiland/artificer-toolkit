import { v } from 'convex/values'
import {
  liveSessionSceneGeometryCommitInputSchema,
  type LiveSessionMovementCommitResponse
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import {
  liveSessionMovementStageInputSchema,
  type LiveSessionMovementStage,
  type LiveSessionMovementStageInput
} from '@artificer-toolkit/schema/api/liveSessionMovementStage'
import type { LiveSessionBootstrapInput } from '@artificer-toolkit/schema/api/liveSessionState'
import {
  type SceneGeometryBeginResult,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { readRuleOccurrenceVoidDecline } from '../encounters/occurrenceVoid'
import { finishSceneGeometry } from '../scenes/geometryCommands'
import { readGeometrySave } from '../scenes/geometryDocuments'
import {
  beginSceneGeometry,
  observeSceneGeometry,
  stageSceneGeometryFog
} from '../scenes/geometryStaging'
import { beginMovementResolution } from '../scenes/movementResolutionStaging'
import { requireLiveMember } from './liveMember'
import { readEncounterCaptureBundle } from './encounterCaptureBundle'
import { routeEncounterDecision } from './encounterRoute'
import { commitLiveMovement } from './encounterMovementCommit'
import { publishWithAuthorityAdvance } from './externalCommit'

/** The member's own receiving room save in this Campaign. */
async function requireLiveSave(
  ctx: MutationCtx,
  input: LiveSessionBootstrapInput & { saveId: string }
) {
  const userId = await requireLiveMember(ctx, input)
  const current = await readGeometrySave(ctx, input.saveId)
  if (current.campaign.id !== input.campaignId.toLowerCase() || current.save.actorUserId !== userId)
    throw new Error('Live Scene save scope mismatch.')
  return current
}

/**
 * Begins a room Scene commit: a token move or door change, a movement decision's answer, or a GM
 * void, which declines the decision (D26).
 */
async function beginLiveSceneCommand(
  ctx: MutationCtx,
  input: Omit<
    LiveSessionMovementStageInput,
    'characterRevisions' | 'tokenOrdinals' | 'maintenanceDefinitionIds'
  >
): Promise<SceneGeometryBeginResult> {
  const authority = { campaignId: input.campaignId, epoch: input.authorityEpoch }
  if (
    input.command.type === 'RESOLVE_RULE_OCCURRENCE' ||
    input.command.type === 'VOID_RULE_OCCURRENCE'
  ) {
    const command =
      input.command.type === 'VOID_RULE_OCCURRENCE'
        ? await readRuleOccurrenceVoidDecline(ctx, input.command)
        : input.command
    const result = await beginMovementResolution(ctx, command, authority)
    if (!result) throw new Error('Live movement response requires a movement occurrence.')
    return result
  }
  if (!input.presentation) throw new Error('Live movement requires a presentation context.')
  return beginSceneGeometry(
    ctx,
    { input: input.command, presentation: input.presentation },
    undefined,
    true,
    authority
  )
}

/**
 * Stages a room Scene commit in one transaction (D52): routes a decision (another planner's
 * occurrence stages nothing), begins the save, observes the room's Scene vision and, for an
 * Encounter-bound move, reads the planner's capture bundle under the staged save. The room plans any
 * rules in the DO before its atomic commit; nothing here changes gameplay or authority.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const stage = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<LiveSessionMovementStage> => {
    const { characterRevisions, tokenOrdinals, maintenanceDefinitionIds, ...input } =
      liveSessionMovementStageInputSchema.parse(args)
    const { command, campaignId, authorityEpoch, expectedUserId, expectedRole } = input
    const member = { campaignId, authorityEpoch, expectedUserId, expectedRole }
    if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
      const route = await routeEncounterDecision(ctx, { ...member, command })
      if (route.route !== 'MOVEMENT') return { kind: 'ROUTED', route }
    }
    await requireLiveMember(ctx, member)
    const begun = await beginLiveSceneCommand(ctx, input)
    if (begun.kind !== 'READY') return { kind: 'REPLAY' }
    await requireLiveSave(ctx, { ...member, saveId: begun.saveId })
    const { saveId } = await observeSceneGeometry(ctx, { saveId: begun.saveId, characterRevisions })
    const staged = begun.input
    if (
      staged.type !== 'MOVE_SCENE_TOKEN' ||
      staged.expectedEncounterVersion === null ||
      !begun.encounterId
    )
      return { kind: 'STAGED', begun, saveId, capture: null }
    const movement = {
      encounterId: begun.encounterId,
      saveId,
      baseTokenOrdinal:
        tokenOrdinals.find((entry) => entry.tokenId === staged.tokenId)?.baseOrdinal ?? null
    }
    const bundle = await readEncounterCaptureBundle(ctx, {
      ...member,
      encounterId: begun.encounterId,
      expectedVersion: staged.expectedEncounterVersion,
      movement,
      request: { kind: 'MOVEMENT_INPUTS' },
      maintenanceDefinitionIds
    })
    return { kind: 'STAGED', begun, saveId, capture: { movement, bundle } }
  }
})
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<LiveSessionMovementCommitResponse> =>
    commitLiveMovement(ctx, args)
})

/** Commits a room Scene change that carries no Encounter rules, advancing the room's sequence. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commitScene = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<SceneGeometryCommandResult> => {
    const input = liveSessionSceneGeometryCommitInputSchema.parse(args)
    const { saveId } = input.finish
    const current = await requireLiveSave(ctx, { ...input, saveId })
    const { input: command } = current.save
    if (command.type === 'MOVE_SCENE_TOKEN' && command.expectedEncounterVersion !== null)
      throw new Error('Encounter-bound movement commits through its rules.')
    // Fog layers stage in this transaction; a retry of a published save publishes nothing again.
    const staging = current.save.status === 'PUBLISHED' ? [] : input.fogLayers
    for (const layer of staging) await stageSceneGeometryFog(ctx, { saveId, layer })
    return publishWithAuthorityAdvance(ctx, input, () =>
      finishSceneGeometry(ctx, input.finish, staging.length ? undefined : current)
    )
  }
})
