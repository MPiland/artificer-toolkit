import { describe, expect, it } from 'vitest'
import { budgets, sessionEstimate } from './v15Budgets.mjs'

// The unit costs the a84 V15 run measured (local-validation/local-convex-proofs/a84.v15-budgets.json).
const a84 = {
  unitCosts: {
    fightSaves: {
      start: { convexCalls: 2, convexIoBytes: 99_682 },
      complete: { convexCalls: 2, convexIoBytes: 753_402, commandsPerFight: 424 }
    },
    combat: {
      convexCalls: 0.349,
      convexIoBytes: 42.396_226_415,
      requestsBilled: 0.057,
      rowsRead: 24.4,
      rowsWritten: 5.8
    },
    outOfCombatPerMinute: {
      convexCalls: 11.96,
      convexIoBytes: 1_120.210_137_463,
      requestsBilled: 1,
      rowsRead: 431.5,
      rowsWritten: 43.4
    }
  },
  perSession: { lifecycle: { calls: 26.7, ioBytes: 266_347.333 } }
}

describe('V15 session estimate (D209)', () => {
  it('holds a session to 4.3 MB decimal of Convex I/O', () => {
    expect(budgets.convexIoBytesPerSession).toBe(4_300_000)
  })

  it('fails the 4.44 MB a84 session under the session model', () => {
    const failures = []
    const { estimate, assumptions } = sessionEstimate(a84.unitCosts, a84.perSession, failures)
    expect(assumptions).toEqual({
      fightsPerSession: 4,
      combatCommandsPerSession: 2_000,
      outOfCombatMinutesPerSession: 120,
      sessionHours: 5
    })
    expect(Math.round(estimate.convexIoBytes)).toBe(4_438_076)
    expect(failures).toEqual(['Session estimate: Convex I/O bytes 4438076 exceed 4300000.'])
  })
})
