import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  auditWindow,
  budgets,
  classOf,
  measuredWindows,
  sessionEstimate,
  tokenRefreshCost
} from './v15Budgets.mjs'

// The unit costs Browser journeys run 44311973758 measured for PERF-1.T7 (after PERF-1.T8 to T12).
const measured = {
  unitCosts: {
    fightSaves: {
      start: { saves: 2, convexCalls: 2, convexIoBytes: 89_982.5 },
      postStart: { saves: 2, convexCalls: 3, convexIoBytes: 248_465 },
      complete: { saves: 2, convexCalls: 2, convexIoBytes: 395_868.5 },
      convexCalls: 7,
      convexIoBytes: 734_316
    },
    combat: {
      convexCalls: 0.371_462_264_2,
      convexIoBytes: 815.976_415_1,
      requestsBilled: 0.056_603_773_6,
      rowsRead: 40.119_103_773_6,
      rowsWritten: 6.915_094_339_6
    },
    outOfCombatPerMinute: {
      convexCalls: 12.693_837_6,
      convexIoBytes: 3_495.036_618_1,
      requestsBilled: 0.995_595_105_6,
      rowsRead: 378.575_038_9,
      rowsWritten: 43.557_286_9
    }
  },
  perSession: { lifecycle: { calls: 26.666_666_7, ioBytes: 277_959.333_3 } }
}
// That run priced token refreshes inside the per-command and per-minute costs above, so its unit
// costs carry no separate refresh charge.
const unpricedRefresh = { refreshes: 0, convexCalls: 0, convexIoBytes: 0 }

const estimateOf = () => {
  const failures = []
  const { estimate } = sessionEstimate(
    { ...measured.unitCosts, tokenRefresh: unpricedRefresh },
    measured.perSession,
    failures
  )
  return { estimate, failures }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('V15 checkpoint classification', () => {
  it.each([
    'POST /live-sessions/checkpoint',
    'liveSessions/checkpoint:publish',
    'POST /live-sessions/chat-checkpoint',
    'liveSessions/checkpoint:publishChat'
  ])('counts %s as checkpoint ingestion', (identifier) => {
    expect(classOf(identifier)).toBe('checkpointIngestion')
  })

  it('leaves an unclassified function out of the live-play classes', () => {
    expect(classOf('liveSessions/state:somethingElse')).toBe('other')
  })
})

describe('V15 post-START window', () => {
  const execution = (identifier) => ({ identifier, error: null })
  const open = 'liveSessions/developmentMeasurement:openWindow'
  const close = 'liveSessions/developmentMeasurement:closeWindow'

  it('holds what ran between each START window and the next marker', () => {
    const log = [
      execution(open),
      execution('liveSessions/checkpoint:publish'),
      execution(close),
      execution('liveSessions/checkpoint:publish'),
      execution(open),
      execution('liveSessions/checkpoint:publish'),
      execution(close),
      execution('liveSessions/checkpoint:publish'),
      execution('liveSessions/checkpoint:publish'),
      execution(open),
      execution('liveSessions/checkpoint:publishChat'),
      execution(close),
      execution(open),
      execution('liveSessions/checkpoint:publish'),
      execution(close),
      execution(open),
      execution(close)
    ]
    const failures = []
    const windows = Object.fromEntries(
      measuredWindows(log, 2, failures).map(({ name, executions }) => [
        name,
        executions.map(({ identifier }) => identifier)
      ])
    )
    expect(failures).toEqual([])
    expect(windows.start).toEqual(Array(2).fill('liveSessions/checkpoint:publish'))
    expect(windows.postStart).toEqual(Array(3).fill('liveSessions/checkpoint:publish'))
    expect(windows.combat).toEqual(['liveSessions/checkpoint:publishChat'])
    expect(windows.save).toEqual(['liveSessions/checkpoint:publish'])
    expect(windows.outOfCombat).toEqual([])
  })
})

describe('V15 session estimate (D209, D229)', () => {
  it('holds a session to 4.3 MB decimal of Convex I/O', () => {
    expect(budgets.convexIoBytesPerSession).toBe(4_300_000)
  })

  it('fails the session the measured run models, at 4.3 MB decimal', () => {
    const { estimate, failures } = estimateOf()
    expect(Math.round(estimate.convexIoBytes)).toBe(5_266_581)
    expect(failures).toEqual(['Session estimate: Convex I/O bytes 5266581 exceed 4300000.'])
  })

  it('passes a session below the gate', () => {
    const failures = []
    sessionEstimate(
      {
        ...measured.unitCosts,
        tokenRefresh: unpricedRefresh,
        fightSaves: { convexCalls: 7, convexIoBytes: 100_000 }
      },
      measured.perSession,
      failures
    )
    expect(failures).toEqual([])
  })

  it('adds the START, post-START and COMPLETE saves of every fight', () => {
    const base = estimateOf().estimate.convexIoBytes
    vi.stubEnv('V15_ESTIMATE_FIGHTS', '5')
    const extra = estimateOf().estimate.convexIoBytes - base
    expect(extra).toBeCloseTo(
      measured.unitCosts.fightSaves.start.convexIoBytes +
        measured.unitCosts.fightSaves.postStart.convexIoBytes +
        measured.unitCosts.fightSaves.complete.convexIoBytes,
      0
    )
  })

  it('does not scale a fight save with the commands a fight holds', () => {
    const base = estimateOf().estimate.convexIoBytes
    vi.stubEnv('V15_ESTIMATE_COMBAT_COMMANDS', '3000')
    const extra = estimateOf().estimate.convexIoBytes - base
    expect(extra).toBeCloseTo(1_000 * measured.unitCosts.combat.convexIoBytes, 0)
  })
})

describe('V15 sign-in token refresh charge (D230)', () => {
  const refresh = { refreshes: 10, convexCalls: 3, convexIoBytes: 5_000 }
  const estimateWith = (tokenRefresh) =>
    sessionEstimate({ ...measured.unitCosts, tokenRefresh }, measured.perSession, []).estimate

  it('charges every member one refresh per 15-minute token lifetime over the session hours', () => {
    const extra = estimateWith(refresh).convexIoBytes - estimateWith(unpricedRefresh).convexIoBytes
    // 6 members x (5 hours x 60 / 15 minutes) = 120 refreshes.
    expect(extra).toBe(120 * 5_000)
    expect(estimateWith(refresh).convexCalls - estimateWith(unpricedRefresh).convexCalls).toBe(
      120 * 3
    )
  })

  it('follows the session hours, not the commands or minutes', () => {
    const base = estimateWith(refresh).convexIoBytes
    vi.stubEnv('V15_ESTIMATE_COMBAT_COMMANDS', '3000')
    const withCommands = estimateWith(refresh).convexIoBytes - base
    expect(withCommands).toBeCloseTo(1_000 * measured.unitCosts.combat.convexIoBytes, 0)
    vi.stubEnv('V15_ESTIMATE_COMBAT_COMMANDS', '')
    vi.stubEnv('V15_ESTIMATE_SESSION_HOURS', '4')
    // 6 x (4 x 60 / 15) = 96 refreshes.
    expect(estimateWith(refresh).convexIoBytes - base).toBe(-24 * 5_000)
  })

  const execution = (identifier, bytes) => ({
    identifier,
    error: null,
    usageStats: { databaseIoReadBytes: bytes, databaseIoWriteBytes: 0 }
  })
  const log = [
    execution('GET /api/auth/convex/token', 100),
    execution('adapter:findOne', 400),
    execution('GET /api/auth/convex/token', 100),
    execution('adapter:findOne', 200),
    execution('liveSessions/checkpoint:publishChat', 9_000),
    execution('campaigns/deletionJobs:watchdog', 7_000)
  ]

  it('prices a refresh as the route call plus the adapter calls under it', () => {
    expect(tokenRefreshCost(log)).toEqual({ refreshes: 2, convexCalls: 2, convexIoBytes: 400 })
  })

  it('leaves refreshes and background jobs out of a window cost', () => {
    const audit = auditWindow({ name: 'combat', executions: log }, true, [])
    expect(audit.calls).toBe(1)
    expect(audit.ioBytes).toBe(9_000)
  })
})
