import { createDb, withUserContext } from '@artificer-toolkit/db'
import {
  authenticateLiveSessionToken,
  authorizeLiveSessionAdmission,
  claimLiveSessionRoomCommandAuthority,
  executeLiveSessionCommand,
  loadLiveSessionRoomSnapshot,
  releaseLiveSessionRoomCommandAuthority,
  renewLiveSessionRoomCommandAuthority,
  type LiveSessionCommandExecution,
  type LiveSessionRoomSnapshot
} from '@artificer-toolkit/functions/services'
import type {
  LiveSessionCommandDto,
  LiveSessionJoinOptionsDto
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
  authenticate(token: string): Promise<string>
  authorize(userId: string, options: LiveSessionJoinOptionsDto): Promise<void>
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
  ): Promise<void>
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
    committedRuleSnapshot?: CharacterSheetCommittedRuleSnapshot,
    committedEncounterRuleSnapshot?: EncounterActorRuleSnapshot
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

export interface CreateLiveSessionRoomDependenciesOptions {
  onCharacterCommandTiming?: (timing: LiveSessionCharacterCommandTiming) => void
  onEncounterCommandTiming?: (timing: LiveSessionEncounterCommandTiming) => void
}

export function createLiveSessionRoomDependencies(
  options: CreateLiveSessionRoomDependenciesOptions = {}
): LiveSessionRoomDependencies {
  const db = createDb()
  return {
    authenticate: authenticateLiveSessionToken,
    authorize: async (userId, options) => {
      await withUserContext(db, userId, async (scopedDb) => {
        await authorizeLiveSessionAdmission(scopedDb, userId, options)
      })
    },
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
        renewLiveSessionRoomCommandAuthority(scopedDb, roomOptions, authorityId)
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
      committedRuleSnapshot,
      committedEncounterRuleSnapshot
    ) =>
      withUserContext(db, userId, (scopedDb) =>
        executeLiveSessionCommand(
          scopedDb,
          userId,
          roomOptions,
          command,
          authorityId,
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
            })
        )
      ),
    dispose: () => db.destroy()
  }
}
