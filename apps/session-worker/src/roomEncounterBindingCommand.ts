import { replayReceipt } from './roomSocket.js'
import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { type BindEncounterToPresentedSceneInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createNativeLiveSessionState } from './nativeLiveSessionState.js'
import { LiveSessionRouteError } from './liveSessionRoutes.js'
import { RoomAdmissionExpiredError } from './nativeRoomEncounterCommand.js'
import { send, type Admission, type SocketAttachment } from './roomSocket.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { executeRoomSceneBinding } from './roomSceneBinding.js'
import { admitsRoomMember } from './roomAuthorization.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** The room steps an Encounter binding uses. */
export type RoomEncounterBindingHost = Pick<
  RoomCommandHost,
  | 'aggregateNeedsReload'
  | 'authorization'
  | 'authorizationBoundary'
  | 'broadcastStateSync'
  | 'cache'
  | 'flushOutbox'
  | 'inputs'
  | 'journal'
  | 'liveAdmission'
  | 'loadRoomAggregate'
  | 'prepareWithRetry'
  | 'rejectCommand'
  | 'rejectSceneCommand'
  | 'scheduleAlarm'
  | 'setCache'
  | 'store'
  | 'webSockets'
>

/** The GM's binding, native controls and room receipt commit together before fanout. */
export async function executeEncounterBinding(
  host: RoomEncounterBindingHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: BindEncounterToPresentedSceneInputDto
): Promise<void> {
  const commandId = command.commandId
  const fingerprint = checksumCanonicalJson({
    command,
    scope: 'ENCOUNTER_BINDING'
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
      'The command ID was already used for different input.'
    )
    return
  }
  if (prior.kind === 'REPLAY') {
    send(socket, replayReceipt(prior.receipt.receiptJson))
    return
  }
  if (admission.role !== 'OWNER') {
    send(socket, {
      code: 'DOMAIN_REJECTED',
      commandId,
      currentSequence: host.journal.readCurrent()?.sequence ?? 0,
      message: DOMAIN_REJECTION_MESSAGES.GM_ONLY,
      reason: 'GM_ONLY',
      warnings: null,
      type: 'COMMAND_REJECTED'
    })
    return
  }
  const cached = host.cache()
  if (!cached?.scene || !cached.presentation) {
    host.rejectCommand(
      socket,
      commandId,
      'UNAVAILABLE',
      'The presented Scene is not available yet; try again.'
    )
    return
  }
  const sceneId = cached.scene.id
  const { presentation } = cached
  try {
    if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
    await host.loadRoomAggregate(sceneId)
    const current = host.journal.readCurrent()
    if (!current || current.authorityEpoch !== value.authorityEpoch)
      throw new LiveSessionRouteError(409)
    const authorization = await host.authorizationBoundary(value)
    if (
      !cached.uncomposedScene ||
      host.liveAdmission(socket)?.generation !== admission.generation ||
      !admitsRoomMember(authorization, admission)
    )
      throw new RoomAdmissionExpiredError()
    host.store.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const sequence = current.sequence + 1
    let receipt: LiveSessionWebSocketServerMessageDto | null = null
    let nextStateJson: string | null = null
    const { result, authorization: committedAuthorization } = await host.prepareWithRetry(
      authorization,
      (prepared) =>
        host.store.transact(
          async (transaction) => {
            const bound = await executeRoomSceneBinding({
              store: host.store,
              transaction,
              inputs: host.inputs,
              authorization: prepared,
              campaignId: value.campaignId,
              epoch: value.authorityEpoch,
              userId: admission.userId,
              sceneId,
              expectedPresentationVersion: presentation.expectedPresentationVersion,
              command
            })
            const encounterId = bound.play
              ? (bound.play.encounter?.encounterId ?? null)
              : cached.encounterId
            const composition = await composeRoomSceneVision({
              store: host.store,
              transaction,
              inputs: host.inputs,
              authorization: prepared,
              campaignId: value.campaignId,
              epoch: value.authorityEpoch,
              scene: cached.uncomposedScene!
            })
            nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
            receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
              commandId,
              delta: { scope: 'ENCOUNTER_BINDING', result: bound.result },
              sequence,
              type: 'COMMAND_COMMITTED'
            })
            return { ...bound, encounterId, composition }
          },
          (entry) => {
            const latest = host.authorization.current(value.authorityEpoch)
            if (
              !latest ||
              host.liveAdmission(socket)?.generation !== admission.generation ||
              !admitsRoomMember(latest, admission) ||
              checksumCanonicalJson(latest.revisions) !==
                checksumCanonicalJson(prepared.revisions) ||
              host.cache()?.scene?.id !== sceneId ||
              host.cache()?.presentation?.expectedPresentationVersion !==
                presentation.expectedPresentationVersion
            )
              throw new RoomAdmissionExpiredError()
            if (!receipt || !nextStateJson || entry.sequence !== sequence)
              throw new Error('Room binding sequence does not match its authority.')
            const committed = host.journal.commitInTransaction({
              actorId: admission.userId,
              authorityEpoch: value.authorityEpoch,
              commandId,
              fingerprint,
              expectedSequence: current.sequence,
              expectedStateChecksum: current.stateChecksum,
              nextStateChecksum: entry.chainChecksum,
              nextStateJson,
              receiptJson: JSON.stringify(receipt)
            })
            if (committed.kind !== 'COMMITTED')
              throw new Error('Room binding unexpectedly replayed inside its transaction.')
          }
        )
    )
    if (result.play) host.authorization.applyPlay(value.authorityEpoch, result.play)
    host.setCache({
      ...cached,
      encounterId: result.encounterId,
      scene: result.composition.scene,
      characterRevisions: result.composition.characterRevisions
    })
    if (!receipt) throw new Error('Committed room binding receipt is unavailable.')
    for (const member of host.webSockets()) {
      const active = host.liveAdmission(member)
      if (active && admitsRoomMember(committedAuthorization, active)) send(member, receipt)
    }
    host.broadcastStateSync()
    await host.scheduleAlarm()
  } catch (error) {
    host.rejectSceneCommand(socket, commandId, error, undefined)
  }
}
