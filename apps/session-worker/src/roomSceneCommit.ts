import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandRejectionCodeDto,
  type LiveSessionCorrectionDto,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionCheckpointReason } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  sceneCommandResultDtoSchema,
  type CampaignSceneStateDto,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { applySceneDelta, projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
import type {
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { DurableCommandJournal } from './durableCommandJournal.js'
import { createNativeLiveSessionState } from './nativeLiveSessionState.js'
import { LiveSessionRouteError } from './liveSessionRoutes.js'
import {
  RoomAdmissionExpiredError,
  sceneNotPresentedRejection
} from './nativeRoomEncounterCommand.js'
import type { StagedSceneCommand, StagedSceneContext } from './roomSceneGeometryPlan.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { executeRoomSceneGeometry } from './roomSceneGeometryCommand.js'
import {
  accountBucket,
  attachment,
  send,
  viewer,
  type Admission,
  type SocketAttachment,
  type TransientCache
} from './roomSocket.js'
import { readRoomSceneHeader } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import {
  readRoomSceneFogReceipt,
  RoomSceneCommandRefusal,
  type RoomSceneEditWork
} from './roomSceneEdits.js'
import { RoomSceneFogUploads } from './roomSceneFogUploads.js'
import { RoomAccountBuckets, RoomRateLimitedError } from './roomRateLimits.js'
import type { RoomSceneTokens } from './roomEncounterReadPorts.js'
import { readRoomEncounterPlayAuthorization } from './roomEncounterCommands.js'
import { admitsRoomMember, RoomAuthorization } from './roomAuthorization.js'

/**
 * What the room lends its Scene commits: its stores and rate buckets, the cached Scene, and the
 * room-level steps around a commit (aggregate reload, authorization, fanout, alarm). The room
 * builds one in its constructor; the commit functions own the transaction shape, never the room.
 */
export interface RoomSceneCommitHost {
  readonly store: RoomEncounterStore
  readonly inputs: RoomInputs
  readonly journal: DurableCommandJournal
  readonly buckets: RoomAccountBuckets
  readonly authorization: RoomAuthorization
  readonly fogUploads: RoomSceneFogUploads
  cache(): TransientCache | null
  setCache(cache: TransientCache): void
  aggregateNeedsReload(): boolean
  flushOutbox(reason: LiveSessionCheckpointReason): Promise<void>
  loadRoomAggregate(sceneId: string | null): Promise<void>
  authorizationBoundary(value: SocketAttachment): Promise<LiveSessionRoomAuthorization>
  prepareWithRetry<T>(
    authorization: LiveSessionRoomAuthorization,
    run: (
      authorization: LiveSessionRoomAuthorization,
      random: (maximum: number) => number
    ) => Promise<T>
  ): Promise<{ result: T; authorization: LiveSessionRoomAuthorization }>
  liveAdmission(socket: WebSocket): Admission | null
  sceneTokens(authorityEpoch: string): RoomSceneTokens
  liveRulesRuntime(): RulesRuntimeService
  sceneCommittedFor(input: {
    admission: Pick<Admission, 'role' | 'userId'>
    epoch: string
    committed: { commandId: string; sequence: number }
    before: CampaignSceneStateDto
    after: CampaignSceneStateDto
    result: SceneCommandResultDto
    occurrence: SceneCommandResultDto['occurrence']
  }): LiveSessionWebSocketServerMessageDto
  broadcastSceneCommitted(
    committed: { commandId: string; sequence: number },
    before: CampaignSceneStateDto,
    after: CampaignSceneStateDto,
    result: SceneCommandResultDto,
    sender: { socket: WebSocket; message: LiveSessionWebSocketServerMessageDto }
  ): void
  broadcastStateSync(): void
  scheduleAlarm(): Promise<void>
  rejectCommand(
    socket: WebSocket,
    commandId: string,
    code: LiveSessionCommandRejectionCodeDto,
    message: string,
    currentSequence?: number,
    correction?: LiveSessionCorrectionDto
  ): void
  controlledScene(scene: CampaignSceneStateDto, authorityEpoch: string): CampaignSceneStateDto
  boundTokenControl(
    scene: CampaignSceneStateDto,
    admission: Pick<Admission, 'role' | 'userId'>,
    authorityEpoch: string
  ): ReadonlyMap<string, boolean>
}

/**
 * A movement decision's answer or GM void commits through the room with its presented Scene
 * (D27); a decision off the presented Scene is refused (D42).
 */
export async function commitMovementDecision(
  host: RoomSceneCommitHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto,
  fingerprint: string
): Promise<EncounterCommandResultDto> {
  const presented = host.cache()
  if (presented && presented.encounterId !== command.encounterId.toLowerCase())
    throw sceneNotPresentedRejection()
  const { encounter } = await commitRoomGeometry(
    host,
    socket,
    admission,
    value,
    command,
    fingerprint
  )
  if (!encounter) throw new Error('A movement decision commit returned no Encounter result.')
  return encounter
}

/**
 * Stages one step of a GM fog patch (D79). Staging is not Scene state, so it neither journals nor
 * charges; the SCENE bucket must admit each step, and `PUBLISH_SCENE_FOG_PATCH` charges and
 * commits. A begin whose command already published reports that publication.
 */
export async function stageSceneFog(
  host: RoomSceneCommitHost,
  socket: WebSocket,
  admission: Admission,
  message: Extract<
    LiveSessionWebSocketClientMessageDto,
    { type: 'SCENE_FOG_BEGIN' | 'SCENE_FOG_APPEND' }
  >
): Promise<void> {
  if (host.liveAdmission(socket)?.generation !== admission.generation) return
  const value = attachment(socket)
  const current = host.journal.readCurrent()
  const commandId = message.type === 'SCENE_FOG_BEGIN' ? message.input.commandId : message.commandId
  if (
    !value ||
    !current ||
    current.authorityEpoch !== value.authorityEpoch ||
    current.status !== 'ACTIVE'
  ) {
    host.rejectCommand(socket, commandId, 'AUTHORITY_CHANGED', 'Live Session authority changed.')
    return
  }
  if (admission.role !== 'OWNER') {
    host.rejectCommand(socket, commandId, 'FORBIDDEN', 'Only the GM can change this Scene.')
    return
  }
  if (!host.buckets.admits(accountBucket('SCENE', value, admission))) {
    host.rejectCommand(socket, commandId, 'RATE_LIMITED', new RoomRateLimitedError().message)
    return
  }
  const uploader = { epoch: value.authorityEpoch, userId: admission.userId }
  try {
    if (message.type === 'SCENE_FOG_APPEND') {
      send(socket, {
        type: 'SCENE_FOG_PROGRESS',
        progress: host.fogUploads.append(uploader, commandId, message.input)
      })
      return
    }
    const { input } = message
    const scene = host.cache()?.scene ?? null
    if (!scene || scene.id !== input.sceneId || input.expectedSceneVersion > scene.version) {
      host.rejectCommand(
        socket,
        commandId,
        'STALE_STATE',
        'Scene changed; the current state has been restored.',
        current.sequence,
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
      )
      return
    }
    if (scene.fogMode === 'OFF')
      throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Fog of war is off for this Scene.')
    const published = await host.store.transact(async (transaction) =>
      readRoomSceneFogReceipt(transaction, input.sceneId, commandId)
    )
    if (published && published.inputChecksum !== checksumCanonicalJson(input))
      throw new RoomSceneCommandRefusal(
        'INVALID_COMMAND',
        'Command ID was already used with different input.'
      )
    send(socket, {
      type: 'SCENE_FOG_PROGRESS',
      progress: published
        ? {
            saveId: published.result.patch.saveId,
            sceneId: published.sceneId,
            commandId: published.commandId,
            status: 'PUBLISHED',
            receivedChunks: published.input.chunkManifest.length,
            totalChunks: published.input.chunkManifest.length
          }
        : host.fogUploads.begin(uploader, input)
    })
    await host.scheduleAlarm()
  } catch (error) {
    if (!(error instanceof RoomSceneCommandRefusal)) throw error
    host.rejectCommand(socket, commandId, error.code, error.message)
  }
}

/**
 * An undo, inline edit or fog publication: its Scene rows, recomposed vision, replay evidence and
 * acknowledgement commit in one SQLite transaction (D79).
 */
export async function commitRoomSceneEdit(
  host: RoomSceneCommitHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: { sceneId: string; commandId: string },
  fingerprint: string,
  edit: RoomSceneEditWork,
  /** Runs inside the durable commit, with the journal receipt. */
  onDurable?: () => void
): Promise<void> {
  if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
  await host.loadRoomAggregate(command.sceneId)
  const cache = host.cache()
  const current = host.journal.readCurrent()
  if (
    !cache?.scene ||
    !cache.uncomposedScene ||
    !cache.presentation ||
    !current ||
    current.authorityEpoch !== value.authorityEpoch
  )
    throw new LiveSessionRouteError(409)
  const before = cache.scene
  const authorization = await host.authorizationBoundary(value)
  if (!admitsRoomMember(authorization, admission)) throw new RoomAdmissionExpiredError()
  host.store.assertAuthorityHead({
    epoch: current.authorityEpoch,
    sequence: current.sequence,
    checksum: current.stateChecksum
  })
  let receipt: LiveSessionWebSocketServerMessageDto | null = null
  let nextStateJson: string | null = null
  const sequence = current.sequence + 1
  const { result: committed } = await host.prepareWithRetry(authorization, (prepared) =>
    host.store.transact(
      async (transaction) => {
        const edited = await edit({
          transaction,
          authorization: prepared,
          scene: cache.uncomposedScene!,
          presentation: cache.presentation!
        })
        const composition = await composeRoomSceneVision({
          store: host.store,
          transaction,
          inputs: host.inputs,
          authorization: prepared,
          campaignId: value.campaignId,
          epoch: value.authorityEpoch,
          scene: edited.scene
        })
        nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
        receipt = liveSessionWebSocketServerMessageDtoSchema.parse(
          host.sceneCommittedFor({
            admission,
            epoch: value.authorityEpoch,
            committed: { commandId: command.commandId, sequence },
            before,
            after: composition.scene,
            result: edited.result,
            occurrence: null
          })
        )
        return { ...edited, composition, receipt }
      },
      (entry) => {
        const latest = host.authorization.current(value.authorityEpoch)
        if (
          !latest ||
          host.liveAdmission(socket)?.generation !== admission.generation ||
          !admitsRoomMember(latest, admission) ||
          checksumCanonicalJson(latest.revisions) !== checksumCanonicalJson(prepared.revisions) ||
          host.cache()?.scene?.id !== before.id ||
          host.cache()?.scene?.version !== before.version ||
          host.cache()?.presentation?.expectedPresentationVersion !==
            cache.presentation!.expectedPresentationVersion
        )
          throw new RoomAdmissionExpiredError()
        if (!receipt || !nextStateJson || entry.sequence !== sequence)
          throw new Error('Room Scene edit sequence does not match its authority.')
        host.buckets.charge(accountBucket('SCENE', value, admission))
        onDurable?.()
        const result = host.journal.commitInTransaction({
          actorId: admission.userId,
          authorityEpoch: value.authorityEpoch,
          commandId: command.commandId,
          fingerprint,
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson,
          receiptJson: JSON.stringify(receipt)
        })
        if (result.kind !== 'COMMITTED')
          throw new Error('Room Scene edit unexpectedly replayed inside its transaction.')
      }
    )
  )
  host.setCache({
    ...cache,
    scene: committed.composition.scene,
    uncomposedScene: committed.scene,
    sceneHeader: committed.header,
    characterRevisions: committed.composition.characterRevisions
  })
  host.broadcastSceneCommitted(
    { commandId: command.commandId, sequence },
    before,
    committed.composition.scene,
    committed.result,
    { socket, message: committed.receipt }
  )
  if (committed.fogChanged) host.broadcastStateSync()
  await host.scheduleAlarm()
}

/** Geometry, fog, rules, replay evidence and acknowledgement commit in one SQLite transaction. */
export async function commitRoomGeometry(
  host: RoomSceneCommitHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: StagedSceneCommand,
  fingerprint: string
) {
  if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
  await host.loadRoomAggregate(host.cache()?.scene?.id ?? null)
  const context = stagedSceneContext(host)
  if (!context) throw new LiveSessionRouteError(409)
  const before = context.scene
  const cache = host.cache()!
  if (!cache.uncomposedScene) throw new Error('Native Scene persistence inputs are unavailable.')
  const current = host.journal.readCurrent()
  if (
    !current ||
    current.authorityEpoch !== value.authorityEpoch ||
    host.cache()?.scene?.id !== before.id ||
    host.cache()?.scene?.version !== before.version
  )
    throw new LiveSessionRouteError(409)
  const authorization = await host.authorizationBoundary(value)
  if (
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
  // A movement decision stores both messages its sender is sent: the Scene receipt, then the Encounter result.
  let receipt:
    | LiveSessionWebSocketServerMessageDto
    | [LiveSessionWebSocketServerMessageDto, LiveSessionWebSocketServerMessageDto]
    | null = null
  let nextStateJson: string | null = null
  const { result: committed } = await host.prepareWithRetry(authorization, (prepared, random) =>
    host.store.transact(
      async (transaction) => {
        const result = await executeRoomSceneGeometry({
          store: host.store,
          transaction,
          inputs: host.inputs,
          authorization: prepared,
          campaignId: value.campaignId,
          epoch: value.authorityEpoch,
          userId: admission.userId,
          command,
          context,
          sceneTokens: host.sceneTokens(value.authorityEpoch),
          runtime: host.liveRulesRuntime(),
          random
        })
        // The fog patches are written by their owners; the acknowledged DTO carries none.
        const scene = sceneCommandResultDtoSchema.parse({
          commandId: result.scene.commandId,
          delta: result.scene.delta,
          occurrence: result.scene.occurrence,
          replayed: result.scene.replayed,
          sceneId: result.scene.sceneId,
          version: result.scene.version
        })
        const raw = result.scene.delta
          ? applySceneDelta(cache.uncomposedScene!, result.scene.delta, result.nextScene.version)
          : cache.uncomposedScene!
        const uncomposedScene = {
          ...raw,
          version: result.nextScene.version,
          fogLayers: result.nextScene.fogLayers
        }
        const composition = await composeRoomSceneVision({
          store: host.store,
          transaction,
          inputs: host.inputs,
          authorization: prepared,
          campaignId: value.campaignId,
          epoch: value.authorityEpoch,
          scene: uncomposedScene
        })
        nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
        const sent = liveSessionWebSocketServerMessageDtoSchema.parse(
          host.sceneCommittedFor({
            admission,
            epoch: value.authorityEpoch,
            committed: { commandId: command.commandId, sequence },
            before,
            after: composition.scene,
            result: scene,
            occurrence: scene.occurrence
          })
        )
        // Only a movement decision commits an Encounter result; a Scene command's retry replays one message.
        if (
          (command.type === 'RESOLVE_RULE_OCCURRENCE' ||
            command.type === 'VOID_RULE_OCCURRENCE') !==
          (result.encounter !== null)
        )
          throw new Error('Only a movement decision commits an Encounter result.')
        receipt = result.encounter
          ? [
              sent,
              liveSessionWebSocketServerMessageDtoSchema.parse({
                commandId: command.commandId,
                delta: { scope: 'ENCOUNTER', result: result.encounter },
                sequence,
                type: 'COMMAND_COMMITTED'
              })
            ]
          : sent
        return {
          ...result,
          scene,
          sent,
          nextScene: composition.scene,
          uncomposedScene,
          characterRevisions: composition.characterRevisions,
          header: readRoomSceneHeader(transaction, before.id),
          play: await readRoomEncounterPlayAuthorization(
            { db: host.store.store },
            value.campaignId,
            prepared.play,
            before.id
          )
        }
      },
      (entry) => {
        const latest = host.authorization.current(value.authorityEpoch)
        if (
          host.liveAdmission(socket)?.generation !== admission.generation ||
          !latest ||
          checksumCanonicalJson(latest.revisions) !== checksumCanonicalJson(prepared.revisions) ||
          !admitsRoomMember(latest, admission) ||
          host.cache()?.scene?.id !== before.id ||
          host.cache()?.scene?.version !== before.version ||
          host.cache()?.presentation?.expectedPresentationVersion !==
            context.presentation.expectedPresentationVersion
        )
          throw new RoomAdmissionExpiredError()
        if (!receipt || !nextStateJson || entry.sequence !== sequence)
          throw new Error('Room command sequence does not match its authority.')
        host.buckets.charge(accountBucket('SCENE', value, admission))
        const result = host.journal.commitInTransaction({
          actorId: admission.userId,
          authorityEpoch: value.authorityEpoch,
          commandId: command.commandId,
          fingerprint,
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson,
          receiptJson: JSON.stringify(receipt)
        })
        if (result.kind !== 'COMMITTED')
          throw new Error('Room command unexpectedly replayed inside its write-set transaction.')
      }
    )
  )
  if (committed.play) host.authorization.applyPlay(value.authorityEpoch, committed.play)
  host.setCache({
    ...cache,
    scene: committed.nextScene,
    uncomposedScene: committed.uncomposedScene,
    characterRevisions: committed.characterRevisions,
    sceneHeader: committed.header
  })
  host.broadcastSceneCommitted(
    { commandId: command.commandId, sequence },
    before,
    committed.nextScene,
    committed.scene,
    { socket, message: committed.sent }
  )
  if (committed.fogChanged || !equalCanonicalJson(before.tokens, committed.nextScene.tokens))
    host.broadcastStateSync()
  await host.scheduleAlarm()
  return committed
}

/** The room's presented Scene that geometry commands plan against; null while none is presented. */
function stagedSceneContext(host: RoomSceneCommitHost): StagedSceneContext | null {
  const cached = host.cache()
  if (!cached?.scene || !cached.presentation) return null
  return {
    scene: cached.scene,
    baseOrdinals: cached.baseOrdinals,
    characterRevisions: cached.characterRevisions,
    presentation: cached.presentation
  }
}
