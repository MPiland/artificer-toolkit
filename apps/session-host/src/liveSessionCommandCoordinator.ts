import type { LiveSessionAggregateVersionDto } from '@artificer-toolkit/schema/api/liveSessions'

import {
  liveSessionConflictKeysOverlap,
  type LiveSessionConflictKey
} from './liveSessionConflictKeys.js'

export const MAX_LOCAL_AUTHORITATIVE_COMMANDS_IN_FLIGHT = 8

export interface LiveSessionVersionedExecution {
  aggregateKind: 'CHARACTER' | 'ENCOUNTER' | 'SCENE' | 'SESSION'
  aggregateId: string
  commandId: string
  replayed: boolean
  version: number
  changedAggregates: readonly LiveSessionAggregateVersionDto[]
}

export interface LiveSessionCoordinatedExecution<T extends LiveSessionVersionedExecution> {
  execution: T
  refreshRequired: boolean
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

function transitionStart(version: LiveSessionAggregateVersionDto): number {
  return version.beforeVersion ?? version.version - 1
}

export class LiveSessionCommandCoordinator<T extends LiveSessionVersionedExecution> {
  readonly #activeKeys = new Set<LiveSessionConflictKey>()
  readonly #aggregateVersions = new Map<string, LiveSessionAggregateVersionDto>()
  readonly #completed = new Map<number, CompletedCommand<T>>()
  readonly #operations = new Set<Promise<void>>()
  readonly #pending: PendingCommand<T>[] = []
  #nextSequence = 0
  #roomVersion = 0

  constructor(initialVersions: readonly LiveSessionAggregateVersionDto[]) {
    for (const version of initialVersions) {
      this.#aggregateVersions.set(aggregateKey(version), {
        aggregateKind: version.aggregateKind,
        aggregateId: version.aggregateId,
        version: version.version
      })
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
    while (this.#pending.length > 0 || this.#operations.size > 0 || this.#completed.size > 0) {
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
      const changed = this.#changedAggregates(execution)
      if (execution.replayed) {
        const refreshRequired = changed.some(
          (version) =>
            version.version > (this.#aggregateVersions.get(aggregateKey(version))?.version ?? -1)
        )
        command.resolve({
          execution,
          refreshRequired,
          replayed: true,
          roomVersion: this.#roomVersion
        })
        return
      }
      this.#queueCompleted(command, execution)
    } catch (error) {
      command.reject(error)
    }
  }

  #validateChangedAggregates(versions: readonly LiveSessionAggregateVersionDto[]) {
    const sorted = [...versions].sort((left, right) =>
      aggregateKey(left).localeCompare(aggregateKey(right))
    )
    if (
      sorted.some(
        (version, index) => index > 0 && aggregateKey(version) === aggregateKey(sorted[index - 1]!)
      ) ||
      sorted.some((version) => transitionStart(version) >= version.version)
    ) {
      throw new Error('Live-session changed aggregates must be unique.')
    }
    return sorted
  }

  #changedAggregates(execution: T) {
    return this.#validateChangedAggregates(execution.changedAggregates)
  }

  #queueCompleted(command: PendingCommand<T>, execution: T): void {
    const sequence = command.sequence
    this.#completed.set(sequence, {
      execution,
      reject: command.reject,
      resolve: command.resolve
    })
    this.#flushCompleted()
  }

  #flushCompleted(): void {
    let progressed = true
    while (progressed) {
      progressed = false
      for (const [sequence, command] of [...this.#completed]) {
        const changed = this.#changedAggregates(command.execution)
        if (
          changed.some(
            (version) =>
              version.version <= (this.#aggregateVersions.get(aggregateKey(version))?.version ?? -1)
          )
        ) {
          this.#completed.delete(sequence)
          command.reject(new Error('Live-session aggregate version did not advance.'))
          continue
        }
        if (
          changed.some((version) => {
            const current =
              this.#aggregateVersions.get(aggregateKey(version))?.version ??
              transitionStart(version)
            return current > transitionStart(version)
          })
        ) {
          this.#completed.delete(sequence)
          command.reject(new Error('Live-session aggregate transition start is stale.'))
          continue
        }
        if (
          changed.some(
            (version) =>
              (this.#aggregateVersions.get(aggregateKey(version))?.version ??
                transitionStart(version)) !== transitionStart(version)
          )
        )
          continue
        this.#completed.delete(sequence)
        for (const version of changed)
          this.#aggregateVersions.set(aggregateKey(version), {
            aggregateKind: version.aggregateKind,
            aggregateId: version.aggregateId,
            version: version.version
          })
        this.#roomVersion += 1
        command.resolve({
          execution: command.execution,
          refreshRequired: false,
          replayed: false,
          roomVersion: this.#roomVersion
        })
        progressed = true
      }
    }
  }
}
