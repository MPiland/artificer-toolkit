import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterReadTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import {
  readRunActor,
  readRunActors,
  readRunState
} from '@artificer-toolkit/encounter-persistence/documents'
import { readLiveEncounterTurnAdmission } from '@artificer-toolkit/encounter-persistence/turnCommandAdmission'
import { readEncounterTurnCommandCapture } from '@artificer-toolkit/encounter-persistence/turnCommandCapture'
import { readEncounterTurnCapture } from '@artificer-toolkit/encounter-persistence/turnCapture'
import { readEncounterInitiativeRound } from '@artificer-toolkit/encounter-persistence/initiativeStore'
import {
  readTurnLastMove,
  readTurnMovedFeet,
  readTurnStartedBy,
  readTurnTeleportAllowances,
  readTurnUses
} from '@artificer-toolkit/encounter-persistence/turnMovement'
import {
  readCharacterEffect,
  readEncounterEffect
} from '@artificer-toolkit/encounter-persistence/effectStore'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { isDepartedCharacterActor } from '@artificer-toolkit/encounter-persistence/characterStates'
import { isCharacterDead } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomInputs } from './roomInputs.js'
import type { RoomTransaction } from './roomEncounterStore.js'
import { readRoomMaintenanceCapture } from './roomMaintenanceCapture.js'
import { readRoomSceneState } from './roomSceneRead.js'
import { readBasicActionScopeAdmission } from '@artificer-toolkit/encounter-persistence/basicActionScopeAdmission'
import { readLiveConcentrationResponseAdmission } from '@artificer-toolkit/encounter-persistence/liveConcentrationResponseAdmission'
import { readEncounterAutoRollByActorId } from '@artificer-toolkit/encounter-persistence/actorController'
import { readEncounterActorTokenBindings } from '@artificer-toolkit/encounter-persistence/actorTokenBindings'
import { readMemberSeenActorIds } from '@artificer-toolkit/encounter-persistence/targetVisibility'
import { readEncounterOccupantAuras } from '@artificer-toolkit/encounter-persistence/occupantAuras'
import {
  readRoomActionAreaSceneInputs,
  readRoomActionSceneInputs
} from './roomActionSceneInputs.js'
import { readCleavingResponseAdmission } from '@artificer-toolkit/encounter-persistence/cleavingResponseAdmission'
import { readNativeEncounterActionAdmission } from '@artificer-toolkit/encounter-persistence/actionAdmission'
import { readAreaRemovalCommitAdmission } from '@artificer-toolkit/encounter-persistence/areaTargetRemoval'
import { readNativeEncounterActionResponseAdmission } from '@artificer-toolkit/encounter-persistence/actionResumeAdmission'
import { readLiveEncounterActionScope } from '@artificer-toolkit/encounter-persistence/liveActionAdmission'
import { presentEncounterResultForMember } from '@artificer-toolkit/encounter-persistence/resultPresentation'
import { readContestAdmission } from '@artificer-toolkit/encounter-persistence/contestAdmission'
import { readRoomLiveMovementAdmission } from './roomSceneGeometryRead.js'
import { readEncounterSpellPinRows } from '@artificer-toolkit/encounter-persistence/spellPins'
import { readMovementResolution } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'

type SemanticResponse = {
  [Kind in LiveSessionEncounterRulesResponse['kind']]: Omit<
    Extract<LiveSessionEncounterRulesResponse, { kind: Kind }>,
    'revisions'
  >
}[LiveSessionEncounterRulesResponse['kind']]

/** Implemented room planners read the caller's admitted transaction and current room inputs. */
export async function readRoomEncounterTurnCapture(
  ctx: EncounterReadTransaction,
  inputs: RoomInputs,
  transaction: RoomTransaction,
  input: LiveSessionEncounterRulesInput,
  observed: LiveSessionRulesRevisions,
  scene: Parameters<typeof readEncounterTurnCapture>[3],
  presentation?: { sceneId: string; version: number }
): Promise<LiveSessionEncounterRulesResponse> {
  input = liveSessionEncounterRulesInputSchema.parse(input)
  if (
    [input.movement, input.concentrationResponse, input.turnCommand, input.action].filter(
      (scope) => scope !== undefined
    ).length > 1
  )
    throw new Error('Live Session capture scopes cannot be combined.')
  const movementAdmission = input.movement
    ? await readRoomLiveMovementAdmission(
        ctx,
        transaction,
        { ...input, movement: input.movement },
        observed,
        (() => {
          if (!presentation) throw new Error('Room movement presentation is unavailable.')
          return presentation
        })()
      )
    : null
  if (
    movementAdmission &&
    (movementAdmission.state.id !== input.encounterId ||
      movementAdmission.state.version !== input.expectedVersion)
  )
    throw new Error('Live movement Encounter scope or version mismatch.')
  if (
    movementAdmission &&
    [
      'CONCENTRATION_RESPONSE',
      'CONTEST',
      'ACTION_COMMAND',
      'ACTION_RESPONSE',
      'AREA_REMOVAL',
      'CLEAVING_RESPONSE',
      'BASIC_ACTION',
      'TURN_COMMAND'
    ].includes(input.request.kind)
  )
    throw new Error('A command admission admits its own scope.')
  const turnRequest =
    input.request.kind === 'MAINTENANCE_STATE' ||
    input.request.kind === 'SCENE_PERCEPTION' ||
    input.request.kind === 'SCENE_PERCEPTION_ENTITIES' ||
    input.request.kind === 'SCENE_SPATIAL_EFFECTS'
  if (
    turnRequest &&
    !input.movement &&
    ((input.expectedRole !== 'OWNER' && !input.turnCommand && !input.action) ||
      input.concentrationResponse)
  )
    throw new Error('Turn capture requires owner or admitted response scope.')
  const concentrationAdmission = input.concentrationResponse
    ? await readLiveConcentrationResponseAdmission(ctx, {
        ...input,
        concentrationResponse: input.concentrationResponse
      })
    : null
  if (input.request.kind === 'CONCENTRATION_RESPONSE') {
    if (!concentrationAdmission) throw new Error('Room concentration response is unavailable.')
    const response = {
      kind: 'CONCENTRATION_RESPONSE' as const,
      fingerprint: concentrationAdmission.fingerprint,
      autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
        campaign: concentrationAdmission.campaign,
        initiatorUserId: concentrationAdmission.campaign.ownerUserId,
        actors: concentrationAdmission.actors
      }),
      appRoll: concentrationAdmission.kind === 'READY' ? concentrationAdmission.appRoll : null,
      state: concentrationAdmission.state,
      // As stored: the save awaiting its d20, or the d20 window that follows it.
      snapshot:
        concentrationAdmission.kind === 'READY' ? concentrationAdmission.pending.stored : null,
      parentApplications:
        concentrationAdmission.kind === 'READY' ? concentrationAdmission.parentApplications : [],
      result: concentrationAdmission.kind === 'REPLAY' ? concentrationAdmission.result : null
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: observed
    })
  }
  if (concentrationAdmission?.kind === 'REPLAY')
    throw new Error('Completed concentration response cannot capture rules inputs.')
  if (input.request.kind === 'CONTEST') {
    if (
      input.expectedRole !== 'OWNER' &&
      checksumCanonicalJson(input.action) !== checksumCanonicalJson(input.request)
    )
      throw new Error('Live Session action scope mismatch.')
    if (input.turnCommand || input.concentrationResponse)
      throw new Error('Room action capture cannot use another command scope.')
    const admission = await readContestAdmission(ctx, {
      ...input,
      command: input.request.command
    })
    const response = {
      kind: 'CONTEST' as const,
      ready:
        admission.kind === 'READY'
          ? {
              command: admission.root,
              fingerprint: admission.fingerprint,
              initiatorUserId: admission.initiatorUserId,
              autoRollByActorId: admission.autoRollByActorId,
              appRoll: admission.appRoll,
              snapshot: admission.prior?.snapshot ?? null,
              occurrenceVersion: admission.occurrence?.version ?? null
            }
          : null,
      result: admission.kind === 'REPLAY' ? admission.result : null
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: observed
    })
  }
  if (input.request.kind === 'AREA_REMOVAL') {
    if (input.expectedRole !== 'OWNER')
      throw new Error('Only the GM removes a creature from an area.')
    if (input.turnCommand || input.concentrationResponse)
      throw new Error('Room action capture cannot use another command scope.')
    const { userId } = await ctx.ports.requireIdentity()
    if (
      userId !== input.expectedUserId ||
      input.request.removal.encounterId.toLowerCase() !== input.encounterId ||
      input.request.removal.expectedVersion !== input.expectedVersion
    )
      throw new Error('Live Session Encounter command scope mismatch.')
    await ctx.ports.requireActiveLiveAuthority({
      campaignId: input.campaignId,
      epoch: input.authorityEpoch
    })
    const { removal, admission } = await readAreaRemovalCommitAdmission(
      ctx,
      input.request.removal,
      userId
    )
    if (
      admission.kind !== 'READY' ||
      admission.state.campaignId !== input.campaignId ||
      admission.membership.role !== input.expectedRole
    )
      throw new Error('Live Session Encounter scope or version mismatch.')
    return liveSessionEncounterRulesResponseSchema.parse({
      kind: 'AREA_REMOVAL',
      autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
        campaign: admission.campaign,
        initiatorUserId: admission.initiatorUserId,
        actors: await readRunActors(ctx, admission.state)
      }),
      command: admission.input,
      fingerprint: admission.fingerprint,
      areaSnapshot: removal.snapshot,
      revisions: observed
    })
  }
  if (input.request.kind === 'ACTION_COMMAND' || input.request.kind === 'ACTION_RESPONSE') {
    if (
      input.expectedRole !== 'OWNER' &&
      checksumCanonicalJson(input.action) !== checksumCanonicalJson(input.request)
    )
      throw new Error('Live Session action scope mismatch.')
    if (input.turnCommand || input.concentrationResponse)
      throw new Error('Room action capture cannot use another command scope.')
    const { userId } = await ctx.ports.requireIdentity()
    if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
    const command =
      input.request.kind === 'ACTION_COMMAND' ? input.request.command : input.request.response
    if (
      command.encounterId.toLowerCase() !== input.encounterId ||
      command.expectedVersion !== input.expectedVersion
    )
      throw new Error('Live Session Encounter command scope mismatch.')
    await ctx.ports.requireActiveLiveAuthority({
      campaignId: input.campaignId,
      epoch: input.authorityEpoch
    })
    let resumed = null
    if (input.request.kind === 'ACTION_RESPONSE') {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
        .unique()
      if (!run) throw new Error('Encounter Run was not found.')
      resumed = await readNativeEncounterActionResponseAdmission(
        ctx,
        input.request.response,
        run,
        userId
      )
      if (!resumed) throw new Error('The occurrence is not an ordinary Encounter action.')
    }
    const admission =
      resumed?.admission ??
      (input.request.kind === 'ACTION_COMMAND'
        ? await readNativeEncounterActionAdmission(ctx, input.request.command, userId)
        : null)
    if (
      !admission ||
      admission.state.campaignId !== input.campaignId ||
      admission.membership.role !== input.expectedRole
    )
      throw new Error('Live Session Encounter scope or version mismatch.')
    const replay =
      resumed?.kind === 'REPLAY'
        ? resumed.result
        : admission.kind === 'REPLAY'
          ? admission.result
          : null
    const response = {
      ...(resumed
        ? {
            kind: 'ACTION_RESPONSE' as const,
            snapshot: resumed.kind === 'READY' ? resumed.pending.snapshot : null,
            areaSnapshot: resumed.kind === 'READY' ? (resumed.area?.snapshot ?? null) : null,
            appRoll: resumed.kind === 'READY' ? resumed.appRoll : null
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
      revisions: observed
    })
  }
  if (input.request.kind === 'CLEAVING_RESPONSE') {
    if (
      input.expectedRole !== 'OWNER' &&
      checksumCanonicalJson(input.action) !== checksumCanonicalJson(input.request)
    )
      throw new Error('Live Session action scope mismatch.')
    if (input.turnCommand || input.concentrationResponse)
      throw new Error('Room action capture cannot use another command scope.')
    const admission = await readCleavingResponseAdmission(ctx, {
      ...input,
      response: input.request.response
    })
    const response = {
      kind: 'CLEAVING_RESPONSE' as const,
      fingerprint: admission.fingerprint,
      autoRollByActorId: admission.kind === 'READY' ? admission.autoRollByActorId : {},
      snapshot: admission.kind === 'READY' ? admission.pending.snapshot : null,
      result: admission.kind === 'REPLAY' ? admission.result : null
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: observed
    })
  }
  if (input.request.kind === 'BASIC_ACTION') {
    if (
      input.expectedRole !== 'OWNER' &&
      checksumCanonicalJson(input.action) !== checksumCanonicalJson(input.request)
    )
      throw new Error('Room basic action capture scope mismatch.')
    if (input.turnCommand || input.concentrationResponse)
      throw new Error('Room action capture cannot use another command scope.')
    const admission = await readBasicActionScopeAdmission(ctx, {
      ...input,
      command: input.request.command
    })
    const response = {
      kind: 'BASIC_ACTION' as const,
      ready:
        admission.kind !== 'READY'
          ? null
          : 'response' in admission
            ? {
                command: admission.response,
                fingerprint: admission.fingerprint,
                initiatorUserId: admission.initiatorUserId,
                // A check action's outcome dice roll on the roller's preference when its d20 settles.
                autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
                  campaign: admission.campaign,
                  initiatorUserId: admission.initiatorUserId,
                  actors: await readRunActors(ctx, admission.state)
                }),
                appRoll: admission.appRoll,
                snapshot: admission.pending.snapshot,
                occurrenceVersion: admission.occurrence.version
              }
            : {
                command: admission.command,
                fingerprint: admission.fingerprint,
                initiatorUserId: admission.membership.userId,
                autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
                  campaign: admission.campaign,
                  initiatorUserId: admission.membership.userId,
                  actors: await readRunActors(ctx, admission.state)
                }),
                appRoll: null,
                snapshot: null,
                occurrenceVersion: null
              },
      result: admission.kind === 'REPLAY' ? admission.result : null
    }
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: observed
    })
  }
  if (input.request.kind === 'TURN_COMMAND') {
    const { response } = await readEncounterTurnCommandCapture(ctx, input)
    return liveSessionEncounterRulesResponseSchema.parse({
      ...response,
      revisions: observed
    })
  }
  const { userId } = await ctx.ports.requireIdentity()
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  const turnAdmission = input.turnCommand
    ? await readLiveEncounterTurnAdmission(ctx, input, input.turnCommand)
    : null
  const actionAdmission = input.action
    ? await readLiveEncounterActionScope(ctx, {
        ...input,
        action: input.action
      })
    : null
  if (
    turnAdmission &&
    (turnAdmission.kind !== 'READY' ||
      turnAdmission.state.id !== input.encounterId ||
      turnAdmission.state.version !== input.expectedVersion)
  )
    throw new Error('Live Session turn response is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    input.campaignId,
    userId
  )
  if (
    membership.role !== input.expectedRole ||
    (!turnAdmission &&
      !actionAdmission &&
      !concentrationAdmission &&
      !movementAdmission &&
      membership.role !== 'OWNER')
  )
    throw new Error('Live Session role mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  await ctx.ports.requireActiveLiveAuthority({
    campaignId: campaign.id,
    epoch: input.authorityEpoch
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  if (
    state.id !== input.encounterId ||
    state.campaignId !== campaign.id ||
    state.gameSystemId !== campaign.gameSystemId ||
    state.version !== input.expectedVersion
  )
    throw new Error('Live Session Encounter scope or version mismatch.')
  const request = input.request
  let response: SemanticResponse
  if (request.kind === 'MOVEMENT_INPUTS') {
    if (!movementAdmission) throw new Error('Movement capture scope is required.')
    response = {
      kind: 'MOVEMENT_INPUTS',
      campaignOwnerUserId: campaign.ownerUserId,
      autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
        campaign,
        initiatorUserId: movementAdmission.save.movementResolution
          ? readMovementResolution(movementAdmission.save)!.root.initiatorUserId
          : movementAdmission.save.actorUserId,
        actors: await readRunActors(ctx, state)
      }),
      appRoll: movementAdmission.appRoll,
      save: movementAdmission.save,
      header: movementAdmission.header,
      bindings: await readEncounterActorTokenBindings(ctx, state, movementAdmission.header.id)
    }
  } else if (request.kind === 'INPUTS') {
    response = {
      kind: 'INPUTS',
      state,
      system: await ctx.ports.requireSystem(state.gameSystemId)
    }
  } else if (request.kind === 'ACTOR_TOKEN_BINDINGS') {
    response = {
      kind: 'ACTOR_TOKEN_BINDINGS',
      bindings: await readEncounterActorTokenBindings(ctx, state)
    }
  } else if (request.kind === 'SEEN_ACTORS') {
    response = {
      kind: 'SEEN_ACTORS',
      actorIds: await readMemberSeenActorIds(ctx, {
        encounterId: state.id,
        actors: await readRunActors(ctx, state),
        membership
      })
    }
  } else if (request.kind === 'SPELL_PINS') {
    response = {
      kind: 'SPELL_PINS',
      pins: (await readEncounterSpellPinRows(ctx, state.id)).map(
        ({
          encounterId,
          spellId,
          sourceRevision,
          sourceVersionId,
          sourceChecksum,
          compilationJson
        }) => ({
          encounterId,
          spellId,
          sourceRevision,
          sourceVersionId,
          sourceChecksum,
          compilationJson
        })
      )
    }
  } else if (request.kind === 'OCCUPANT_AURAS') {
    const actorId = request.actorId.toLowerCase()
    response = {
      kind: 'OCCUPANT_AURAS',
      actorId,
      auras: await readEncounterOccupantAuras(
        ctx,
        state,
        actorId,
        async (sceneId) => (await readRoomSceneState(transaction, sceneId)).scene
      )
    }
  } else if (request.kind === 'ACTION_SCENE') {
    const actorId = request.command.actorId.toLowerCase()
    const targetActorId = request.command.targetActorId.toLowerCase()
    if (!state.actorIds.includes(actorId) || !state.actorIds.includes(targetActorId))
      throw new Error('Action Scene actor is not in the Encounter.')
    response = {
      kind: 'ACTION_SCENE',
      context: await readRoomActionSceneInputs(ctx, transaction, state, {
        actorId,
        targetActorId,
        ...(request.command.actionId && { actionId: request.command.actionId }),
        sceneContext: request.command.sceneContext
          ? {
              ...request.command.sceneContext,
              sceneId: request.command.sceneContext.sceneId.toLowerCase(),
              sourceTokenId: request.command.sceneContext.sourceTokenId.toLowerCase(),
              targetTokenId: request.command.sceneContext.targetTokenId.toLowerCase()
            }
          : null
      })
    }
  } else if (request.kind === 'ACTION_AREA_SCENE') {
    const actorId = request.command.actorId.toLowerCase()
    if (!state.actorIds.includes(actorId))
      throw new Error('Action Scene actor is not in the Encounter.')
    response = {
      kind: 'ACTION_AREA_SCENE',
      context: await readRoomActionAreaSceneInputs(ctx, transaction, state, {
        actorId,
        sceneId: request.command.sceneId.toLowerCase(),
        expectedSceneVersion: request.command.expectedSceneVersion
      })
    }
  } else if (request.kind === 'INITIATIVE_ROUND') {
    response = {
      kind: 'INITIATIVE_ROUND',
      state:
        state.status === 'ACTIVE'
          ? await readEncounterInitiativeRound(ctx, {
              encounterId: state.id,
              round: state.round
            })
          : null
    }
  } else if (request.kind === 'TURN_USES') {
    const actorId = request.actorId.toLowerCase()
    if (!state.actorIds.includes(actorId))
      throw new Error('Turn uses actor is not in the Encounter.')
    response = { kind: 'TURN_USES', keys: await readTurnUses(ctx, { state, actorId }) }
  } else if (request.kind === 'TURN_STARTED') {
    const actorId = request.actorId.toLowerCase()
    if (!state.actorIds.includes(actorId))
      throw new Error('Turn start actor is not in the Encounter.')
    response = {
      kind: 'TURN_STARTED',
      startedByCommandId: await readTurnStartedBy(ctx, {
        encounterId: state.id,
        round: request.round,
        actorId
      })
    }
  } else if (request.kind === 'TURN_MOVED_FEET') {
    const actorId = request.actorId.toLowerCase()
    if (!state.actorIds.includes(actorId))
      throw new Error('Turn movement actor is not in the Encounter.')
    response = { kind: 'TURN_MOVED_FEET', feet: await readTurnMovedFeet(ctx, { state, actorId }) }
  } else if (request.kind === 'TURN_LAST_MOVE') {
    const actorId = request.actorId.toLowerCase()
    if (!state.actorIds.includes(actorId))
      throw new Error('Turn movement actor is not in the Encounter.')
    response = { kind: 'TURN_LAST_MOVE', lastMove: await readTurnLastMove(ctx, { state, actorId }) }
  } else if (request.kind === 'TELEPORT_ALLOWANCES') {
    const actorId = request.actorId.toLowerCase()
    if (!state.actorIds.includes(actorId))
      throw new Error('Teleport allowance actor is not in the Encounter.')
    response = {
      kind: 'TELEPORT_ALLOWANCES',
      allowances: await readTurnTeleportAllowances(ctx, { state, actorId })
    }
  } else if (request.kind === 'SYSTEM_VOCABULARY') {
    const loaded = await inputs.system('VOCABULARY', observed, transaction)
    if (!loaded.vocabulary || loaded.vocabulary.systemId !== state.gameSystemId)
      throw new Error('Encounter System vocabulary snapshot is unavailable.')
    response = { kind: 'SYSTEM_VOCABULARY', snapshot: loaded.vocabulary }
  } else if (request.kind === 'DEFINITION') {
    const { definition } = await inputs.definition(request.definitionId, observed, transaction)
    if (definition && definition.gameSystemId !== state.gameSystemId)
      throw new Error('Reusable definition System mismatch.')
    response = { kind: 'DEFINITION', definition }
  } else if (
    request.kind === 'MAINTENANCE_SLOT' ||
    request.kind === 'MAINTENANCE_STATES' ||
    request.kind === 'MAINTENANCE_DEPENDENTS' ||
    request.kind === 'MAINTENANCE_OWNER' ||
    request.kind === 'MAINTENANCE_OWNER_EFFECTS'
  ) {
    // Character dependents load with their Character, so a detached owner loads first; one that
    // is no longer ACTIVE refuses the capture, as the Convex capture did. A departed owner's
    // dependents are Convex's to end (D81), so it is not read.
    if (
      request.kind === 'MAINTENANCE_DEPENDENTS' &&
      request.ownerKind === 'CHARACTER' &&
      request.cursor === null
    )
      for (const characterId of inputs.maintenanceCharacterOwnersAtLoad(
        state.id,
        request.stateId,
        transaction
      )) {
        const assignment = await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (query) => query.eq('characterId', characterId))
          .unique()
        if (assignment?.campaignId !== state.campaignId) continue
        if (!(await ctx.ports.readCharacterRow(characterId)))
          throw new Error('Maintained-effect Character owner is unavailable.')
      }
    response = await readRoomMaintenanceCapture(ctx, state, request)
  } else if (
    request.kind === 'MAINTENANCE_STATE' ||
    request.kind === 'SCENE_PERCEPTION' ||
    request.kind === 'SCENE_PERCEPTION_ENTITIES' ||
    request.kind === 'SCENE_SPATIAL_EFFECTS'
  ) {
    response = await readEncounterTurnCapture(ctx, state, request, scene)
  } else if (request.kind === 'ACTOR' || request.kind === 'EFFECTS') {
    const actor = await readRunActor(ctx, state, request.actorId)
    let characterDead = false
    if (actor.kind === 'CHARACTER') {
      if (await isDepartedCharacterActor(ctx, campaign.id, actor))
        rejectDomain('TARGET_UNAVAILABLE', 'That Character has left the Campaign.')
      const { assignment } = await ctx.ports.requireCampaignCharacterAuthority(
        campaign.id,
        actor.sourceId,
        campaign.ownerUserId
      )
      const active = await ctx.ports.readCharacterRow(actor.sourceId)
      if (
        !active ||
        active.id !== actor.sourceId ||
        active.userId !== assignment.userId ||
        active.systemId !== state.gameSystemId ||
        active.status !== 'ACTIVE'
      )
        throw new Error('Encounter Character actor identity is stale.')
      characterDead = isCharacterDead(
        ctx.ports.readCharacterRecord(active).state.hitpoints.deathSaves
      )
    }
    const after = request.kind === 'ACTOR' ? null : request.afterEffectId
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
      request.kind === 'ACTOR'
        ? { kind: 'ACTOR', actor, characterDead, effects, continueAfter }
        : { kind: 'EFFECTS', actorId: actor.id, effects, continueAfter }
  } else {
    throw new Error('Room turn capture request is unavailable.')
  }
  return liveSessionEncounterRulesResponseSchema.parse({
    ...response,
    revisions: observed
  })
}
