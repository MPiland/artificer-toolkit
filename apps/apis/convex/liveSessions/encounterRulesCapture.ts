import { v } from 'convex/values'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import { loadCharacterState } from '../characters/stateDocuments'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { readSystemVocabularySnapshot } from '../content/systemVocabulary'
import { readRunActor, readRunActors, readRunState } from '../encounters/documents'
import { readEncounterInitiativeRound } from '../encounters/initiativeStore'
import { readEncounterCleavingBindings } from '../encounters/cleavingSceneInputs'
import { readNativeEncounterActionAdmission } from '../encounters/actionAdmission'
import { readNativeEncounterActionResponseAdmission } from '../encounters/actionResumeAdmission'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { requireIdentity } from '../lib/identity'
import { readAutoRollDice } from '../lib/rollPreferences'
import { readCharacterEffect, readEncounterEffect } from '../rules/effectStore'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { readLiveSessionRulesRevisions } from './rulesRevisions'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { readEncounterTurnCapture } from './encounterTurnCapture'
import { readLiveConcentrationResponseAdmission } from './concentrationResponseAdmission'
import { readLiveEncounterTurnAdmission } from './encounterTurnAdmission'
import { readLiveMovementAdmission } from './encounterMovementAdmission'
import { rejectDomain } from '../lib/domainRejections'
import {
  readEncounterAutoRollByActorId,
  readEncounterControlledActorIds
} from '../encounters/actorController'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { presentEncounterResultForMember } from '../encounters/resultPresentation'
import { readLiveEncounterActionScope } from './encounterActionAdmission'
import { readEncounterSettledAppRoll } from '../encounters/evidenceRolls'

type SemanticResponse = {
  [K in LiveSessionEncounterRulesResponse['kind']]: Omit<
    Extract<LiveSessionEncounterRulesResponse, { kind: K }>,
    'readChecksum' | 'revisions'
  >
}[LiveSessionEncounterRulesResponse['kind']]

/** Raw stored inputs only; the Session DO owns Encounter rule evaluation. */
export async function readEncounterRulesCapture(
  ctx: QueryCtx,
  args: unknown
): Promise<LiveSessionEncounterRulesResponse> {
  const input = liveSessionEncounterRulesInputSchema.parse(args)
  if (
    [input.movement, input.concentrationResponse, input.turnCommand, input.action].filter(
      (scope) => scope !== undefined
    ).length > 1
  )
    throw new Error('Live Session capture scopes cannot be combined.')
  if (input.request.kind === 'TURN_COMMAND') {
    if (input.movement) throw new Error('Turn commands cannot use movement capture scope.')
    const admission = await readLiveEncounterTurnAdmission(ctx, input, input.request.command)
    const actors = await readRunActors(ctx, admission.state)
    const response = {
      kind: 'TURN_COMMAND' as const,
      campaignOwnerUserId: admission.campaign.ownerUserId,
      autoRollDice: await readAutoRollDice(ctx, admission.campaign.ownerUserId),
      // The GM initiates every turn, so each actor's saves go to its controllers.
      autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
        campaign: admission.campaign,
        initiatorUserId: admission.campaign.ownerUserId,
        actors
      }),
      responderControlledActorIds: [
        ...(await readEncounterControlledActorIds(ctx, {
          campaign: admission.campaign,
          membership: admission.membership,
          actors
        }))
      ].sort(),
      appRoll:
        admission.resume && admission.input.type === 'RESOLVE_RULE_OCCURRENCE'
          ? await readEncounterSettledAppRoll(ctx, {
              occurrence: admission.pending.occurrence,
              response: admission.input,
              userId: input.expectedUserId
            })
          : null,
      command: admission.input,
      fingerprint: admission.fingerprint,
      occurrenceVersion: admission.pending?.occurrence.version ?? null,
      snapshot: admission.pending?.snapshot ?? null,
      result:
        admission.result &&
        (await presentEncounterResultForMember(ctx, {
          campaign: admission.campaign,
          membership: admission.membership,
          result: admission.result
        }))
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: await readLiveSessionRulesRevisions(ctx, {
        systemId: admission.state.gameSystemId,
        campaignId: input.campaignId
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
    ((input.expectedRole !== 'OWNER' && !input.turnCommand) || input.concentrationResponse)
  )
    throw new Error('Turn capture requires owner or admitted response scope.')
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  if (
    (input.concentrationResponse || input.movement || input.turnCommand) &&
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
  const turnAdmission = input.turnCommand
    ? await readLiveEncounterTurnAdmission(ctx, input, input.turnCommand)
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
      appRoll: concentrationAdmission.kind === 'READY' ? concentrationAdmission.appRoll : null,
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
        campaignId: input.campaignId
      }),
      readChecksum: checksumCanonicalJson({ input, userId, response })
    })
  }
  if (concentrationAdmission?.kind === 'REPLAY')
    throw new Error('Completed concentration response cannot capture rules inputs.')
  if (input.request.kind === 'ACTION_COMMAND' || input.request.kind === 'ACTION_RESPONSE') {
    // A player's planner carries its admitted action so the follow-up captures pass.
    if (
      input.expectedRole !== 'OWNER' &&
      checksumCanonicalJson(input.action) !== checksumCanonicalJson(input.request)
    )
      throw new Error('Live Session action scope mismatch.')
    const command =
      input.request.kind === 'ACTION_COMMAND' ? input.request.command : input.request.response
    if (
      command.encounterId.toLowerCase() !== input.encounterId ||
      command.expectedVersion !== input.expectedVersion
    )
      throw new Error('Live Session Encounter command scope mismatch.')
    await requireActiveCampaignLiveAuthority(ctx, {
      campaignId: input.campaignId,
      epoch: input.authorityEpoch
    })
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
      admission.membership.role !== input.expectedRole
    )
      throw new Error('Live Session Encounter scope or version mismatch.')
    const replay =
      responseAdmission?.kind === 'REPLAY'
        ? responseAdmission.result
        : admission.kind === 'REPLAY'
          ? admission.result
          : null
    const response = {
      ...(responseAdmission
        ? {
            kind: 'ACTION_RESPONSE' as const,
            snapshot:
              responseAdmission.kind === 'READY' ? responseAdmission.pending.snapshot : null,
            appRoll: responseAdmission.kind === 'READY' ? responseAdmission.appRoll : null
          }
        : { kind: 'ACTION_COMMAND' as const }),
      autoRollByActorId:
        admission.kind === 'READY'
          ? await readEncounterAutoRollByActorId(ctx, {
              campaign: admission.campaign,
              initiatorUserId: admission.initiatorUserId,
              actors: await readRunActors(ctx, admission.state)
            })
          : {},
      command: admission.input,
      fingerprint: admission.fingerprint,
      result:
        replay &&
        (await presentEncounterResultForMember(ctx, {
          campaign: admission.campaign,
          membership: admission.membership,
          result: replay
        }))
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: await readLiveSessionRulesRevisions(ctx, {
        systemId: admission.state.gameSystemId,
        campaignId: input.campaignId
      }),
      readChecksum: checksumCanonicalJson({ input, userId, response })
    })
  }
  const actionAdmission = input.action
    ? await readLiveEncounterActionScope(ctx, { ...input, action: input.action })
    : null
  const { campaign, membership } =
    movementAdmission ?? (await requireCampaignAuthority(ctx, input.campaignId, userId))
  const admitted = concentrationAdmission || movementAdmission || turnAdmission || actionAdmission
  if (membership.role !== input.expectedRole || (!admitted && membership.role !== 'OWNER'))
    throw new Error('Live Session role mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (!movementAdmission) {
    await requireActiveCampaignLiveAuthority(ctx, {
      campaignId: campaign.id,
      epoch: input.authorityEpoch
    })
  }

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
      autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
        campaign,
        // A response continues the mover's command; its rolls keep the mover as initiator.
        initiatorUserId: movementAdmission.save.movementResolution
          ? readEncounterMovementPendingContext(
              serverRuleExecutionPendingSnapshotDtoSchema.parse(
                JSON.parse(movementAdmission.save.movementResolution.pendingSnapshotJson)
              )
            ).root.initiatorUserId
          : movementAdmission.save.actorUserId,
        actors: await readRunActors(ctx, state)
      }),
      appRoll: movementAdmission.appRoll,
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
    // Encounter rules resolve the Campaign's definitions as its owner, for players too.
    const root = await readDefinitionRoot(ctx, input.request.definitionId, campaign.ownerUserId)
    if (root && root.gameSystemId !== state.gameSystemId)
      throw new Error('Reusable definition System mismatch.')
    response = { kind: 'DEFINITION', definition: root?.current ?? null }
  } else {
    const actor = await readRunActor(ctx, state, input.request.actorId)
    if (actor.kind === 'CHARACTER') {
      characterId = actor.sourceId
      const { assignment } = await requireCampaignCharacterAuthority(
        ctx,
        campaign.id,
        actor.sourceId,
        admitted ? campaign.ownerUserId : userId
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
      // This reads stored Run snapshots/effects, not current Sheet mechanics. The CHARACTER
      // revision captured here fences the character-rules capture and the later commit.
    }
    const after = input.request.kind === 'ACTOR' ? null : input.request.afterEffectId
    let effects: Extract<LiveSessionEncounterRulesResponse, { kind: 'EFFECTS' }>['effects']
    if (actor.kind === 'CHARACTER') {
      const characterId = actor.sourceId
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
      characterId
    }),
    readChecksum: checksumCanonicalJson({ input, userId, response })
  })
}

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const capture = internalQuery({
  args: v.any(),
  handler: readEncounterRulesCapture
})
