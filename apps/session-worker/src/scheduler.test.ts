import { describe, expect, it } from 'vitest'

import type { LiveSessionConflictKey } from './conflictKeys.js'
import { selectRunnableCommands } from './scheduler.js'

describe('live-session conflict scheduler', () => {
  it('starts disjoint work together and atomically defers overlapping conflict sets', () => {
    const characterA = 'character:00000000-0000-0000-0000-000000000001' as const
    const characterB = 'character:00000000-0000-0000-0000-000000000002' as const
    const encounter = 'encounter:00000000-0000-0000-0000-000000000003' as const
    const door =
      'scene:00000000-0000-0000-0000-000000000004:barrier:00000000-0000-0000-0000-000000000005' as const
    const active = new Set<LiveSessionConflictKey>([characterA])

    expect(
      selectRunnableCommands(
        [
          {
            acceptedSequence: 1,
            commandId: 'one',
            conflictKeys: [characterA, encounter],
            nextAttemptAt: 0
          },
          { acceptedSequence: 2, commandId: 'two', conflictKeys: [characterB], nextAttemptAt: 0 },
          { acceptedSequence: 3, commandId: 'three', conflictKeys: [encounter], nextAttemptAt: 0 },
          { acceptedSequence: 4, commandId: 'four', conflictKeys: [door], nextAttemptAt: 0 }
        ],
        active,
        { limit: 8, now: 100 }
      ).map(({ commandId }) => commandId)
    ).toEqual(['two', 'four'])
  })

  it('treats broad keys as conflicts and lets only ready queue heads run', () => {
    const scene = 'scene:00000000-0000-0000-0000-000000000004' as const
    const token = `${scene}:token:00000000-0000-0000-0000-000000000005` as const
    const barrier = `${scene}:barrier:00000000-0000-0000-0000-000000000006` as const

    expect(
      selectRunnableCommands(
        [
          {
            acceptedSequence: 1,
            commandId: 'recovering-broad',
            conflictKeys: [scene],
            nextAttemptAt: 200
          },
          { acceptedSequence: 2, commandId: 'token', conflictKeys: [token], nextAttemptAt: 0 },
          { acceptedSequence: 3, commandId: 'barrier', conflictKeys: [barrier], nextAttemptAt: 0 }
        ],
        new Set(),
        { limit: 8, now: 100 }
      )
    ).toEqual([])
  })

  it('caps disjoint authoritative work per room', () => {
    const pending = Array.from({ length: 12 }, (_, index) => ({
      acceptedSequence: index + 1,
      commandId: String(index),
      conflictKeys: [`character:${String(index).padStart(36, '0')}` as const],
      nextAttemptAt: 0
    }))
    expect(selectRunnableCommands(pending, new Set(), { limit: 8, now: 0 })).toHaveLength(8)
  })
})
