import type { LiveSessionConflictKey } from './conflictKeys.js'
import { liveSessionConflictKeysOverlap } from './conflictKeys.js'

export interface PendingLiveSessionCommand {
  acceptedSequence: number
  commandId: string
  conflictKeys: readonly LiveSessionConflictKey[]
  nextAttemptAt: number
}

export function selectRunnableCommands<TCommand extends PendingLiveSessionCommand>(
  pending: readonly TCommand[],
  activeKeys: ReadonlySet<LiveSessionConflictKey>,
  options: { limit: number; now: number }
): TCommand[] {
  const claimed = [...activeKeys]
  const selected: TCommand[] = []
  const ordered = [...pending].sort((left, right) => left.acceptedSequence - right.acceptedSequence)

  for (const [index, command] of ordered.entries()) {
    if (selected.length >= options.limit) break
    if (command.nextAttemptAt > options.now) continue
    if (
      command.conflictKeys.some((key) =>
        claimed.some((activeKey) => liveSessionConflictKeysOverlap(key, activeKey))
      )
    ) {
      continue
    }
    const hasEarlierConflict = ordered
      .slice(0, index)
      .some((earlier) =>
        earlier.conflictKeys.some((earlierKey) =>
          command.conflictKeys.some((key) => liveSessionConflictKeysOverlap(earlierKey, key))
        )
      )
    if (hasEarlierConflict) continue
    selected.push(command)
    claimed.push(...command.conflictKeys)
  }

  return selected
}
