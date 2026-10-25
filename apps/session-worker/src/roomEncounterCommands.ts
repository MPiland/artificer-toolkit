import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { recordEncounterCommand } from '@artificer-toolkit/encounter-persistence/commands'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { readActiveSceneEncounter } from '@artificer-toolkit/encounter-persistence/sceneBindingReads'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { presentEncounterResultForMember } from '@artificer-toolkit/encounter-persistence/resultPresentation'
import { isCharacterSheetLivePlayCommand } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomNativeEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import {
  liveSessionRoomPlayAuthorizationSchema,
  type LiveSessionRoomAuthorization
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { roomEncounterReadTransaction, type RoomSceneTokens } from './roomEncounterReadPorts.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import { prepareRoomLiveCharacterSheet, readRoomOwnerCharacterRules } from './roomCharacterRules.js'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterReadContext } from '@artificer-toolkit/encounter-persistence/store'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { executeRoomEncounterTurn } from './roomEncounterTurns.js'
import { recordRoomEncounterReplay, removeRoomFinishedRunRows } from './roomEncounterReplayIndex.js'
import {
  readRoomEncounterResponseRoute,
  refuseUnroutedEncounterDecision,
  requireEncounterDecisionResponder,
  roomOwnsEncounterVoid
} from './roomEncounterResponseRouting.js'
import { executeRoomCharacterSheetCommand } from './roomCharacterSheetCommands.js'
import { projectRoomCharacterSheet } from './roomCharacterSheetProjection.js'
import { executeRoomEncounterConcentrationResponse } from './roomEncounterConcentrationResponse.js'
import { executeRoomEncounterCleavingResponse } from './roomEncounterCleavingResponse.js'
import { executeRoomEncounterAction } from './roomEncounterActions.js'
import { settleDamageMirrors } from './roomDamageMirror.js'
import { raiseRoomHpZeroEffects } from './roomEncounterHpZeroTriggers.js'
import {
  actorIdsOutOfPlayByEffect,
  flagRoomReturnsOntoOccupiedSpace
} from './roomEncounterReturnsToPlay.js'
import { raiseRoomStartOfTurnEffects } from './roomEncounterStartOfTurnTriggers.js'
import { executeRoomEncounterContest } from './roomEncounterContest.js'
import {
  executeRoomEncounterBasicActionResponse,
  executeRoomEncounterChangeFacing,
  executeRoomEncounterEscape,
  executeRoomEncounterEndHeldGrant,
  executeRoomEncounterEscapeResponse,
  executeRoomEncounterMoveHeldEffect,
  executeRoomEncounterReleaseRelationship
} from './roomEncounterBasicActions.js'
import { removeAreaActionTarget } from '@artificer-toolkit/encounter-persistence/areaTargetRemoval'
import {
  prepareRuleOccurrenceVoid,
  recordRuleOccurrenceVoid
} from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import type {
  ChangeFacingInputDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  MoveHeldEffectInputDto,
  ReleaseRelationshipInputDto,
  RemoveAreaTargetInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { executeEncounterActorTokenBinding } from '@artificer-toolkit/encounter-persistence/actorTokenBindingPersistence'
import { parseSceneLiveEntity } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { roomSceneTokenReaders } from './roomActionSceneInputs.js'
import { endRoomOrphanedSummons, removeRoomSummonTokens } from './roomActionSummonTokens.js'
import { restoreRoomActorFacing } from './roomActionFacing.js'
import { readRoomScene, readRoomSceneState } from './roomSceneRead.js'
import { publishRoomSceneUndo } from './roomSceneUndo.js'

/** The room journal's fingerprint of an Encounter command: a reused command ID must match it. */
export function roomEncounterCommandFingerprint(command: RoomNativeEncounterCommand) {
  return checksumCanonicalJson({ command, scope: 'ENCOUNTER' })
}

/** The enclosing command transaction also commits the room receipt before any recipient sees it. */
export async function executeRoomEncounterCommand(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  recipientUserIds: string[]
  command: RoomNativeEncounterCommand
  /** The room's presented Scene; actor-token bindings change only its tokens. */
  presentedSceneId?: string | null
  sceneTokens: RoomSceneTokens
  random(maximum: number): number
  turnExecution?: { runtime: RulesRuntimeService }
}) {
  const { store, transaction, inputs, authorization, campaignId, epoch, userId, command } = input
  await inputs.encounter(command.encounterId.toLowerCase(), transaction)
  const observed = inputs.revisions(campaignId, authorization.revisions)
  const written = await roomEncounterWriteTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch,
    userId,
    observed,
    sceneTokens: input.sceneTokens
  })
  const context: EncounterWriteTransaction = {
    ...written,
    ports: {
      ...written.ports,
      restoreActionForcedMovements: async ({ encounterId, commandId, movements }) => {
        for (const { sceneId, sceneCommandId } of [...movements].reverse()) {
          const { scene } = await readRoomSceneState(transaction, sceneId)
          await publishRoomSceneUndo({
            transaction,
            userId,
            scene,
            request: {
              input: {
                type: 'UNDO_LAST_SCENE_MOVE',
                commandId: crypto.randomUUID(),
                sceneId,
                expectedSceneVersion: scene.version
              }
            },
            settledEncounterMechanics: async () => false,
            actionMove: { sceneCommandId, origin: { encounterId, commandId } }
          })
        }
      },
      restoreActionFacing: ({ encounterId, commandId, sceneId, sceneCommandId }) =>
        restoreRoomActorFacing({
          transaction,
          userId,
          sceneId,
          sceneCommandId,
          origin: { encounterId, commandId }
        }),
      removeSummonTokens: ({ encounterId, commandId, tokens }) =>
        removeRoomSummonTokens({ transaction, userId, encounterId, commandId, tokens }),
      // A GM's Sheet command on an Encounter Character commits on the Run's held play (R06.3); a
      // Run that is not ACTIVE holds no play, so that edit belongs to the Sheet itself.
      executeCharacterCommand: async (
        caller,
        { characterId, command: sheetCommand },
        encounterId
      ) => {
        const run = await written.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', encounterId.toLowerCase()))
          .unique()
        if (
          !isCharacterSheetLivePlayCommand(sheetCommand) ||
          sheetCommand.type === 'SET_PARTY_VISIBILITY' ||
          (run !== null && readRunState(run).status !== 'ACTIVE')
        )
          throw new CharacterSheetCommandError('Make this change from the Character Sheet.')
        const executed = await executeRoomCharacterSheetCommand({
          store,
          transaction,
          inputs,
          authorization,
          campaignId,
          epoch,
          userId: caller,
          ctx: written,
          random: input.random,
          command: {
            scope: 'CHARACTER_SHEET',
            characterId,
            encounterId,
            command: sheetCommand
          }
        })
        // An actor of the Run is a Character the Run holds, so its Sheet always settles here.
        if (!executed.facts) throw new Error('The Run does not hold this Character.')
        const { streamVersion } = executed.acknowledgement
        const { overview } = projectRoomCharacterSheet(
          executed.facts,
          await listActiveRuleEffects(
            written,
            { kind: 'CHARACTER', characterId: characterId.toLowerCase() },
            { ownerVerified: true }
          )
        )
        return {
          streamVersion,
          currentHitPoints: overview.currentHitPoints,
          maxHitPoints: overview.maxHitPoints,
          tempHitPoints: overview.tempHitPoints,
          conditions: overview.conditions
        }
      }
    }
  }
  const beforeRun = await context.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId.toLowerCase()))
    .unique()
  if (!beforeRun) throw new Error('Encounter is unavailable.')
  // A completed Run keeps no snapshots, rounds or history to run a command against (Amendment 30).
  if (beforeRun.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
    const route = await readRoomEncounterResponseRoute(store, command)
    const routed =
      command.type === 'RESOLVE_RULE_OCCURRENCE'
        ? route !== null
        : await roomOwnsEncounterVoid(store, command)
    // The presented Scene's movement path settles its own Run's movement first, so a movement
    // decision here belongs to an Encounter the presented Scene is not bound to (D42).
    if (route === 'MOVEMENT' && (command.type === 'RESOLVE_RULE_OCCURRENCE' || !routed))
      rejectDomain('SCENE_NOT_PRESENTED')
    if (!routed) await refuseUnroutedEncounterDecision(context, beforeRun, userId, command)
    // A recorded command is a retry: its planner's admission replays or refuses it on its receipt,
    // a Run command or a rule receipt (an action's evidence answer records only the latter).
    if (command.type === 'RESOLVE_RULE_OCCURRENCE') {
      const key = {
        campaignId: beforeRun.campaignId,
        commandId: command.commandId.toLowerCase()
      }
      const recorded = await Promise.all([
        context.db
          .query('encounterRunCommands')
          .withIndex('by_campaignId_commandId', (q) =>
            q.eq('campaignId', key.campaignId).eq('commandId', key.commandId)
          )
          .unique(),
        context.db
          .query('encounterRuleReceipts')
          .withIndex('by_campaignId_commandId', (q) =>
            q.eq('campaignId', key.campaignId).eq('commandId', key.commandId)
          )
          .unique()
      ])
      if (!recorded.some((receipt) => receipt?.encounterId === beforeRun.id))
        await requireEncounterDecisionResponder(context, beforeRun, userId, command)
    }
  }
  const state = readRunState(beforeRun)
  const actorsBefore = await readRunActors(context, state)
  const characters = new Set(
    actorsBefore.flatMap((actor) =>
      actor.kind === 'CHARACTER' && !actor.frozenState ? [actor.sourceId] : []
    )
  )
  const defeatedBefore = new Set(
    actorsBefore.flatMap((actor) => (actor.kind === 'CREATURE' && actor.defeated ? [actor.id] : []))
  )
  const outOfPlayBefore = actorIdsOutOfPlayByEffect(actorsBefore)
  for (const characterId of characters) {
    if (inputs.characterIsCurrent(characterId, observed, transaction)) continue
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    await prepareRoomLiveCharacterSheet(
      store,
      inputs,
      {
        campaignId,
        authorityEpoch: epoch,
        characterId,
        expectedUserId: userId,
        expectedRole: membership.role
      },
      observed,
      transaction
    )
  }
  const removed =
    command.type === 'REMOVE_ACTOR'
      ? await context.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q
              .eq('encounterId', command.encounterId.toLowerCase())
              .eq('id', command.actorId.toLowerCase())
          )
          .unique()
      : null
  // A turn paused on a decision completes under the answer, yet it began under its root command.
  const answeredRootCommandId =
    command.type === 'RESOLVE_RULE_OCCURRENCE'
      ? (
          await context.db
            .query('encounterRuleOccurrences')
            .withIndex('by_publicId', (q) => q.eq('id', command.occurrenceId.toLowerCase()))
            .unique()
        )?.rootCommandId
      : undefined
  const rawResult =
    command.type === 'START' || command.type === 'ADVANCE_TURN'
      ? await executeTurn(command)
      : command.type === 'RESOLVE_ACTION'
        ? await executeAction(command)
        : command.type === 'RESOLVE_RULE_OCCURRENCE'
          ? await executeResponse(command)
          : command.type === 'VOID_RULE_OCCURRENCE'
            ? await executeVoid()
            : command.type === 'REMOVE_AREA_TARGET'
              ? await executeAreaRemoval(command)
              : command.type === 'ESCAPE'
                ? await executeEscape(command)
                : command.type === 'END_HELD_GRANT'
                  ? await executeEndHeldGrant(command)
                  : command.type === 'MOVE_HELD_EFFECT'
                    ? await executeMoveHeldEffect(command)
                    : command.type === 'RELEASE_RELATIONSHIP'
                      ? await executeReleaseRelationship(command)
                      : command.type === 'CHANGE_FACING'
                        ? await executeChangeFacing(command)
                        : command.type === 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' ||
                            command.type === 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
                          ? await executeTokenBinding(command)
                          : await recordEncounterCommand(context, command, userId, input.random)
  const parsedGm = encounterGmProjectionDtoSchema.safeParse(rawResult.projection)
  const currentRun = await context.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', state.id))
    .unique()
  if (!currentRun) throw new Error('Committed room Encounter is unavailable.')
  if (beforeRun.status !== 'ACTIVE' && currentRun.status === 'ACTIVE') {
    // The store fences the Runs it holds; a Run already ACTIVE in Convex when this one loaded is
    // not held here, and still holds the Campaign's one active Encounter.
    const activeEncounterId = inputs.activeEncounterIdAtLoad(state.id, transaction)
    if (
      activeEncounterId !== null &&
      activeEncounterId !== state.id &&
      !(await context.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', activeEncounterId))
        .unique())
    )
      rejectDomain('ACTIVE_ENCOUNTER_EXISTS')
  }
  const projection = parsedGm.success
    ? parsedGm.data
    : await readEncounterGmProjection(context, readRunState(currentRun))
  const result = { ...rawResult, projection }
  if (currentRun.status === 'COMPLETED') await removeRoomFinishedRunRows(context.db, currentRun.id)
  else
    await recordRoomEncounterReplay(context.db, {
      campaignId,
      encounterId: currentRun.id,
      commandId: command.commandId.toLowerCase(),
      actorUserId: userId.toLowerCase(),
      commandFingerprint: roomEncounterCommandFingerprint(command),
      version: projection.version,
      rollCardId:
        written.postedChatEntries.find(
          (entry) => entry.roll !== null && entry.roll.id === rawResult.roll?.id
        )?.id ?? null
    })
  // Only commands that change Convex-owned holds wait for Convex (ADR 0035 Amendment 17): START and
  // COMPLETE, and removing a Character actor. Bindings and rounds ride the next flush.
  const checkpointBeforeAcknowledgement =
    command.type === 'START' ||
    command.type === 'COMPLETE' ||
    (removed !== null && readStoredRunActor(removed).kind === 'CHARACTER')
  const settleMirrors = () =>
    settleDamageMirrors({
      ctx: context,
      store,
      transaction,
      inputs,
      campaignId,
      epoch,
      userId,
      observed,
      encounterId: currentRun.id,
      random: input.random
    })
  const mirroredDamage = await settleMirrors()
  const raisedHpZeroEffects =
    currentRun.status === 'ACTIVE' && input.turnExecution
      ? await raiseRoomHpZeroEffects({
          ctx: context,
          transaction,
          encounterId: currentRun.id,
          parentCommandId: command.commandId.toLowerCase(),
          defeatedBefore,
          execute: executeAction
        })
      : false
  const raisedStartOfTurnEffects =
    currentRun.status === 'ACTIVE' &&
    input.turnExecution &&
    (command.type === 'START' ||
      command.type === 'ADVANCE_TURN' ||
      command.type === 'RESOLVE_RULE_OCCURRENCE')
      ? await raiseRoomStartOfTurnEffects({
          ctx: context,
          encounterId: currentRun.id,
          parentCommandId: (answeredRootCommandId ?? command.commandId).toLowerCase(),
          execute: executeAction
        })
      : false
  const flaggedReturn =
    currentRun.status === 'ACTIVE' &&
    (await flagRoomReturnsOntoOccupiedSpace({
      ctx: context,
      transaction,
      encounterId: currentRun.id,
      userId,
      occurredAt: new Date().toISOString(),
      outOfPlayBefore
    }))
  // What the raised roots dealt to a mirror's holder reaches its source too.
  const mirroredRaisedDamage = await settleMirrors()
  // After every effect the command and its raised roots ended, so a carrier that ended takes its creature.
  const endedSummons =
    currentRun.status === 'ACTIVE' &&
    (await endRoomOrphanedSummons({
      ctx: context,
      transaction,
      userId,
      encounterId: currentRun.id,
      occurredAt: new Date().toISOString()
    }))
  const changedRun =
    mirroredDamage ||
    mirroredRaisedDamage ||
    raisedHpZeroEffects ||
    raisedStartOfTurnEffects ||
    flaggedReturn ||
    endedSummons
  const raisedRun = changedRun
    ? await context.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', state.id))
        .unique()
    : null
  if (changedRun && !raisedRun) throw new Error('Committed room Encounter is unavailable.')
  const presented = raisedRun
    ? { ...result, projection: await readEncounterGmProjection(context, readRunState(raisedRun)) }
    : result
  const recipients = new Map<string, EncounterCommandResultDto>()
  for (const recipient of new Set([userId, ...input.recipientUserIds])) {
    const { campaign, membership } = await context.ports.requireCampaignAuthority(
      campaignId,
      recipient
    )
    recipients.set(
      recipient,
      await presentEncounterResultForMember(context, {
        campaign,
        membership,
        result: {
          ...presented,
          roll: recipient === userId ? presented.roll : null,
          // The roll and its evidence are the presser's own, as on the Convex route.
          evidenceRoll: recipient === userId ? presented.evidenceRoll : null
        }
      })
    )
  }
  const play = await readRoomEncounterPlayAuthorization(
    context,
    campaignId,
    authorization.play,
    input.presentedSceneId ?? null
  )
  return {
    recipients,
    play,
    checkpointBeforeAcknowledgement,
    chatEntries: written.postedChatEntries,
    privateRolls: written.retainedPrivateRolls
  }

  async function executeTokenBinding(command: EncounterActorTokenBindingCommandInputDto) {
    const readers = roomSceneTokenReaders(transaction)
    return executeEncounterActorTokenBinding(context, command, {
      readCharacterRules: (campaign, characterId) =>
        readRoomOwnerCharacterRules(
          store,
          inputs,
          { campaign, authorityEpoch: epoch, characterId },
          observed,
          transaction
        ),
      readScene: async (sceneId) => {
        if (sceneId !== input.presentedSceneId?.toLowerCase()) rejectDomain('SCENE_NOT_PRESENTED')
        return readRoomScene(transaction, sceneId).header
      },
      readToken: async (sceneId, tokenId) => {
        const { header } = readRoomScene(transaction, sceneId)
        const live = await readers.readLiveToken(sceneId, tokenId)
        if (live) {
          const { value } = parseSceneLiveEntity(live, header.version)
          return value?.collection === 'tokens' ? value.entity : null
        }
        const base = await readers.readDefinitionToken(header.definitionSaveId, tokenId)
        if (!base) return null
        if (
          base.value.collection !== 'tokens' ||
          base.value.entity.id !== base.entityId ||
          base.checksum !== checksumCanonicalJson(base.value)
        )
          throw new Error('Stored Scene token is inconsistent.')
        return base.value.entity
      }
    })
  }

  async function executeTurn(command: Parameters<typeof executeRoomEncounterTurn>[0]['command']) {
    if (!input.turnExecution) throw new Error('Room turn execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterTurn({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }

  async function executeEscape(command: EscapeRelationshipInputDto) {
    if (!input.turnExecution) throw new Error('Room Escape execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterEscape({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      },
      command
    })
  }

  async function executeEndHeldGrant(command: EndHeldGrantInputDto) {
    if (!input.turnExecution) throw new Error('Room end-grant execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterEndHeldGrant({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      },
      command
    })
  }

  async function executeChangeFacing(command: ChangeFacingInputDto) {
    if (!input.turnExecution) throw new Error('Room facing-change execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterChangeFacing({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      },
      command
    })
  }

  async function executeMoveHeldEffect(command: MoveHeldEffectInputDto) {
    if (!input.turnExecution) throw new Error('Room effect-move execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterMoveHeldEffect({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      },
      command
    })
  }

  async function executeReleaseRelationship(command: ReleaseRelationshipInputDto) {
    if (!input.turnExecution) throw new Error('Room release execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterReleaseRelationship({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      },
      command
    })
  }

  /** A removal that leaves the area nothing to wait on commits it, as the last answer would have. */
  async function executeAreaRemoval(command: RemoveAreaTargetInputDto) {
    return (await removeAreaActionTarget(context, command)) ?? executeAction(command)
  }

  async function executeResponse(command: ResolveRuleOccurrenceInputDto) {
    const route = await readRoomEncounterResponseRoute(store, command)
    if (!input.turnExecution || route === null)
      throw new Error('Room response execution is unavailable.')
    if (route === 'TURN') return executeTurn(command)
    if (route === 'ACTION') return executeAction(command)
    if (route === 'CONTEST') return executeContest(command)
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    const execute =
      route === 'CLEAVING'
        ? executeRoomEncounterCleavingResponse
        : route === 'BASIC_ACTION'
          ? executeRoomEncounterBasicActionResponse
          : route === 'ESCAPE'
            ? executeRoomEncounterEscapeResponse
            : executeRoomEncounterConcentrationResponse
    return execute({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }

  async function executeAction(
    command: Parameters<typeof executeRoomEncounterAction>[0]['command']
  ) {
    if (command.type === 'RESOLVE_ACTION' && command.optionalCombatIntent != null)
      return executeContest(command)
    if (!input.turnExecution) throw new Error('Room action execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterAction({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }

  async function executeVoid() {
    if (command.type !== 'VOID_RULE_OCCURRENCE')
      throw new Error('Room void execution is unavailable.')
    const prepared = await prepareRuleOccurrenceVoid(context, command)
    if (prepared.kind === 'COMPLETE') return prepared.result
    if (prepared.kind === 'DECLINE') await executeResponse(prepared.command)
    return recordRuleOccurrenceVoid(context, command)
  }

  async function executeContest(
    command: Parameters<typeof executeRoomEncounterContest>[0]['command']
  ) {
    if (!input.turnExecution) throw new Error('Room contest execution is unavailable.')
    const { membership } = await context.ports.requireCampaignAuthority(campaignId, userId)
    return executeRoomEncounterContest({
      ...input.turnExecution,
      ctx: context,
      store,
      transaction,
      inputs,
      observed,
      command,
      random: input.random,
      scope: {
        campaignId,
        authorityEpoch: epoch,
        expectedUserId: userId,
        expectedRole: membership.role,
        encounterId: command.encounterId.toLowerCase(),
        expectedVersion: command.expectedVersion
      }
    })
  }
}

/**
 * Rebuilds room-owned controls from committed native facts, including after memory eviction: the
 * ACTIVE Run bound to the presented Scene plays, and no other Run's actors do. Null leaves the held
 * controls as they are, when this store never loaded the Run that holds them.
 */
export async function readRoomEncounterPlayAuthorization(
  ctx: EncounterReadContext,
  campaignId: string,
  held: LiveSessionRoomAuthorization['play'],
  sceneId: string | null
): Promise<LiveSessionRoomAuthorization['play'] | null> {
  const active = sceneId ? await readActiveSceneEncounter(ctx, { campaignId, sceneId }) : null
  if (!active) {
    const heldRun = held.encounter
      ? await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', held.encounter!.encounterId))
          .unique()
      : null
    return heldRun ? liveSessionRoomPlayAuthorizationSchema.parse({ encounter: null }) : null
  }
  const { run: row, binding: bound } = active
  const state = readRunState(row)
  const actors = await readRunActors(ctx, state)
  const bindings = await ctx.db
    .query('encounterActorTokenBindings')
    .withIndex('by_encounterId_tokenId', (q) => q.eq('encounterId', row.id))
    .collect()
  if (bindings.some((binding) => binding.sceneId !== bound.sceneId))
    throw new Error('Room Encounter token Scene mismatch.')
  return liveSessionRoomPlayAuthorizationSchema.parse({
    encounter: {
      encounterId: bound.encounterId,
      sceneId: bound.sceneId,
      healthDisplayDefault: state.healthDisplayDefault,
      actors: actors.map(({ id, kind, sourceId, controllerUserIds, owner, healthDisplay }) => ({
        id,
        kind,
        sourceId,
        controllerUserIds,
        ...(owner && { owner }),
        healthDisplay
      })),
      tokens: bindings.map(({ tokenId, actorId }) => ({ tokenId, actorId }))
    }
  })
}
/**
 * A retry keeps its original result at that version, and shows the current Run after later work.
 * A command only the replay index remembers (its history did not survive) answers "applied at that
 * version" with the current Run, and its roll from the persisted roll card.
 */
export async function replayRoomEncounterCommand(input: {
  store: RoomEncounterStore
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  userId: string
  sceneTokens: RoomSceneTokens
  replayed:
    | { kind: 'RECORDED'; result: EncounterCommandResultDto }
    | {
        kind: 'INDEXED'
        encounterId: string
        version: number
        roll: EncounterCommandResultDto['roll']
      }
}) {
  const { store, inputs, authorization, userId, replayed } = input
  const recorded = replayed.kind === 'RECORDED' ? replayed.result : null
  const encounterId =
    replayed.kind === 'RECORDED' ? replayed.result.projection.id : replayed.encounterId
  const recordedVersion =
    replayed.kind === 'RECORDED' ? replayed.result.projection.version : replayed.version
  const epoch = store.epoch
  if (!epoch) throw new Error('Room Encounter epoch is unavailable.')
  const row = await store.store
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (
    !row ||
    (recorded && row.campaignId !== recorded.projection.campaignId) ||
    row.version < recordedVersion
  )
    throw new Error('Stored local Encounter receipt does not match its Run.')
  const system = inputs.systemSnapshot()
  const savedGm = recorded ? encounterGmProjectionDtoSchema.safeParse(recorded.projection) : null
  const projection =
    savedGm?.success && row.version === recordedVersion
      ? savedGm.data
      : await readEncounterGmProjection(
          {
            db: store.store,
            ports: {
              readCharacterPlay,
              isRoomHeldRun: async () => true,
              requireSystem: async (id) => {
                if (id !== system.id) throw new Error('Room Encounter System mismatch.')
                return system
              }
            }
          },
          readRunState(row)
        )
  const ctx = await roomEncounterReadTransaction({
    store,
    inputs,
    authorization,
    campaignId: row.campaignId,
    epoch,
    userId,
    observed: inputs.revisions(row.campaignId, authorization.revisions),
    sceneTokens: input.sceneTokens
  })
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(row.campaignId, userId)
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result:
      replayed.kind === 'RECORDED'
        ? { ...replayed.result, projection }
        : {
            projection,
            roll: replayed.roll,
            occurrence: null,
            evidenceRoll: null
          }
  })
}
