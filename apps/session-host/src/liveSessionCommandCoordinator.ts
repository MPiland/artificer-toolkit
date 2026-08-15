import type { LiveSessionAggregateVersionDto } from '@artificer-toolkit/schema/api/liveSessions'

export interface LiveSessionVersionedExecution {
  aggregateKind: 'CHARACTER' | 'ENCOUNTER'
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

function aggregateKey(
  execution: Pick<LiveSessionVersionedExecution, 'aggregateKind' | 'aggregateId'>
) {
  return `${execution.aggregateKind}:${execution.aggregateId}`
}

export class LiveSessionCommandCoordinator<T extends LiveSessionVersionedExecution> {
  readonly #aggregateVersions = new Map<string, LiveSessionAggregateVersionDto>()
  #roomVersion = 0
  #tail: Promise<void> = Promise.resolve()

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

  enqueue(execute: () => Promise<T>): Promise<LiveSessionCoordinatedExecution<T>> {
    const operation = this.#tail.then(async () => {
      const execution = await execute()
      const key = aggregateKey(execution)
      const current = this.#aggregateVersions.get(key)
      if (execution.replayed) {
        if (!current || execution.version > current.version) {
          throw new Error('Live-session command returned an invalid persisted replay version.')
        }
        return { execution, replayed: true, roomVersion: this.#roomVersion }
      }
      if (current && execution.version !== current.version + 1) {
        throw new Error('Live-session aggregate version advanced outside room ordering.')
      }
      this.#aggregateVersions.set(key, {
        aggregateKind: execution.aggregateKind,
        aggregateId: execution.aggregateId,
        version: execution.version
      })
      this.#roomVersion += 1
      return { execution, replayed: false, roomVersion: this.#roomVersion }
    })
    this.#tail = operation.then(
      () => undefined,
      () => undefined
    )
    return operation
  }
}
