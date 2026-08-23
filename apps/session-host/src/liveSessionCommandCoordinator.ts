import type { LiveSessionAggregateVersionDto } from '@artificer-toolkit/schema/api/liveSessions'

import {
  liveSessionConflictKeysOverlap,
  type LiveSessionConflictKey
} from './liveSessionConflictKeys.js'

export const MAX_LOCAL_AUTHORITATIVE_COMMANDS_IN_FLIGHT = 8

export interface LiveSessionVersionedExecution {
  aggregateKind: 'CHARACTER' | 'ENCOUNTER' | 'SCENE'
  aggregateId: string
  commandId: string
  replayed: boolean
  version: number
}

export interface LiveSessionCoordinatedExecution<T extends LiveSessionVersionedExecution> {
  execution: T
  replayed: boolean
  roomVersion: number
}

interface PendingCommand<T extends LiveSessionVersionedExecution> {
  aggregate: {
    aggregateId: string | null
    aggregateKind: LiveSessionVersionedExecution['aggregateKind']
  }
  conflictKeys: readonly LiveSessionConflictKey[]
  execute: () => Promise<T>
  reject: (error: unknown) => void
  resolve: (result: LiveSessionCoordinatedExecution<T>) => void
  sequence: number
}

interface CompletedCommand<T extends LiveSessionVersionedExecution> {
  execution: T
  reject: (error: unknown) => void
  resolve: (result: LiveSessionCoordinatedExecution<T>) => void
}

function aggregateKey(
  execution: Pick<LiveSessionAggregateVersionDto, 'aggregateKind' | 'aggregateId'>
) {
  return `${execution.aggregateKind}:${execution.aggregateId}`
}

export class LiveSessionCommandCoordinator<T extends LiveSessionVersionedExecution> {
  readonly #activeKeys = new Set<LiveSessionConflictKey>()
  readonly #aggregateVersions = new Map<string, LiveSessionAggregateVersionDto>()
  readonly #completedByAggregate = new Map<string, Map<number, CompletedCommand<T>>>()
  readonly #operations = new Set<Promise<void>>()
  readonly #pending: PendingCommand<T>[] = []
  #nextSequence = 0
  #roomVersion = 0

  constructor(initialVersions: readonly LiveSessionAggregateVersionDto[]) {
    for (const version of initialVersions) {
      this.#aggregateVersions.set(aggregateKey(version), version)
    }
  }

  get roomVersion(): number {
    return this.#roomVersion
  }

  get aggregateVersions(): LiveSessionAggregateVersionDto[] {
    return [...this.#aggregateVersions.values()].sort((left, right) =>
      aggregateKey(left).localeCompare(aggregateKey(right))
    )
  }

  async drain(): Promise<void> {
    while (
      this.#pending.length > 0 ||
      this.#operations.size > 0 ||
      this.#completedByAggregate.size > 0
    ) {
      if (this.#operations.size === 0) {
        throw new Error('Live-session commands are queued without runnable work.')
      }
      await Promise.all([...this.#operations])
    }
  }

  enqueue(
    aggregate: {
      aggregateId: string | null
      aggregateKind: LiveSessionVersionedExecution['aggregateKind']
    },
    conflictKeys: readonly LiveSessionConflictKey[],
    execute: () => Promise<T>
  ): Promise<LiveSessionCoordinatedExecution<T>> {
    if (conflictKeys.length === 0 || new Set(conflictKeys).size !== conflictKeys.length) {
      return Promise.reject(new Error('Live-session commands require unique conflict keys.'))
    }
    const result = new Promise<LiveSessionCoordinatedExecution<T>>((resolve, reject) => {
      this.#pending.push({
        aggregate,
        conflictKeys,
        execute,
        reject,
        resolve,
        sequence: ++this.#nextSequence
      })
    })
    this.#schedule()
    return result
  }

  #schedule(): void {
    while (this.#operations.size < MAX_LOCAL_AUTHORITATIVE_COMMANDS_IN_FLIGHT) {
      const index = this.#pending.findIndex((command, commandIndex) => {
        const conflictsWithActive = command.conflictKeys.some((key) =>
          [...this.#activeKeys].some((activeKey) => liveSessionConflictKeysOverlap(key, activeKey))
        )
        if (conflictsWithActive) return false
        return !this.#pending
          .slice(0, commandIndex)
          .some((earlier) =>
            earlier.conflictKeys.some((earlierKey) =>
              command.conflictKeys.some((key) => liveSessionConflictKeysOverlap(earlierKey, key))
            )
          )
      })
      if (index < 0) return
      const [command] = this.#pending.splice(index, 1)
      if (!command) return
      for (const key of command.conflictKeys) this.#activeKeys.add(key)
      const operation = this.#run(command)
      this.#operations.add(operation)
      void operation.finally(() => {
        this.#operations.delete(operation)
        for (const key of command.conflictKeys) this.#activeKeys.delete(key)
        this.#schedule()
      })
    }
  }

  async #run(command: PendingCommand<T>): Promise<void> {
    try {
      const execution = await command.execute()
      if (
        execution.aggregateKind !== command.aggregate.aggregateKind ||
        (command.aggregate.aggregateId !== null &&
          execution.aggregateId !== command.aggregate.aggregateId)
      ) {
        throw new Error('Live-session command returned a different aggregate identity.')
      }
      if (execution.replayed) {
        const current = this.#aggregateVersions.get(aggregateKey(execution))
        if (!current || execution.version > current.version) {
          throw new Error('Live-session command returned an invalid persisted replay version.')
        }
        command.resolve({ execution, replayed: true, roomVersion: this.#roomVersion })
        return
      }
      this.#queueCompleted(command, execution)
    } catch (error) {
      command.reject(error)
    }
  }

  #queueCompleted(command: PendingCommand<T>, execution: T): void {
    const key = aggregateKey(execution)
    const current = this.#aggregateVersions.get(key)
    if (current && execution.version <= current.version) {
      command.reject(new Error('Live-session aggregate version did not advance.'))
      return
    }
    const completed = this.#completedByAggregate.get(key) ?? new Map<number, CompletedCommand<T>>()
    if (completed.has(execution.version)) {
      command.reject(new Error('Live-session aggregate returned a duplicate committed version.'))
      return
    }
    completed.set(execution.version, {
      execution,
      reject: command.reject,
      resolve: command.resolve
    })
    this.#completedByAggregate.set(key, completed)
    this.#flushCompleted(key)
  }

  #flushCompleted(key: string): void {
    const completed = this.#completedByAggregate.get(key)
    if (!completed || completed.size === 0) return
    let current = this.#aggregateVersions.get(key)
    let nextVersion = current ? current.version + 1 : Math.min(...completed.keys())
    while (completed.has(nextVersion)) {
      const command = completed.get(nextVersion)
      if (!command) break
      completed.delete(nextVersion)
      current = {
        aggregateId: command.execution.aggregateId,
        aggregateKind: command.execution.aggregateKind,
        version: command.execution.version
      }
      this.#aggregateVersions.set(key, current)
      this.#roomVersion += 1
      command.resolve({
        execution: command.execution,
        replayed: false,
        roomVersion: this.#roomVersion
      })
      nextVersion = current.version + 1
    }
    if (completed.size === 0) this.#completedByAggregate.delete(key)
  }
}
