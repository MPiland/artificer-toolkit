import { Room, type Client } from '@colyseus/core'
import { defineTypes, MapSchema, Schema } from '@colyseus/schema'
import {
  LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS,
  type LiveSessionCommandExecution
} from '@artificer-toolkit/functions/services'
import type { CharacterSheetCommittedRuleSnapshot } from '@artificer-toolkit/functions/services/character'
import type { EncounterActorRuleSnapshot } from '@artificer-toolkit/functions/services/encounter'
import {
  LIVE_SESSION_COMMAND_MESSAGE,
  LIVE_SESSION_COMMITTED_MESSAGE,
  LIVE_SESSION_READY_MESSAGE,
  LIVE_SESSION_REJECTED_MESSAGE,
  LIVE_SESSION_RESULT_MESSAGE,
  liveSessionCommandDtoSchema,
  liveSessionJoinOptionsDtoSchema,
  type LiveSessionCommittedDto,
  type LiveSessionJoinOptionsDto,
  type LiveSessionReadyDto,
  type LiveSessionRejectedDto,
  type LiveSessionResultDto
} from '@artificer-toolkit/schema/api/liveSessions'

import type { LiveSessionRoomDependencies } from './dependencies.js'
import { LiveSessionCommandCoordinator } from './liveSessionCommandCoordinator.js'

export class LiveSessionAggregateVersionState extends Schema {
  declare aggregateKind: string
  declare aggregateId: string
  declare version: number

  constructor() {
    super()
    this.aggregateKind = ''
    this.aggregateId = ''
    this.version = 0
  }
}

defineTypes(LiveSessionAggregateVersionState, {
  aggregateKind: 'string',
  aggregateId: 'string',
  version: 'number'
})

export class LiveSessionState extends Schema {
  declare roomVersion: number
  declare aggregateVersions: MapSchema<LiveSessionAggregateVersionState>

  constructor() {
    super()
    this.roomVersion = 0
    this.aggregateVersions = new MapSchema<LiveSessionAggregateVersionState>()
  }
}

defineTypes(LiveSessionState, {
  roomVersion: 'number',
  aggregateVersions: { map: LiveSessionAggregateVersionState }
})

export interface LiveSessionAuth {
  userId: string
  options: LiveSessionJoinOptionsDto
}

type LiveSessionClient = Client<{
  auth: LiveSessionAuth
  messages: {
    [LIVE_SESSION_READY_MESSAGE]: LiveSessionReadyDto
    [LIVE_SESSION_COMMITTED_MESSAGE]: LiveSessionCommittedDto
    [LIVE_SESSION_RESULT_MESSAGE]: LiveSessionResultDto
    [LIVE_SESSION_REJECTED_MESSAGE]: LiveSessionRejectedDto
  }
}>

export interface LiveSessionRoomOptions {
  state: LiveSessionState
  client: LiveSessionClient
}

function aggregateKey(kind: 'CHARACTER' | 'ENCOUNTER', id: string): string {
  return `${kind}:${id}`
}

function commandFailure(error: unknown, commandId: string): LiveSessionRejectedDto {
  const name = error instanceof Error ? error.name : ''
  if (name === 'CampaignAccessError' || name === 'LiveSessionAuthenticationError') {
    return {
      commandId,
      code: 'UNAUTHORIZED',
      message: 'This live-session command is not authorized.'
    }
  }
  if (name === 'ConcurrencyError' || name === 'EncounterConflictError') {
    return {
      commandId,
      code: 'STALE_VERSION',
      message: 'The aggregate changed before this command was applied.'
    }
  }
  const message = error instanceof Error ? error.message.trim() : ''
  return {
    commandId,
    code: 'COMMAND_FAILED',
    message: (message || 'The live-session command failed.').slice(0, 300)
  }
}

export interface LiveSessionRoomConstructor {
  new (): Room<LiveSessionRoomOptions>
  onAuth(token: string, rawOptions: unknown): Promise<LiveSessionAuth>
}

export function createLiveSessionRoomClass(
  dependencies: LiveSessionRoomDependencies
): LiveSessionRoomConstructor {
  return class LiveSessionRoom extends Room<LiveSessionRoomOptions> {
    #options!: LiveSessionJoinOptionsDto
    #coordinator: LiveSessionCommandCoordinator<LiveSessionCommandExecution> | null = null
    #hydration: Promise<void> | null = null
    #characterRuleSnapshots = new Map<string, CharacterSheetCommittedRuleSnapshot>()
    #encounterRuleSnapshots = new Map<string, EncounterActorRuleSnapshot>()
    #authorityUserId: string | null = null
    #authorityClaimed = false
    #authorityHeartbeat: ReturnType<typeof setInterval> | null = null

    static async onAuth(token: string, rawOptions: unknown): Promise<LiveSessionAuth> {
      const options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
      const userId = await dependencies.authenticate(token)
      await dependencies.authorize(userId, options)
      return { userId, options }
    }

    onCreate(rawOptions: unknown): void {
      this.#options = liveSessionJoinOptionsDtoSchema.parse(rawOptions)
      this.setState(new LiveSessionState())
      this.onMessage(LIVE_SESSION_COMMAND_MESSAGE, (client, rawCommand: unknown) => {
        const parsed = liveSessionCommandDtoSchema.safeParse(rawCommand)
        if (!parsed.success) {
          client.send(LIVE_SESSION_REJECTED_MESSAGE, {
            commandId: null,
            code: 'INVALID_COMMAND',
            message: 'The live-session command is invalid.'
          })
          return
        }
        void this.#execute(client, parsed.data)
      })
    }

    async onJoin(client: LiveSessionClient): Promise<void> {
      const auth = client.auth
      if (!auth) throw new Error('Live-session client authentication is missing.')
      await this.#hydrate(auth.userId)
    }

    async onDrop(client: LiveSessionClient): Promise<void> {
      try {
        await this.allowReconnection(client, 20)
      } catch {
        // The reconnection window expired; Colyseus will complete the leave lifecycle.
      }
    }

    onReconnect(client: LiveSessionClient): void {
      this.#sendReady(client)
    }

    async #hydrate(userId: string): Promise<void> {
      this.#hydration ??= (async () => {
        await dependencies.claimAuthority(userId, this.#options, this.roomId)
        this.#authorityClaimed = true
        this.#authorityUserId = userId
        try {
          const { aggregateVersions, characterRuleSnapshots, encounterRuleSnapshots } =
            await dependencies.loadSnapshot(userId, this.#options)
          this.#coordinator = new LiveSessionCommandCoordinator(aggregateVersions)
          for (const version of aggregateVersions) {
            this.state.aggregateVersions.set(
              aggregateKey(version.aggregateKind, version.aggregateId),
              new LiveSessionAggregateVersionState().assign(version)
            )
          }
          for (const { characterId, snapshot } of characterRuleSnapshots) {
            this.#characterRuleSnapshots.set(characterId, snapshot)
          }
          for (const { encounterId, snapshot } of encounterRuleSnapshots) {
            this.#encounterRuleSnapshots.set(encounterId, snapshot)
          }
          this.#authorityHeartbeat = setInterval(() => {
            void dependencies
              .renewAuthority(userId, this.#options, this.roomId)
              .catch(() => this.#invalidateAuthority())
          }, LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS)
          this.#authorityHeartbeat.unref()
        } catch (error) {
          await dependencies.releaseAuthority(userId, this.#options, this.roomId).catch(() => {})
          this.#authorityClaimed = false
          throw error
        }
      })()
      await this.#hydration
    }

    #invalidateAuthority(): void {
      if (this.#authorityHeartbeat) clearInterval(this.#authorityHeartbeat)
      this.#authorityHeartbeat = null
      this.#authorityClaimed = false
      this.#coordinator = null
      void this.disconnect().catch(() => {})
    }

    #sendReady(client: LiveSessionClient): void {
      const coordinator = this.#coordinator
      if (!coordinator) return
      client.send(LIVE_SESSION_READY_MESSAGE, {
        campaignId: this.#options.campaignId,
        sessionId: this.#options.sessionId,
        roomVersion: coordinator.roomVersion,
        aggregateVersions: coordinator.aggregateVersions
      })
    }

    async #execute(
      client: LiveSessionClient,
      command: Parameters<LiveSessionRoomDependencies['execute']>[2]
    ): Promise<void> {
      const coordinator = this.#coordinator
      const commandId = command.command.commandId
      if (!coordinator) {
        client.send(LIVE_SESSION_REJECTED_MESSAGE, {
          commandId,
          code: 'COMMAND_FAILED',
          message: 'The live session is still loading.'
        })
        return
      }
      try {
        const auth = client.auth
        if (!auth) throw new Error('Live-session client authentication is missing.')
        const characterSnapshot =
          command.aggregateKind === 'CHARACTER'
            ? this.#characterRuleSnapshots.get(command.characterId)
            : undefined
        const committedRuleSnapshot =
          command.aggregateKind === 'CHARACTER' &&
          characterSnapshot?.streamVersion === command.command.expectedVersion
            ? characterSnapshot
            : undefined
        const encounterSnapshot =
          command.aggregateKind === 'ENCOUNTER'
            ? this.#encounterRuleSnapshots.get(command.command.encounterId)
            : undefined
        const committedEncounterRuleSnapshot =
          command.aggregateKind === 'ENCOUNTER' &&
          encounterSnapshot?.encounterVersion === command.command.expectedVersion
            ? encounterSnapshot
            : undefined
        const coordinated = await coordinator.enqueue(() =>
          dependencies.execute(
            auth.userId,
            this.#options,
            command,
            this.roomId,
            committedRuleSnapshot,
            committedEncounterRuleSnapshot
          )
        )
        const { execution, replayed, roomVersion } = coordinated
        this.state.roomVersion = roomVersion
        if (!replayed) {
          if (execution.aggregateKind === 'CHARACTER') {
            this.#characterRuleSnapshots.set(execution.aggregateId, execution.ruleSnapshot)
          } else if (execution.ruleSnapshot) {
            this.#encounterRuleSnapshots.set(execution.aggregateId, execution.ruleSnapshot)
          }
          this.state.aggregateVersions.set(
            aggregateKey(execution.aggregateKind, execution.aggregateId),
            new LiveSessionAggregateVersionState().assign({
              aggregateKind: execution.aggregateKind,
              aggregateId: execution.aggregateId,
              version: execution.version
            })
          )
          this.broadcast(LIVE_SESSION_COMMITTED_MESSAGE, {
            aggregateKind: execution.aggregateKind,
            aggregateId: execution.aggregateId,
            version: execution.version,
            commandId: execution.commandId,
            roomVersion
          })
        }
        const result: LiveSessionResultDto =
          execution.aggregateKind === 'CHARACTER'
            ? {
                aggregateKind: 'CHARACTER',
                commandId: execution.commandId,
                roomVersion,
                replayed,
                response: execution.response
              }
            : {
                aggregateKind: 'ENCOUNTER',
                commandId: execution.commandId,
                roomVersion,
                replayed,
                response: execution.response
              }
        client.send(LIVE_SESSION_RESULT_MESSAGE, result)
      } catch (error) {
        client.send(LIVE_SESSION_REJECTED_MESSAGE, commandFailure(error, commandId))
      }
    }

    async onDispose(): Promise<void> {
      if (this.#authorityHeartbeat) clearInterval(this.#authorityHeartbeat)
      this.#authorityHeartbeat = null
      if (!this.#authorityClaimed || !this.#authorityUserId) return
      await dependencies
        .releaseAuthority(this.#authorityUserId, this.#options, this.roomId)
        .catch(() => {})
      this.#authorityClaimed = false
    }
  }
}
