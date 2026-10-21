import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import {
  type LiveSessionCommandRejectionCodeDto,
  type LiveSessionCorrectionDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionRoomSceneCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionCheckpointReason } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  type CampaignSceneStateDto,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { DurableCommandJournal } from './durableCommandJournal.js'
import type { SessionWorkerEnvironment } from './environment.js'
import { RoomCheckpoints } from './roomCheckpoints.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { type Admission, type SocketAttachment, type TransientCache } from './roomSocket.js'
import { RoomSceneFogUploads } from './roomSceneFogUploads.js'
import { RoomAccountBuckets } from './roomRateLimits.js'
import type { RoomSceneTokens } from './roomEncounterReadPorts.js'
import { RoomAuthorization } from './roomAuthorization.js'

/**
 * What the room lends the modules that run its commands: its stores and rate buckets, the cached
 * Scene, and the room-level steps around a commit (aggregate reload, authorization, fanout, alarm).
 * The room builds one in its constructor; a module declares the `Pick` of it that it uses, so its
 * port stays narrow and each capability has one definition.
 */
export interface RoomCommandHost {
  readonly env: SessionWorkerEnvironment
  readonly storage: DurableObjectStorage
  readonly checkpoints: RoomCheckpoints
  readonly store: RoomEncounterStore
  readonly inputs: RoomInputs
  readonly journal: DurableCommandJournal
  readonly buckets: RoomAccountBuckets
  readonly authorization: RoomAuthorization
  readonly fogUploads: RoomSceneFogUploads
  cache(): TransientCache | null
  setCache(cache: TransientCache | null): void
  aggregateNeedsReload(): boolean
  setAggregateNeedsReload(value: boolean): void
  refreshSceneCache(
    value: SocketAttachment,
    serialized?: boolean
  ): Promise<LiveSessionRoomSceneCapture | null>
  roomCampaignId(): string | null
  bumpCacheGeneration(): void
  challenge(socket: WebSocket, expectedGeneration?: number): void
  flushOutbox(reason: LiveSessionCheckpointReason): Promise<void>
  loadRoomAggregate(sceneId: string | null): Promise<void>
  authorizationBoundary(
    value: Pick<SocketAttachment, 'authorityEpoch'>
  ): Promise<LiveSessionRoomAuthorization>
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
  webSockets(): WebSocket[]
  /** Resolves once the commands already queued have run. */
  commandsSettled(): Promise<void>
  /** Runs `run` after the queued commands, and holds later commands behind it. */
  afterCommands<T>(run: () => Promise<T>): Promise<T>
  /** The outbox flush in flight, if any. */
  outboxFlushing(): Promise<void> | null
  closeRoomSockets(reason: string): void
  waitUntil(work: Promise<unknown>): void
  presentationChanging(): boolean
  random(maximum: number): number
  checkpointThrough(
    epoch: string,
    sequence: number,
    reason: LiveSessionCheckpointReason
  ): Promise<void>
  rejectRoomFailure(socket: WebSocket, commandId: string, error: unknown, message?: string): void
  rejectSceneCommand(
    socket: WebSocket,
    commandId: string,
    error: unknown,
    correction: LiveSessionCorrectionDto | undefined
  ): void
  sendDomainRejection(
    socket: WebSocket,
    commandId: string,
    error: EncounterDomainRejection | LiveSessionDomainRejectionError,
    correction?: LiveSessionCorrectionDto
  ): void
  controlledScene(scene: CampaignSceneStateDto, authorityEpoch: string): CampaignSceneStateDto
  boundTokenControl(
    scene: CampaignSceneStateDto,
    admission: Pick<Admission, 'role' | 'userId'>,
    authorityEpoch: string
  ): ReadonlyMap<string, boolean>
}
