import { replayMessage } from './roomSocket.js'
import type { RoomSceneCommitHost } from './roomSceneCommit.js'
import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomNativeEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { createNativeLiveSessionState } from './nativeLiveSessionState.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { encounterCommandRefusal, RoomAdmissionExpiredError } from './nativeRoomEncounterCommand.js'
import { commitMovementDecision } from './roomSceneCommit.js'
import { accountBucket, send, type Admission, type SocketAttachment } from './roomSocket.js'
import { readRoomSceneMovedBy } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { RoomRateLimitedError } from './roomRateLimits.js'
import { lookupRoomEncounterReplay } from './roomEncounterReplayIndex.js'
import {
  executeRoomEncounterCommand,
  replayRoomEncounterCommand,
  roomEncounterCommandFingerprint
} from './roomEncounterCommands.js'
import {
  readRoomEncounterResponseRoute,
  roomOwnsEncounterVoid
} from './roomEncounterResponseRouting.js'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { admitsRoomMember } from './roomAuthorization.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** The room steps an Encounter command uses. */
export type RoomEncounterExecutionHost = Pick<
  RoomCommandHost,
  | 'aggregateNeedsReload'
  | 'authorization'
  | 'authorizationBoundary'
  | 'broadcastStateSync'
  | 'buckets'
  | 'cache'
  | 'checkpointThrough'
  | 'flushOutbox'
  | 'inputs'
  | 'journal'
  | 'liveAdmission'
  | 'liveRulesRuntime'
  | 'loadRoomAggregate'
  | 'prepareWithRetry'
  | 'rejectCommand'
  | 'rejectRoomFailure'
  | 'rejectSceneCommand'
  | 'sceneTokens'
  | 'scheduleAlarm'
  | 'sendDomainRejection'
  | 'setCache'
  | 'store'
  | 'webSockets'
> &
  RoomSceneCommitHost

/**
 * Every ACTIVE-Run Encounter command commits in the room's SQLite (D78); a movement decision
 * settles through the presented Scene's movement path.
 */
export async function executeEncounterCommand(
  host: RoomEncounterExecutionHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: RoomNativeEncounterCommand
): Promise<void> {
  // A movement decision the room committed is journaled; its session sequence is not fenced (D28).
  const fingerprint = roomEncounterCommandFingerprint(command)
  let movementResponse = false
  if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
    try {
      if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
      await host.loadRoomAggregate(host.cache()?.scene?.id ?? null)
      movementResponse =
        (await readRoomEncounterResponseRoute(host.store, command)) === 'MOVEMENT' &&
        (command.type === 'RESOLVE_RULE_OCCURRENCE' ||
          !(await roomOwnsEncounterVoid(host.store, command)))
    } catch (error) {
      host.rejectRoomFailure(socket, command.commandId, error)
      return
    }
  }
  const prior = host.journal.lookupCommand({
    actorId: admission.userId,
    commandId: command.commandId,
    fingerprint
  })
  if (prior.kind === 'MISMATCHED_REUSE') {
    host.rejectCommand(
      socket,
      command.commandId,
      'INVALID_COMMAND',
      'The command ID was already used for different input.'
    )
    return
  }
  if (prior.kind === 'REPLAY') {
    const stored: unknown = JSON.parse(prior.receipt.receiptJson)
    // A movement decision stores the Scene receipt its sender was sent, then the Encounter result.
    const messages = (Array.isArray(stored) ? stored : [stored]).map((message) =>
      liveSessionWebSocketServerMessageDtoSchema.parse(message)
    )
    const replay = messages.at(-1)
    // A commit recovered after a restart kept only its Scene receipt.
    if (replay?.type === 'COMMAND_COMMITTED' && replay.delta?.scope === 'ENCOUNTER') {
      try {
        if (
          prior.receipt.checkpointBeforeAcknowledgement &&
          prior.receipt.sequence > (host.journal.readCurrent()?.publishedSequence ?? 0)
        )
          await host.checkpointThrough(
            value.authorityEpoch,
            prior.receipt.sequence,
            'ACKNOWLEDGEMENT'
          )
        await host.loadRoomAggregate(host.cache()?.scene?.id ?? null)
        const authorization = await host.authorizationBoundary(value)
        if (
          host.liveAdmission(socket)?.generation !== admission.generation ||
          !admitsRoomMember(authorization, admission)
        )
          return
        const result = await replayRoomEncounterCommand({
          store: host.store,
          inputs: host.inputs,
          authorization,
          userId: admission.userId,
          sceneTokens: host.sceneTokens(value.authorityEpoch),
          replayed: { kind: 'RECORDED', result: replay.delta.result }
        })
        for (const sceneReceipt of messages.slice(0, -1)) send(socket, replayMessage(sceneReceipt))
        send(socket, {
          ...replay,
          sequence:
            result.projection.version === replay.delta.result.projection.version
              ? replay.sequence
              : (host.journal.readCurrent()?.sequence ?? replay.sequence),
          delta: { scope: 'ENCOUNTER', result }
        })
      } catch (error) {
        host.rejectRoomFailure(socket, command.commandId, error)
      }
    } else
      host.rejectCommand(
        socket,
        command.commandId,
        'STALE_STATE',
        'This decision was already settled.'
      )
    return
  }
  // A command the room's history no longer holds is still recognized from the Run's replay index.
  try {
    if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
    await host.loadRoomAggregate(host.cache()?.scene?.id ?? null)
    const indexed = await lookupRoomEncounterReplay(host.store, {
      campaignId: value.campaignId,
      commandId: command.commandId,
      encounterId: command.encounterId,
      userId: admission.userId,
      fingerprint
    })
    if (indexed.kind === 'MISMATCH') {
      host.rejectCommand(
        socket,
        command.commandId,
        'INVALID_COMMAND',
        'The command ID was already used for different input.'
      )
      return
    }
    if (indexed.kind === 'INDEXED') {
      const authorization = await host.authorizationBoundary(value)
      if (
        host.liveAdmission(socket)?.generation !== admission.generation ||
        !admitsRoomMember(authorization, admission)
      )
        return
      const result = await replayRoomEncounterCommand({
        store: host.store,
        inputs: host.inputs,
        authorization,
        userId: admission.userId,
        sceneTokens: host.sceneTokens(value.authorityEpoch),
        replayed: indexed
      })
      send(socket, {
        commandId: command.commandId,
        delta: { scope: 'ENCOUNTER', result },
        sequence: host.journal.readCurrent()?.sequence ?? 0,
        type: 'COMMAND_COMMITTED'
      })
      return
    }
  } catch (error) {
    host.rejectRoomFailure(socket, command.commandId, error)
    return
  }
  if (
    movementResponse &&
    (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE')
  ) {
    try {
      const result = await commitMovementDecision(
        host,
        socket,
        admission,
        value,
        command,
        fingerprint
      )
      if (host.liveAdmission(socket)?.generation === admission.generation)
        send(socket, {
          commandId: command.commandId,
          delta: { scope: 'ENCOUNTER', result },
          sequence: host.journal.readCurrent()?.sequence ?? 0,
          type: 'COMMAND_COMMITTED'
        })
    } catch (error) {
      host.rejectSceneCommand(socket, command.commandId, error, undefined)
    }
    return
  }
  return executeLocalEncounterCommand(host, socket, admission, value, command, fingerprint)
}

async function executeLocalEncounterCommand(
  host: RoomEncounterExecutionHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: RoomNativeEncounterCommand,
  fingerprint: string
): Promise<void> {
  // A roll posted to the table spends the same D72 allowance as chat and Campaign rolls.
  const tableBucket =
    command.type === 'ROLL_RULE_EVIDENCE' ||
    command.type === 'ROLL_ACTOR_INITIATIVE' ||
    (command.type === 'ROLL_ENEMY_ACTION' && command.visibility === 'PUBLIC')
      ? accountBucket('TABLE', value, admission)
      : null
  try {
    if (tableBucket && !host.buckets.admits(tableBucket)) throw new RoomRateLimitedError()
    if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
    await host.loadRoomAggregate(host.cache()?.scene?.id ?? null)
    const current = host.journal.readCurrent()
    if (!current || current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
      throw new Error('Live Session authority changed.')
    const authorization = await host.authorizationBoundary(value)
    if (
      host.liveAdmission(socket)?.generation !== admission.generation ||
      !admitsRoomMember(authorization, admission)
    )
      return
    host.store.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    let receipt: LiveSessionWebSocketServerMessageDto | null = null
    let checkpointBeforeAcknowledgement = false
    let nextSceneStateJson = current.stateJson
    const sceneCache = host.cache()
    const { result } = await host.prepareWithRetry(authorization, (prepared, random) =>
      host.store.transact(
        async (transaction) => {
          const result = await executeRoomEncounterCommand({
            store: host.store,
            transaction,
            inputs: host.inputs,
            authorization: prepared,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            userId: admission.userId,
            recipientUserIds: host.webSockets().flatMap((candidate) => {
              const member = host.liveAdmission(candidate)
              return member && admitsRoomMember(prepared, member) ? [member.userId] : []
            }),
            command,
            presentedSceneId: sceneCache?.scene?.id ?? null,
            sceneTokens: host.sceneTokens(value.authorityEpoch),
            random,
            ...(command.type === 'START' ||
            command.type === 'ADVANCE_TURN' ||
            command.type === 'RESOLVE_ACTION' ||
            command.type === 'RESOLVE_RULE_OCCURRENCE' ||
            command.type === 'VOID_RULE_OCCURRENCE' ||
            command.type === 'REMOVE_AREA_TARGET' ||
            command.type === 'ESCAPE' ||
            command.type === 'END_HELD_GRANT' ||
            command.type === 'MOVE_HELD_EFFECT' ||
            command.type === 'RELEASE_RELATIONSHIP'
              ? {
                  turnExecution: { runtime: host.liveRulesRuntime() }
                }
              : {})
          })
          const ownResult = result.recipients.get(admission.userId)
          if (!ownResult) throw new Error('Room command has no admitted recipient result.')
          checkpointBeforeAcknowledgement = result.checkpointBeforeAcknowledgement
          receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
            type: 'COMMAND_COMMITTED',
            commandId: command.commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'ENCOUNTER', result: ownResult }
          })
          // An action's forced movement (D139) or its revert moved tokens on the presented Scene.
          const moved = await readRoomSceneMovedBy(transaction, sceneCache?.sceneHeader)
          const uncomposedScene = moved?.scene ?? sceneCache?.uncomposedScene
          const composition = uncomposedScene
            ? await composeRoomSceneVision({
                store: host.store,
                transaction,
                inputs: host.inputs,
                authorization: prepared,
                campaignId: value.campaignId,
                epoch: value.authorityEpoch,
                scene: uncomposedScene
              })
            : null
          if (composition)
            nextSceneStateJson = createNativeLiveSessionState(composition.scene).stateJson
          return { ...result, composition, moved }
        },
        (entry) => {
          const latest = host.authorization.current(value.authorityEpoch)
          if (
            host.liveAdmission(socket)?.generation !== admission.generation ||
            !latest ||
            checksumCanonicalJson(latest.revisions) !== checksumCanonicalJson(prepared.revisions) ||
            !admitsRoomMember(latest, admission)
          )
            throw new RoomAdmissionExpiredError()
          if (!receipt || entry.sequence !== current.sequence + 1)
            throw new Error('Room command sequence does not match its authority.')
          if (tableBucket) host.buckets.charge(tableBucket)
          const committed = host.journal.commitInTransaction({
            actorId: admission.userId,
            authorityEpoch: value.authorityEpoch,
            commandId: command.commandId,
            fingerprint,
            expectedSequence: current.sequence,
            expectedStateChecksum: current.stateChecksum,
            nextStateChecksum: entry.chainChecksum,
            nextStateJson: nextSceneStateJson,
            receiptJson: JSON.stringify(receipt),
            checkpointBeforeAcknowledgement
          })
          if (committed.kind !== 'COMMITTED')
            throw new Error('Room command unexpectedly replayed inside its write-set transaction.')
        }
      )
    )
    if (result.play) host.authorization.applyPlay(value.authorityEpoch, result.play)
    if (result.composition && sceneCache) {
      host.setCache({
        ...sceneCache,
        ...(result.play ? { encounterId: result.play.encounter?.encounterId ?? null } : {}),
        scene: result.composition.scene,
        characterRevisions: result.composition.characterRevisions,
        ...(result.moved
          ? {
              uncomposedScene: result.moved.scene,
              baseOrdinals: result.moved.baseOrdinals,
              sceneHeader: result.moved.header
            }
          : {})
      })
      if (!equalCanonicalJson(sceneCache.scene?.tokens, result.composition.scene.tokens))
        host.broadcastStateSync()
    }
    if (result.checkpointBeforeAcknowledgement)
      await host.checkpointThrough(value.authorityEpoch, current.sequence + 1, 'ACKNOWLEDGEMENT')
    const latest = await host.authorizationBoundary(value)
    for (const recipientSocket of host.webSockets()) {
      const member = host.liveAdmission(recipientSocket)
      if (!member || !latest || !admitsRoomMember(latest, member)) continue
      const projection = result.recipients.get(member.userId)
      if (projection)
        send(recipientSocket, {
          type: 'COMMAND_COMMITTED',
          commandId: command.commandId,
          sequence: current.sequence + 1,
          delta: { scope: 'ENCOUNTER', result: projection }
        })
      // Roll cards the command posted to the TABLE reach every member in the commit, after the
      // result they belong to, on the same room sequence.
      for (const entry of result.chatEntries)
        send(recipientSocket, {
          type: 'COMMAND_COMMITTED',
          commandId: command.commandId,
          sequence: current.sequence + 1,
          delta: { scope: 'CAMPAIGN_CHAT', entry, privateRoll: null }
        })
      // A roll retained for the GM reaches that user's sockets alone.
      for (const { userId, roll } of result.privateRolls)
        if (userId === member.userId)
          send(recipientSocket, {
            type: 'COMMAND_COMMITTED',
            commandId: command.commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'CAMPAIGN_CHAT', entry: null, privateRoll: roll }
          })
    }
    await host.scheduleAlarm()
  } catch (error) {
    if (
      error instanceof EncounterDomainRejection ||
      error instanceof LiveSessionDomainRejectionError
    ) {
      host.sendDomainRejection(socket, command.commandId, error)
      return
    }
    if (error instanceof RoomRateLimitedError)
      host.rejectCommand(socket, command.commandId, 'RATE_LIMITED', error.message)
    else if (error instanceof CharacterSheetCommandError)
      host.rejectCommand(socket, command.commandId, 'DOMAIN_REJECTED', error.message)
    else {
      const refusal = encounterCommandRefusal(error)
      host.rejectCommand(socket, command.commandId, refusal.code, refusal.message)
    }
  }
}
