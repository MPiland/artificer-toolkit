import {
  createDb,
  createReusableDefinitionRepository,
  withUserContext
} from '@artificer-toolkit/db'
import {
  claimLiveSessionRoomCommandAuthority,
  executeLiveSessionCommand,
  loadLiveSessionRoomSnapshot,
  releaseLiveSessionRoomCommandAuthority,
  renewLiveSessionRoomCommandAuthority,
  type LiveSessionCommandExecution,
  type LiveSessionRoomSnapshot
} from '@artificer-toolkit/functions/services'
import {
  createPlatformRulesRuntime,
  createReusableDefinitionRuntimeSource,
  deriveRulesRuntimeContinuationIntegrityKey
} from '@artificer-toolkit/functions/services/rules'
import { type RulesRuntimeService } from '@artificer-toolkit/functions/services/rules'
import { resolveSessionHostTicketSecret } from './config.js'
import type {
  LiveSessionActiveMembershipDto,
  LiveSessionAggregateVersionDto,
  LiveSessionCommandDto,
  LiveSessionJoinOptionsDto,
  LiveSessionSceneVisionContextDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type {
  CharacterSheetCommittedRuleSnapshot,
  CharacterSheetCommandServiceTiming
} from '@artificer-toolkit/functions/services/character'
import type {
  EncounterActorRuleSnapshot,
  EncounterCommandServiceTiming
} from '@artificer-toolkit/functions/services/encounter'

export interface LiveSessionRoomDependencies {
  loadSnapshot(userId: string, options: LiveSessionJoinOptionsDto): Promise<LiveSessionRoomSnapshot>
  claimAuthority(
    userId: string,
    options: LiveSessionJoinOptionsDto,
    authorityId: string
  ): Promise<void>
  renewAuthority(
    userId: string,
    options: LiveSessionJoinOptionsDto,
    authorityId: string
  ): Promise<{
    aggregateVersions: LiveSessionAggregateVersionDto[]
    memberships: LiveSessionActiveMembershipDto[]
  }>
  releaseAuthority(
    userId: string,
    options: LiveSessionJoinOptionsDto,
    authorityId: string
  ): Promise<void>
  execute(
    userId: string,
    options: LiveSessionJoinOptionsDto,
    command: LiveSessionCommandDto,
    authorityId: string,
    sceneVisionContext: LiveSessionSceneVisionContextDto,
    committedRuleSnapshot?: CharacterSheetCommittedRuleSnapshot,
    committedEncounterRuleSnapshot?: EncounterActorRuleSnapshot,
    rulesRuntime?: RulesRuntimeService
  ): Promise<LiveSessionCommandExecution>
  dispose?(): Promise<void>
}

export interface LiveSessionCharacterCommandTiming {
  commandId: string
  service: CharacterSheetCommandServiceTiming
}

export interface LiveSessionEncounterCommandTiming {
  commandId: string
  service: EncounterCommandServiceTiming
}

export interface LiveSessionSceneCommandTiming {
  commandId: string
  totalMs: number
}

export interface CreateLiveSessionRoomDependenciesOptions {
  ticketSecret?: string
  rulesRuntime?: RulesRuntimeService
  onCharacterCommandTiming?: (timing: LiveSessionCharacterCommandTiming) => void
  onEncounterCommandTiming?: (timing: LiveSessionEncounterCommandTiming) => void
  onSceneCommandTiming?: (timing: LiveSessionSceneCommandTiming) => void
}

export function createLiveSessionRoomDependencies(
  options: CreateLiveSessionRoomDependenciesOptions = {}
): LiveSessionRoomDependencies {
  const db = createDb()
  const rulesRuntime =
    options.rulesRuntime ??
    createPlatformRulesRuntime({
      continuationIntegrityKey: deriveRulesRuntimeContinuationIntegrityKey(
        resolveSessionHostTicketSecret(options.ticketSecret)
      ),
      definitions: createReusableDefinitionRuntimeSource(createReusableDefinitionRepository(db))
    })
  return {
    loadSnapshot: (userId, options) =>
      withUserContext(db, userId, (scopedDb) =>
        loadLiveSessionRoomSnapshot(scopedDb, userId, options)
      ),
    claimAuthority: (userId, roomOptions, authorityId) =>
      withUserContext(db, userId, (scopedDb) =>
        claimLiveSessionRoomCommandAuthority(scopedDb, userId, roomOptions, authorityId)
      ),
    renewAuthority: (userId, roomOptions, authorityId) =>
      withUserContext(db, userId, (scopedDb) =>
        renewLiveSessionRoomCommandAuthority(scopedDb, userId, roomOptions, authorityId)
      ),
    releaseAuthority: (userId, roomOptions, authorityId) =>
      withUserContext(db, userId, (scopedDb) =>
        releaseLiveSessionRoomCommandAuthority(scopedDb, roomOptions, authorityId)
      ),
    execute: (
      userId,
      roomOptions,
      command,
      authorityId,
      sceneVisionContext,
      committedRuleSnapshot,
      committedEncounterRuleSnapshot,
      injectedRulesRuntime
    ) => {
      const startedAt = command.aggregateKind === 'SCENE' ? performance.now() : null
      return withUserContext(
        db,
        userId,
        (scopedDb) =>
          executeLiveSessionCommand(
            scopedDb,
            userId,
            roomOptions,
            command,
            authorityId,
            sceneVisionContext,
            committedRuleSnapshot,
            (service) =>
              options.onCharacterCommandTiming?.({
                commandId: command.command.commandId,
                service
              }),
            committedEncounterRuleSnapshot,
            (service) =>
              options.onEncounterCommandTiming?.({
                commandId: command.command.commandId,
                service
              }),
            injectedRulesRuntime ?? rulesRuntime
          ),
        {
          operation: `LIVE_${command.aggregateKind}`,
          traceId: command.command.commandId
        }
      ).finally(() => {
        if (startedAt !== null) {
          options.onSceneCommandTiming?.({
            commandId: command.command.commandId,
            totalMs: performance.now() - startedAt
          })
        }
      })
    },
    dispose: () => db.destroy()
  }
}
