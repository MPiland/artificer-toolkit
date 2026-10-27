import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCorrectionDto,
  type LiveSessionWebSocketClientMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { readSceneHoldingDecision } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import {
  sceneCommandResultDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { applySceneDelta, projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
import { createNativeLiveSessionState } from './nativeLiveSessionState.js'
import {
  isInlineSceneCommand,
  liveSessionSceneCommandInputSchema,
  planLiveSceneCommand
} from './nativeRoomSceneCommand.js'
import { RoomAdmissionExpiredError } from './nativeRoomEncounterCommand.js'
import { persistRoomSceneCommand } from './roomSceneCommandPersistence.js'
import { commitRoomGeometry, commitRoomSceneEdit } from './roomSceneCommit.js'
import { accountBucket, send, viewer, type Admission, type SocketAttachment } from './roomSocket.js'
import {
  NoSceneMoveToUndoError,
  SceneMoveFromActionError,
  SceneMoveSettledMechanicsError,
  publishRoomSceneUndo
} from './roomSceneUndo.js'
import { restoreRoomMoveUndo } from './roomMoveUndoRestore.js'
import { publishRoomSceneFog, publishRoomSceneInline } from './roomSceneEdits.js'
import { RoomRateLimitedError } from './roomRateLimits.js'
import { replayReceipt } from './roomSocket.js'
import { admitsRoomMember } from './roomAuthorization.js'
import type { RoomCommandHost } from './roomCommandHost.js'
import { reloadRoomAggregate, type RoomAggregateLoadHost } from './roomAggregateLoad.js'
import type { RoomSceneCommitHost } from './roomSceneCommit.js'

/** The room steps a Scene command uses. */
export type RoomSceneCommandHost = RoomSceneCommitHost &
  RoomAggregateLoadHost &
  Pick<
    RoomCommandHost,
    | 'aggregateNeedsReload'
    | 'authorization'
    | 'boundTokenControl'
    | 'broadcastSceneCommitted'
    | 'buckets'
    | 'cache'
    | 'controlledScene'
    | 'fogUploads'
    | 'inputs'
    | 'journal'
    | 'liveAdmission'
    | 'rejectCommand'
    | 'rejectRoomFailure'
    | 'rejectSceneCommand'
    | 'sceneCommittedFor'
    | 'scheduleAlarm'
    | 'setCache'
    | 'store'
  >

/**
 * Runs one live Scene command: replay and rate checks, the Scene write-set, the commit and its
 * fanout. The room has already checked the head and routed the other scopes.
 */
export async function executeSceneCommand(
  host: RoomSceneCommandHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  authorization: LiveSessionRoomAuthorization,
  message: Extract<LiveSessionWebSocketClientMessageDto, { type: 'COMMAND' }>,
  current: NonNullable<ReturnType<RoomSceneCommandHost['journal']['readCurrent']>>
): Promise<void> {
  const commandId = message.command.command.commandId
  const sceneCommand =
    message.command.scope === 'SCENE'
      ? liveSessionSceneCommandInputSchema.safeParse(message.command.command)
      : null
  // A whole fog layer exceeds the socket frame; fog is staged with SCENE_FOG_BEGIN/APPEND (D79).
  if (!sceneCommand?.success) {
    host.rejectCommand(
      socket,
      commandId,
      'INVALID_COMMAND',
      'This Scene command is not accepted live; fog changes are uploaded in batches.',
      current.sequence
    )
    return
  }
  const fingerprint = checksumCanonicalJson({
    command: message.command,
    expectedSessionSequence: message.expectedSessionSequence
  })
  const prior = host.journal.lookupCommand({
    actorId: admission.userId,
    commandId,
    fingerprint
  })
  if (prior.kind === 'MISMATCHED_REUSE') {
    host.rejectCommand(
      socket,
      commandId,
      'INVALID_COMMAND',
      'The command ID was already used for different input.',
      current.sequence
    )
    return
  }
  if (prior.kind === 'REPLAY') {
    send(socket, replayReceipt(prior.receipt.receiptJson))
    return
  }
  const command = sceneCommand.data
  if (host.aggregateNeedsReload()) {
    try {
      await reloadRoomAggregate(host, value)
    } catch (error) {
      host.rejectRoomFailure(socket, commandId, error)
      return
    }
  }
  const cached = host.cache()
  const scene = cached?.scene ?? null
  const correction = (): LiveSessionCorrectionDto | undefined =>
    scene
      ? {
          scope: 'SCENE',
          state: projectSceneForViewer(
            host.controlledScene(scene, value.authorityEpoch),
            viewer(admission),
            host.boundTokenControl(scene, admission, value.authorityEpoch)
          )
        }
      : undefined
  if (!host.buckets.admits(accountBucket('SCENE', value, admission))) {
    host.rejectCommand(
      socket,
      commandId,
      'RATE_LIMITED',
      new RoomRateLimitedError().message,
      current.sequence
    )
    return
  }
  // Moves, door changes and undo plan against the exact Scene; edits rebase over unrelated newer
  // changes and are refused only when their own target changed.
  const exactVersion =
    command.type === 'MOVE_SCENE_TOKEN' ||
    command.type === 'SET_SCENE_DOOR_STATE' ||
    command.type === 'UNDO_LAST_SCENE_MOVE'
  if (
    !scene ||
    scene.id !== command.sceneId ||
    (exactVersion
      ? scene.version !== command.expectedSceneVersion
      : command.expectedSceneVersion > scene.version)
  ) {
    host.rejectCommand(
      socket,
      commandId,
      'STALE_STATE',
      'Scene changed; the current state has been restored.',
      current.sequence,
      correction()
    )
    return
  }
  if (!cached?.presentation) {
    host.rejectCommand(
      socket,
      commandId,
      'UNAVAILABLE',
      'The presented Scene is not available yet; try again.',
      current.sequence,
      correction()
    )
    return
  }
  if (
    admission.role !== 'OWNER' &&
    (command.type === 'PUBLISH_SCENE_FOG_PATCH' ||
      command.type === 'UPSERT_SCENE_TOKEN' ||
      command.type === 'REMOVE_SCENE_TOKEN' ||
      command.type === 'UPSERT_SCENE_BARRIER' ||
      command.type === 'REMOVE_SCENE_BARRIER')
  ) {
    host.rejectCommand(socket, commandId, 'FORBIDDEN', 'Only the GM can change this Scene.')
    return
  }
  if (isInlineSceneCommand(command)) {
    try {
      await commitRoomSceneEdit(host, socket, admission, value, command, fingerprint, (base) =>
        publishRoomSceneInline({ ...base, actor: admission, command })
      )
    } catch (error) {
      host.rejectSceneCommand(socket, commandId, error, correction())
    }
    return
  }
  if (command.type === 'PUBLISH_SCENE_FOG_PATCH') {
    const uploader = {
      epoch: value.authorityEpoch,
      userId: admission.userId
    }
    try {
      await commitRoomSceneEdit(
        host,
        socket,
        admission,
        value,
        command,
        fingerprint,
        (base) =>
          publishRoomSceneFog({
            ...base,
            actorUserId: admission.userId,
            command,
            readUpload: () => host.fogUploads.read(uploader, command.saveId, command.commandId)
          }),
        () => host.fogUploads.markPublished(command.saveId.toLowerCase())
      )
    } catch (error) {
      host.rejectSceneCommand(socket, commandId, error, correction())
    }
    return
  }
  // A pending movement or reaction decision holds token moves, undo, door changes and token or
  // barrier edits on its Scene (D26).
  const holdingDecision =
    cached.encounterId === null
      ? null
      : await readSceneHoldingDecision({ db: host.store.store }, cached.encounterId)
  if (holdingDecision) {
    host.rejectCommand(
      socket,
      commandId,
      'UNAVAILABLE',
      holdingDecision === 'MOVEMENT'
        ? 'Waiting on a movement decision.'
        : 'Waiting on a reaction decision.',
      current.sequence,
      correction()
    )
    return
  }

  if (command.type === 'UNDO_LAST_SCENE_MOVE') {
    if (admission.role !== 'OWNER') {
      host.rejectCommand(
        socket,
        commandId,
        'FORBIDDEN',
        'Only the Campaign owner may undo Scene movement.'
      )
      return
    }
    try {
      await commitRoomSceneEdit(
        host,
        socket,
        admission,
        value,
        command,
        fingerprint,
        ({ transaction, authorization, scene, presentation }) =>
          publishRoomSceneUndo({
            transaction,
            userId: admission.userId,
            scene,
            request: { input: command, presentation },
            onUndone: (undoneCommandId) =>
              restoreRoomMoveUndo({
                store: host.store,
                transaction,
                inputs: host.inputs,
                authorization,
                campaignId: value.campaignId,
                epoch: value.authorityEpoch,
                userId: admission.userId,
                sceneId: command.sceneId.toLowerCase(),
                undoneCommandId
              }),
            settledEncounterMechanics: async (moveCommandId) => {
              const { store } = host.store
              const moveReceipt = await store
                .query('encounterRuleReceipts')
                .withIndex('by_campaignId_commandId', (q) =>
                  q.eq('campaignId', value.campaignId).eq('commandId', moveCommandId)
                )
                .first()
              if (moveReceipt !== null) return true
              // A move that raised a decision settles under its answer's command, so the receipt is the occurrence's.
              const occurrence = await store
                .query('encounterRuleOccurrences')
                .withIndex('by_campaignId_rootCommandId', (q) =>
                  q.eq('campaignId', value.campaignId).eq('rootCommandId', moveCommandId)
                )
                .first()
              if (!occurrence) return false
              const answered = await store
                .query('encounterRuleReceipts')
                .withIndex('by_occurrenceId', (q) => q.eq('occurrenceId', occurrence.id))
                .first()
              return answered !== null
            }
          })
      )
    } catch (error) {
      if (
        error instanceof NoSceneMoveToUndoError ||
        error instanceof SceneMoveFromActionError ||
        error instanceof SceneMoveSettledMechanicsError
      )
        host.rejectCommand(socket, commandId, 'INVALID_COMMAND', error.message)
      else host.rejectSceneCommand(socket, commandId, error, correction())
    }
    return
  }
  if (command.type !== 'MOVE_SCENE_TOKEN' && command.type !== 'SET_SCENE_DOOR_STATE') {
    try {
      await commitRoomGeometry(host, socket, admission, value, command, fingerprint)
    } catch (error) {
      host.rejectSceneCommand(socket, commandId, error, correction())
    }
    return
  }
  const plan = planLiveSceneCommand({
    actor: admission,
    assignments: authorization.campaign.assignments,
    command,
    encounterId: cached.encounterId,
    scene
  })
  if (plan.kind === 'REJECTED') {
    host.rejectCommand(
      socket,
      commandId,
      plan.code,
      plan.message,
      current.sequence,
      plan.correct ? correction() : undefined
    )
    return
  }
  if (plan.kind === 'STAGED') {
    try {
      await commitRoomGeometry(host, socket, admission, value, command, fingerprint)
    } catch (error) {
      host.rejectSceneCommand(socket, commandId, error, correction())
    }
    return
  }
  const { delta } = plan

  let nextScene: CampaignSceneStateDto
  let nextUncomposedScene: CampaignSceneStateDto
  try {
    nextScene = applySceneDelta(scene, delta, scene.version + 1)
    if (!cached.uncomposedScene || !cached.sceneHeader)
      throw new Error('Native Scene persistence inputs are unavailable.')
    nextUncomposedScene = applySceneDelta(cached.uncomposedScene, delta, scene.version + 1)
  } catch (error) {
    host.rejectCommand(
      socket,
      commandId,
      'INVALID_COMMAND',
      error instanceof Error ? error.message : 'Scene command is invalid.',
      current.sequence,
      correction()
    )
    return
  }
  const next = createNativeLiveSessionState(nextScene)
  const expectedSceneResult = sceneCommandResultDtoSchema.parse({
    commandId,
    delta,
    occurrence: null,
    replayed: false,
    sceneId: scene.id,
    version: nextScene.version
  })
  const committed = liveSessionWebSocketServerMessageDtoSchema.parse(
    host.sceneCommittedFor({
      admission,
      epoch: value.authorityEpoch,
      committed: { commandId, sequence: current.sequence + 1 },
      before: scene,
      after: nextScene,
      result: expectedSceneResult,
      occurrence: null
    })
  )
  host.store.assertAuthorityHead({
    epoch: current.authorityEpoch,
    sequence: current.sequence,
    checksum: current.stateChecksum
  })
  const saveId = crypto.randomUUID()
  const header = cached.sceneHeader!
  const rawScene = cached.uncomposedScene!
  const state = await host.store.transact(
    (transaction) =>
      Promise.resolve(
        persistRoomSceneCommand({
          transaction,
          header,
          scene: rawScene,
          baseOrdinals: cached.baseOrdinals,
          command,
          actorUserId: admission.userId,
          result: expectedSceneResult,
          presentationVersion: cached.presentation!.expectedPresentationVersion,
          saveId,
          now: Date.now()
        })
      ),
    (entry) => {
      const authorization = host.authorization.current(value.authorityEpoch)
      if (
        host.liveAdmission(socket)?.generation !== admission.generation ||
        !authorization ||
        !admitsRoomMember(authorization, admission)
      )
        throw new RoomAdmissionExpiredError()
      if (entry.sequence !== current.sequence + 1)
        throw new Error('Room command sequence does not match its authority.')
      host.buckets.charge(accountBucket('SCENE', value, admission))
      const result = host.journal.commitInTransaction({
        actorId: admission.userId,
        authorityEpoch: value.authorityEpoch,
        commandId,
        expectedSequence: current.sequence,
        expectedStateChecksum: current.stateChecksum,
        fingerprint,
        nextStateChecksum: entry.chainChecksum,
        nextStateJson: next.stateJson,
        receiptJson: JSON.stringify(committed)
      })
      if (result.kind !== 'COMMITTED')
        throw new Error('Room command unexpectedly replayed inside its write-set transaction.')
    }
  )
  host.setCache({
    ...cached,
    scene: nextScene,
    uncomposedScene: nextUncomposedScene,
    sceneHeader: {
      ...header,
      version: state.version,
      currentCounts: state.counts,
      fogLayerCount: state.fogLayerCount
    }
  })
  host.broadcastSceneCommitted(
    { commandId, sequence: current.sequence + 1 },
    scene,
    nextScene,
    expectedSceneResult,
    { socket, message: committed }
  )
  await host.scheduleAlarm()
  return
}
