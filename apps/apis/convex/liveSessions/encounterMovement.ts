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
import { liveSessionMovementAnswerInputSchema } from '@artificer-toolkit/schema/api/liveSessionMovementAnswer'
import { movementDecisionSubject } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

import type { LiveSessionBootstrapInput } from '@artificer-toolkit/schema/api/liveSessionState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  type SceneGeometryBeginResult,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { MutationCtx } from '../_generated/server'
import { internalMutation, memoizedInternalMutation } from '../lib/mutations'
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
import { captureBundleChecksum, readEncounterCaptureBundle } from './encounterCaptureBundle'
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

type LiveMember = Pick<
  LiveSessionMovementStageInput,
  'campaignId' | 'authorityEpoch' | 'expectedUserId' | 'expectedRole'
>

/**
 * Begins a room Scene commit and observes the room's Scene vision on its save: a token move or
 * door change, a movement decision's answer, or a GM void, which stages the decision's decline
 * (D26) and returns it as the staged answer.
 */
async function beginLiveSceneStage(
  ctx: MutationCtx,
  input: LiveMember &
    Pick<LiveSessionMovementStageInput, 'command' | 'presentation' | 'characterRevisions'>
): Promise<
  | { kind: 'REPLAY' }
  | {
      kind: 'STAGED'
      begun: Extract<SceneGeometryBeginResult, { kind: 'READY' }>
      saveId: string
      answer: ResolveRuleOccurrenceInputDto | null
    }
> {
  const { command, presentation, characterRevisions, ...member } = input
  await requireLiveMember(ctx, member)
  const authority = { campaignId: member.campaignId, epoch: member.authorityEpoch }
  let answer: ResolveRuleOccurrenceInputDto | null = null
  let begun: SceneGeometryBeginResult
  if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
    answer =
      command.type === 'VOID_RULE_OCCURRENCE'
        ? await readRuleOccurrenceVoidDecline(ctx, command)
        : command
    const resolution = await beginMovementResolution(ctx, answer, authority)
    if (!resolution) throw new Error('Live movement response requires a movement occurrence.')
    begun = resolution
  } else {
    if (!presentation) throw new Error('Live movement requires a presentation context.')
    begun = await beginSceneGeometry(
      ctx,
      { input: command, presentation },
      undefined,
      true,
      authority
    )
  }
  if (begun.kind !== 'READY') return { kind: 'REPLAY' }
  await requireLiveSave(ctx, { ...member, saveId: begun.saveId })
  const { saveId } = await observeSceneGeometry(ctx, { saveId: begun.saveId, characterRevisions })
  return { kind: 'STAGED', begun, saveId, answer }
}

/**
 * Stages a room Scene commit in one transaction (D52): routes a decision (another planner's
 * occurrence stages nothing), begins the save, observes the room's Scene vision and, for an
 * Encounter-bound move or answer, reads the planner's capture bundle: a move under its staged save,
 * an answer under its issued decision (D64). The room plans any rules in the DO before its atomic
 * commit; nothing here changes gameplay or authority. The stage and the commit each serve their
 * repeated reads once (`memoizedInternalMutation`).
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const stage = memoizedInternalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<LiveSessionMovementStage> => {
    const { tokenOrdinals, maintenanceDefinitionIds, cachedSystem, ...input } =
      liveSessionMovementStageInputSchema.parse(args)
    const { command, campaignId, authorityEpoch, expectedUserId, expectedRole } = input
    const member = { campaignId, authorityEpoch, expectedUserId, expectedRole }
    if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
      const route = await routeEncounterDecision(ctx, { ...member, command })
      if (route.route !== 'MOVEMENT') return { kind: 'ROUTED', route }
    }
    const staged = await beginLiveSceneStage(ctx, input)
    if (staged.kind !== 'STAGED') return staged
    const { begun, saveId, answer } = staged
    const move = begun.input
    if (
      move.type !== 'MOVE_SCENE_TOKEN' ||
      move.expectedEncounterVersion === null ||
      !begun.encounterId
    )
      return { ...staged, capture: null }
    const movement = {
      encounterId: begun.encounterId,
      baseTokenOrdinal:
        tokenOrdinals.find((entry) => entry.tokenId === move.tokenId)?.baseOrdinal ?? null,
      subject: answer ? movementDecisionSubject(answer) : { kind: 'SAVE' as const, saveId }
    }
    const bundle = await readEncounterCaptureBundle(ctx, {
      ...member,
      encounterId: begun.encounterId,
      expectedVersion: move.expectedEncounterVersion,
      movement,
      request: { kind: 'MOVEMENT_INPUTS' },
      maintenanceDefinitionIds,
      cachedSystem
    })
    return { ...staged, capture: { movement, bundle } }
  }
})

/**
 * Answers a held movement decision in one transaction from the room's plan on its prefetched
 * bundle (D64): routes the answer, rereads the prefetched bundle under the same scope and refuses
 * the answer unless every read checksum is unchanged, begins and observes the save as the stage
 * does, then commits exactly as `commit` does, advancing the room's authority (D27). Refused after
 * `expiresAt`, so a resolve can abandon it safely.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const answer = memoizedInternalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<LiveSessionMovementCommitResponse> => {
    const { command, characterRevisions, prefetch, plan, expiresAt, ...member } =
      liveSessionMovementAnswerInputSchema.parse(args)
    if (Date.now() > expiresAt) throw new Error('Live movement answer expired.')
    const route = await routeEncounterDecision(ctx, { ...member, command })
    if (route.route !== 'MOVEMENT')
      throw new Error('The decision is no longer a movement decision.')
    const { movement } = prefetch
    if (
      movement.encounterId !== command.encounterId.toLowerCase() ||
      checksumCanonicalJson(movement.subject) !==
        checksumCanonicalJson(movementDecisionSubject(command))
    )
      throw new Error('The prefetched movement inputs belong to another answer.')
    const bundle = await readEncounterCaptureBundle(ctx, {
      ...member,
      encounterId: movement.encounterId,
      expectedVersion: command.expectedVersion,
      movement,
      request: { kind: 'MOVEMENT_INPUTS' },
      maintenanceDefinitionIds: prefetch.maintenanceDefinitionIds,
      cachedSystem: null
    })
    if (captureBundleChecksum(bundle) !== prefetch.checksum)
      throw new Error('The prefetched movement inputs changed.')
    const staged = await beginLiveSceneStage(ctx, { ...member, command, characterRevisions })
    if (staged.kind !== 'STAGED') throw new Error('The movement answer was already published.')
    const { saveId } = staged
    return commitLiveMovement(ctx, {
      ...member,
      ...plan,
      movement: {
        encounterId: movement.encounterId,
        baseTokenOrdinal: movement.baseTokenOrdinal,
        subject: { kind: 'SAVE', saveId }
      },
      finish: { ...plan.finish, saveId }
    })
  }
})
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = memoizedInternalMutation({
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
