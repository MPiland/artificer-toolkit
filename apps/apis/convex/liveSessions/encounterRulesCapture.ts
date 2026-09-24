import { zodToConvex } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import { requireSession } from '../campaigns/sessionDocuments'
import { loadCharacterState } from '../characters/stateDocuments'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { readSystemVocabularySnapshot } from '../content/systemVocabulary'
import { readRunActor, readRunState } from '../encounters/documents'
import { readEncounterInitiativeRound } from '../encounters/initiativeStore'
import { readEncounterCleavingBindings } from '../encounters/cleavingSceneInputs'
import { readNativeEncounterActionAdmission } from '../encounters/actionAdmission'
import { readNativeEncounterActionResponseAdmission } from '../encounters/actionResumeAdmission'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { requireIdentity } from '../lib/identity'
import { readCharacterEffect, readEncounterEffect } from '../rules/effectStore'
import { requireCampaignLiveAuthority } from './authorityGuard'
import { readLiveSessionRulesRevisions } from './rulesRevisions'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { readEncounterTurnCapture } from './encounterTurnCapture'
import { readLiveConcentrationResponseAdmission } from './concentrationResponseAdmission'
import { readLiveEncounterTurnAdmission } from './encounterTurnAdmission'
import { readLiveMovementAdmission } from './encounterMovementAdmission'

type SemanticResponse = {
  [K in LiveSessionEncounterRulesResponse['kind']]: Omit<
    Extract<LiveSessionEncounterRulesResponse, { kind: K }>,
    'readChecksum' | 'revisions'
  >
}[LiveSessionEncounterRulesResponse['kind']]

/** Raw stored inputs only; the Session DO owns Encounter rule evaluation. */
export async function readEncounterRulesCapture(
  ctx: QueryCtx,
  args: LiveSessionEncounterRulesInput
): Promise<LiveSessionEncounterRulesResponse> {
  const input = liveSessionEncounterRulesInputSchema.parse(args)
  if (
    (input.movement && input.concentrationResponse) ||
    (input.turnResponse && (input.movement || input.concentrationResponse))
  )
    throw new Error('Live Session capture scopes cannot be combined.')
  if (input.request.kind === 'TURN_COMMAND') {
    if (input.movement) throw new Error('Turn commands cannot use movement capture scope.')
    const admission = await readLiveEncounterTurnAdmission(ctx, input, input.request.command)
    const response = {
      kind: 'TURN_COMMAND' as const,
      campaignOwnerUserId: admission.campaign.ownerUserId,
      command: admission.input,
      fingerprint: admission.fingerprint,
      occurrenceVersion: admission.pending?.occurrence.version ?? null,
      snapshot: admission.pending?.snapshot ?? null,
      result: admission.result
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: await readLiveSessionRulesRevisions(ctx, {
        systemId: admission.state.gameSystemId,
        campaignId: input.campaignId,
        sessionId: input.sessionId
      }),
      readChecksum: checksumCanonicalJson({ input, userId: input.expectedUserId, response })
    })
  }
  const turnRequest =
    input.request.kind === 'MAINTENANCE_STATE' ||
    input.request.kind === 'SCENE_PERCEPTION' ||
    input.request.kind === 'SCENE_PERCEPTION_ENTITIES' ||
    input.request.kind === 'SCENE_SPATIAL_EFFECTS'
  if (
    turnRequest &&
    !input.movement &&
    ((input.expectedRole !== 'OWNER' && !input.turnResponse) || input.concentrationResponse)
  )
    throw new Error('Turn capture requires owner or admitted response scope.')
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  if (
    (input.concentrationResponse || input.movement || input.turnResponse) &&
    (input.request.kind === 'ACTION_COMMAND' || input.request.kind === 'ACTION_RESPONSE')
  )
    throw new Error('Ordinary action capture cannot use another command scope.')
  const movementAdmission = input.movement
    ? await readLiveMovementAdmission(ctx, { ...input, movement: input.movement })
    : null
  if (
    movementAdmission &&
    (movementAdmission.state.id !== input.encounterId ||
      movementAdmission.state.version !== input.expectedVersion)
  )
    throw new Error('Live movement Encounter scope or version mismatch.')
  const concentrationAdmission = input.concentrationResponse
    ? await readLiveConcentrationResponseAdmission(ctx, {
        ...input,
        concentrationResponse: input.concentrationResponse
      })
    : null
  const turnAdmission = input.turnResponse
    ? await readLiveEncounterTurnAdmission(ctx, input, input.turnResponse)
    : null
  if (
    turnAdmission &&
    (turnAdmission.kind !== 'READY' ||
      turnAdmission.state.id !== input.encounterId ||
      turnAdmission.state.version !== input.expectedVersion)
  )
    throw new Error('Live Session turn response is unavailable.')
  if (input.request.kind === 'CONCENTRATION_RESPONSE') {
    if (!concentrationAdmission) throw new Error('Concentration response is unavailable.')
    const response: SemanticResponse = {
      kind: 'CONCENTRATION_RESPONSE',
      fingerprint: concentrationAdmission.fingerprint,
      state: concentrationAdmission.state,
      projection: concentrationAdmission.projection,
      snapshot:
        concentrationAdmission.kind === 'READY' ? concentrationAdmission.pending.snapshot : null,
      parentApplications:
        concentrationAdmission.kind === 'READY' ? concentrationAdmission.parentApplications : [],
      result: concentrationAdmission.kind === 'REPLAY' ? concentrationAdmission.result : null
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: await readLiveSessionRulesRevisions(ctx, {
        systemId: concentrationAdmission.state.gameSystemId,
        campaignId: input.campaignId,
        sessionId: input.sessionId
      }),
      readChecksum: checksumCanonicalJson({ input, userId, response })
    })
  }
  if (concentrationAdmission?.kind === 'REPLAY')
    throw new Error('Completed concentration response cannot capture rules inputs.')
  if (input.request.kind === 'ACTION_COMMAND' || input.request.kind === 'ACTION_RESPONSE') {
    if (input.expectedRole !== 'OWNER') throw new Error('Live Session role mismatch.')
    const command =
      input.request.kind === 'ACTION_COMMAND' ? input.request.command : input.request.response
    if (
      command.encounterId.toLowerCase() !== input.encounterId ||
      command.expectedVersion !== input.expectedVersion
    )
      throw new Error('Live Session Encounter command scope mismatch.')
    const authority = await requireCampaignLiveAuthority(ctx, {
      campaignId: input.campaignId,
      sessionId: input.sessionId,
      epoch: input.authorityEpoch
    })
    if (authority.phase !== 'DO_ACTIVE') throw new Error('Live Session authority is not active.')
    // Stored receipts precede current-version checks and every heavy preparation read.
    let responseAdmission = null
    if (input.request.kind === 'ACTION_RESPONSE') {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
        .unique()
      if (!run) throw new Error('Encounter Run was not found.')
      responseAdmission = await readNativeEncounterActionResponseAdmission(
        ctx,
        input.request.response,
        run,
        userId
      )
      if (!responseAdmission) throw new Error('The occurrence is not an ordinary Encounter action.')
    }
    const admission =
      responseAdmission?.admission ??
      (input.request.kind === 'ACTION_COMMAND'
        ? await readNativeEncounterActionAdmission(ctx, input.request.command, userId)
        : null)
    if (!admission) throw new Error('Action response admission is unavailable.')
    if (
      admission.state.campaignId !== input.campaignId ||
      admission.state.sessionId !== input.sessionId
    )
      throw new Error('Live Session Encounter scope or version mismatch.')
    const response = {
      ...(responseAdmission
        ? {
            kind: 'ACTION_RESPONSE' as const,
            snapshot: responseAdmission.kind === 'READY' ? responseAdmission.pending.snapshot : null
          }
        : { kind: 'ACTION_COMMAND' as const }),
      command: admission.input,
      fingerprint: admission.fingerprint,
      result:
        responseAdmission?.kind === 'REPLAY'
          ? responseAdmission.result
          : admission.kind === 'REPLAY'
            ? admission.result
            : null
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: await readLiveSessionRulesRevisions(ctx, {
        systemId: admission.state.gameSystemId,
        campaignId: input.campaignId,
        sessionId: input.sessionId
      }),
      readChecksum: checksumCanonicalJson({ input, userId, response })
    })
  }
  const { campaign, membership } =
    movementAdmission ?? (await requireCampaignAuthority(ctx, input.campaignId, userId))
  if (
    membership.role !== input.expectedRole ||
    (!concentrationAdmission && !movementAdmission && !turnAdmission && membership.role !== 'OWNER')
  )
    throw new Error('Live Session role mismatch.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (!movementAdmission) {
    const authority = await requireCampaignLiveAuthority(ctx, {
      campaignId: campaign.id,
      sessionId: input.sessionId,
      epoch: input.authorityEpoch
    })
    if (authority.phase !== 'DO_ACTIVE') throw new Error('Live Session authority is not active.')
  }
  const session =
    movementAdmission?.session ?? (await requireSession(ctx, campaign.id, input.sessionId))
  if (session.status !== 'OPEN') throw new Error('Live Session is not open.')
  const run = movementAdmission
    ? null
    : await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
        .unique()
  if (!movementAdmission && !run) throw new Error('Encounter Run was not found.')
  const state = movementAdmission?.state ?? readRunState(run!)
  if (
    state.id !== input.encounterId ||
    state.campaignId !== campaign.id ||
    state.sessionId !== session.id ||
    state.gameSystemId !== campaign.gameSystemId ||
    state.version !== input.expectedVersion
  )
    throw new Error('Live Session Encounter scope or version mismatch.')

  let response: SemanticResponse
  let characterId: string | undefined
  if (input.request.kind === 'MOVEMENT_INPUTS') {
    if (!movementAdmission) throw new Error('Movement capture scope is required.')
    response = {
      kind: 'MOVEMENT_INPUTS',
      campaignOwnerUserId: campaign.ownerUserId,
      save: movementAdmission.save,
      header: movementAdmission.header,
      bindings: await readEncounterCleavingBindings(ctx, state, movementAdmission.header.id)
    }
  } else if (input.request.kind === 'INPUTS') {
    response = { kind: 'INPUTS', state, system: await requireSystem(ctx, state.gameSystemId) }
  } else if (input.request.kind === 'CLEAVING_BINDINGS') {
    response = {
      kind: 'CLEAVING_BINDINGS',
      bindings: await readEncounterCleavingBindings(ctx, state)
    }
  } else if (input.request.kind === 'INITIATIVE_ROUND') {
    response = {
      kind: 'INITIATIVE_ROUND',
      state:
        state.status === 'ACTIVE'
          ? await readEncounterInitiativeRound(ctx, { encounterId: state.id, round: state.round })
          : null
    }
  } else if (input.request.kind === 'SYSTEM_VOCABULARY') {
    const snapshot = await readSystemVocabularySnapshot(
      ctx,
      await requireSystem(ctx, state.gameSystemId)
    )
    if (!snapshot) throw new Error('Encounter System vocabulary snapshot is unavailable.')
    response = { kind: 'SYSTEM_VOCABULARY', snapshot }
  } else if (input.request.kind === 'ACTION_SCENE') {
    const { command } = input.request
    const actorId = command.actorId.toLowerCase()
    const targetActorId = command.targetActorId.toLowerCase()
    if (!state.actorIds.includes(actorId) || !state.actorIds.includes(targetActorId))
      throw new Error('Action Scene actor is not in the Encounter.')
    response = {
      kind: 'ACTION_SCENE',
      context: await readNativeActionSceneInputs(
        ctx,
        state,
        {
          actorId,
          targetActorId,
          sceneContext: command.sceneContext
            ? {
                ...command.sceneContext,
                sceneId: command.sceneContext.sceneId.toLowerCase(),
                sourceTokenId: command.sceneContext.sourceTokenId.toLowerCase(),
                targetTokenId: command.sceneContext.targetTokenId.toLowerCase()
              }
            : null
        },
        membership.role === 'PLAYER' ? 'MEMBER' : 'OWNER'
      )
    }
  } else if (
    input.request.kind === 'MAINTENANCE_SLOT' ||
    input.request.kind === 'MAINTENANCE_DEPENDENTS' ||
    input.request.kind === 'MAINTENANCE_OWNER' ||
    input.request.kind === 'MAINTENANCE_OWNER_EFFECTS'
  ) {
    response = await readEncounterMaintenanceCapture(ctx, state, input.request)
    if ('owner' in input.request && input.request.owner.kind === 'CHARACTER')
      characterId = input.request.owner.characterId
  } else if (
    input.request.kind === 'MAINTENANCE_STATE' ||
    input.request.kind === 'SCENE_PERCEPTION' ||
    input.request.kind === 'SCENE_PERCEPTION_ENTITIES' ||
    input.request.kind === 'SCENE_SPATIAL_EFFECTS'
  ) {
    response = await readEncounterTurnCapture(ctx, state, input.request)
  } else if (input.request.kind === 'DEFINITION') {
    const root = await readDefinitionRoot(ctx, input.request.definitionId, userId)
    if (root && root.gameSystemId !== state.gameSystemId)
      throw new Error('Reusable definition System mismatch.')
    response = { kind: 'DEFINITION', definition: root?.current ?? null }
  } else {
    const actor = await readRunActor(ctx, state, input.request.actorId)
    if (actor.kind === 'CHARACTER') {
      if (!actor.sourceId || actor.sourceRevision === null)
        throw new Error('Encounter Character actor is stale.')
      characterId = actor.sourceId
      const { assignment } = await requireCampaignCharacterAuthority(
        ctx,
        campaign.id,
        actor.sourceId,
        concentrationAdmission || movementAdmission || turnAdmission ? campaign.ownerUserId : userId
      )
      const { active, draft } = await loadCharacterState(ctx, actor.sourceId)
      if (
        !active ||
        active.userId !== assignment.userId ||
        active.systemId !== state.gameSystemId ||
        active.status !== 'ACTIVE' ||
        (draft && draft.userId !== active.userId)
      )
        throw new Error('Encounter Character actor identity is stale.')
      // This reads stored Run snapshots/effects, not current Sheet mechanics. The selected
      // source/target character-rules capture checks expectedStreamVersion before preparing facts.
    }
    const after = input.request.kind === 'ACTOR' ? null : input.request.afterEffectId
    let effects: Extract<LiveSessionEncounterRulesResponse, { kind: 'EFFECTS' }>['effects']
    if (actor.kind === 'CHARACTER') {
      const characterId = actor.sourceId
      if (!characterId) throw new Error('Encounter Character actor is stale.')
      const rows = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) =>
          after === null
            ? q.eq('characterId', characterId)
            : q.eq('characterId', characterId).gt('id', after)
        )
        .take(4)
      effects = rows.map(readCharacterEffect)
    } else {
      const rows = await ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_id', (q) =>
          after === null
            ? q.eq('encounterId', state.id).eq('targetActorId', actor.id)
            : q.eq('encounterId', state.id).eq('targetActorId', actor.id).gt('id', after)
        )
        .take(4)
      effects = rows.map(readEncounterEffect)
    }
    const continueAfter = effects.length === 4 ? effects[3]!.id : null
    response =
      input.request.kind === 'ACTOR'
        ? { kind: 'ACTOR', actor, effects, continueAfter }
        : { kind: 'EFFECTS', actorId: actor.id, effects, continueAfter }
  }
  return liveSessionEncounterRulesResponseSchema.parse({
    ...response,
    revisions: await readLiveSessionRulesRevisions(ctx, {
      systemId: state.gameSystemId,
      campaignId: campaign.id,
      sessionId: session.id,
      characterId
    }),
    readChecksum: checksumCanonicalJson({ input, userId, response })
  })
}

export const capture = internalQuery({
  args: zodToConvex<z.core.$ZodType<LiveSessionEncounterRulesInput>>(
    liveSessionEncounterRulesInputSchema
  ),
  returns: zodToConvex<z.core.$ZodType<LiveSessionEncounterRulesResponse>>(
    liveSessionEncounterRulesResponseSchema
  ),
  handler: readEncounterRulesCapture
})
