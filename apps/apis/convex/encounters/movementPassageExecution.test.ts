import { describe, expect, it, vi } from 'vitest'
import { serverAggregateChoicePendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  movementRuleResolutionCommandDtoSchema,
  spatialResolutionCommandDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionSpatial'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { loadMovementTargets } from './movementTargets'
import { availableNativeMovementPassageChoice } from './movementPassagePreparation'
import { evaluateNativeMovementPassageContest } from './movementPassageExecution'
import { fixture, movement } from '../../tests/fixtures/movementPassageFixture'
import * as rollRandom from '../lib/rollRandom'

async function issued() {
  const base = await fixture()
  const value = await base.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Missing Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
    const targets = await loadMovementTargets(ctx, {
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      targetActorIds: [base.actor.id, base.blockerId]
    })
    const choice = await availableNativeMovementPassageChoice(ctx, {
      state,
      movement: movement({
        encounterId: state.id,
        sourceActorId: base.actor.id,
        blockerActorId: base.blockerId
      }),
      sourceActorId: base.actor.id,
      userId: base.owner.userId,
      targets
    })
    if (!choice) throw new Error('Missing passage choice.')
    return {
      state,
      snapshot: serverAggregateChoicePendingSnapshotDtoSchema.parse({
        snapshotKind: 'AGGREGATE_CHOICE',
        schemaVersion: 1,
        occurrenceId: crypto.randomUUID(),
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        applicationContext: choice
      })
    }
  })
  return { ...base, ...value }
}

function optionCommand(userId: string, optionId: string) {
  return movementRuleResolutionCommandDtoSchema.parse({
    commandId: crypto.randomUUID(),
    commandFingerprint: checksumRuleDocument({ optionId }),
    actorUserId: userId,
    correlationId: null,
    expectedOccurrenceVersion: 0,
    kind: 'PASSAGE_OPTION',
    optionId
  })
}

function evidenceCommand(
  userId: string,
  kind: 'ENTER_DICE' | 'SYSTEM_ROLL',
  requestId: string,
  expectedOccurrenceVersion: number
) {
  return spatialResolutionCommandDtoSchema.parse({
    commandId: crypto.randomUUID(),
    commandFingerprint: checksumRuleDocument({ requestId }),
    actorUserId: userId,
    correlationId: null,
    expectedOccurrenceVersion,
    kind,
    requestId
  })
}

describe('native movement passage execution', () => {
  it('executes a canonical automatic option and replays the completion without writes', async () => {
    const base = await issued()
    if (base.snapshot.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
      throw new Error('Missing passage choice.')
    const option = base.snapshot.applicationContext.options[0]!
    const responseCommand = optionCommand(base.owner.userId, option.optionId)
    const result = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: base.state.id,
        expectedEncounterVersion: base.state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      return evaluateNativeMovementPassageContest(ctx, {
        state: base.state,
        snapshot: base.snapshot,
        resolution: { kind: 'PASSAGE_OPTION', optionId: option.optionId },
        responseCommand,
        userId: base.owner.userId,
        autoRoll: true,
        targets
      }).then((result) => ({
        kind: result.kind,
        receipt: result.kind === 'COMPLETE' ? result.receipt : null
      }))
    })
    expect(result.kind).toBe('COMPLETE')
    if (result.kind !== 'COMPLETE') return
    if (!result.receipt) throw new Error('Missing passage receipt.')
    expect(
      result.receipt.initiator.rawFaces.length + result.receipt.defender.rawFaces.length
    ).toBeGreaterThan(0)
    const replay = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: base.state.id,
        expectedEncounterVersion: base.state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      const random = vi.spyOn(rollRandom, 'nextRollInt').mockImplementation(() => {
        throw new Error('random during retained replay')
      })
      try {
        const value = await evaluateNativeMovementPassageContest(ctx, {
          state: base.state,
          snapshot: base.snapshot,
          resolution: { kind: 'PASSAGE_OPTION', optionId: option.optionId },
          responseCommand,
          userId: base.owner.userId,
          autoRoll: true,
          targets,
          retained: { receipt: result.receipt! }
        })
        return { kind: value.kind, receipt: value.kind === 'COMPLETE' ? value.receipt : null }
      } finally {
        random.mockRestore()
      }
    })
    expect(replay).toEqual(result)
  }, 30000)

  it('yields initiator pending in assisted mode, then defender pending after SYSTEM_ROLL', async () => {
    const base = await issued()
    if (base.snapshot.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
      throw new Error('Missing passage choice.')
    const option = base.snapshot.applicationContext.options[0]!
    const state = encounterRunStateSchema.parse({ ...base.state, automationMode: 'ASSISTED' })
    const first = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      return evaluateNativeMovementPassageContest(ctx, {
        state,
        snapshot: base.snapshot,
        resolution: { kind: 'PASSAGE_OPTION', optionId: option.optionId },
        responseCommand: optionCommand(base.owner.userId, option.optionId),
        userId: base.owner.userId,
        autoRoll: false,
        targets
      })
    })
    expect(first.kind).toBe('PENDING')
    if (first.kind !== 'PENDING') return
    expect(first.snapshot.request.nodeId).toBe('initiator_d20')
    const systemCommand = evidenceCommand(
      base.owner.userId,
      'SYSTEM_ROLL',
      first.snapshot.request.requestId,
      1
    )
    expect(systemCommand).not.toHaveProperty('rawFaces')
    const second = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      return evaluateNativeMovementPassageContest(ctx, {
        state,
        snapshot: first.snapshot,
        resolution: { kind: 'SYSTEM_ROLL', requestId: first.snapshot.request.requestId },
        responseCommand: systemCommand,
        userId: base.owner.userId,
        autoRoll: false,
        targets
      })
    })
    expect(second.kind).toBe('PENDING')
    if (second.kind !== 'PENDING') return
    expect(second.snapshot.request.nodeId).toBe('target_d20')
    const replayedPending = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      const random = vi.spyOn(rollRandom, 'nextRollInt').mockImplementation(() => {
        throw new Error('random during retained pending replay')
      })
      try {
        return await evaluateNativeMovementPassageContest(ctx, {
          state,
          snapshot: first.snapshot,
          resolution: { kind: 'SYSTEM_ROLL', requestId: first.snapshot.request.requestId },
          responseCommand: systemCommand,
          userId: base.owner.userId,
          autoRoll: false,
          targets,
          retained: { snapshot: second.snapshot }
        })
      } finally {
        random.mockRestore()
      }
    })
    expect(replayedPending).toEqual(second)
    const extraPendingSnapshot = structuredClone(second.snapshot)
    if (extraPendingSnapshot.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST')
      throw new Error('Expected a retained Passage contest.')
    extraPendingSnapshot.applicationContext.rollEvidence.initiator!.rawFaces.push(1)
    await expect(
      base.owner.caller.run(async (ctx) => {
        const targets = await loadMovementTargets(ctx, {
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          targetActorIds: [base.actor.id, base.blockerId]
        })
        return evaluateNativeMovementPassageContest(ctx, {
          state,
          snapshot: first.snapshot,
          resolution: { kind: 'SYSTEM_ROLL', requestId: first.snapshot.request.requestId },
          responseCommand: systemCommand,
          userId: base.owner.userId,
          autoRoll: false,
          targets,
          retained: { snapshot: extraPendingSnapshot }
        })
      })
    ).rejects.toThrow('unused d20 faces')
    const enterCommand = evidenceCommand(
      base.owner.userId,
      'ENTER_DICE',
      second.snapshot.request.requestId,
      2
    )
    const entered = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      return evaluateNativeMovementPassageContest(ctx, {
        state,
        snapshot: second.snapshot,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: second.snapshot.request.requestId,
          rawFaces: [10]
        },
        responseCommand: enterCommand,
        userId: base.owner.userId,
        autoRoll: false,
        targets
      }).then((value) => ({
        kind: value.kind,
        receipt: value.kind === 'COMPLETE' ? value.receipt : null
      }))
    })
    expect(entered.kind).toBe('COMPLETE')
    if (entered.kind !== 'COMPLETE' || !entered.receipt) return
    const replayed = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      return evaluateNativeMovementPassageContest(ctx, {
        state,
        snapshot: second.snapshot,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: second.snapshot.request.requestId,
          rawFaces: [10]
        },
        responseCommand: enterCommand,
        userId: base.owner.userId,
        autoRoll: false,
        targets,
        retained: { receipt: entered.receipt! }
      }).then((value) => ({
        kind: value.kind,
        receipt: value.kind === 'COMPLETE' ? value.receipt : null
      }))
    })
    expect(replayed).toEqual(entered)
    const defenderSystemCommand = evidenceCommand(
      base.owner.userId,
      'SYSTEM_ROLL',
      second.snapshot.request.requestId,
      2
    )
    const systemCompleted = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      return evaluateNativeMovementPassageContest(ctx, {
        state,
        snapshot: second.snapshot,
        resolution: { kind: 'SYSTEM_ROLL', requestId: second.snapshot.request.requestId },
        responseCommand: defenderSystemCommand,
        userId: base.owner.userId,
        autoRoll: false,
        targets
      }).then((value) => ({
        kind: value.kind,
        receipt: value.kind === 'COMPLETE' ? value.receipt : null
      }))
    })
    expect(systemCompleted.kind).toBe('COMPLETE')
    if (systemCompleted.kind !== 'COMPLETE' || !systemCompleted.receipt) return
    const replayedSystem = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      const random = vi.spyOn(rollRandom, 'nextRollInt').mockImplementation(() => {
        throw new Error('random during retained system replay')
      })
      try {
        return await evaluateNativeMovementPassageContest(ctx, {
          state,
          snapshot: second.snapshot,
          resolution: { kind: 'SYSTEM_ROLL', requestId: second.snapshot.request.requestId },
          responseCommand: defenderSystemCommand,
          userId: base.owner.userId,
          autoRoll: false,
          targets,
          retained: { receipt: systemCompleted.receipt! }
        }).then((value) => ({
          kind: value.kind,
          receipt: value.kind === 'COMPLETE' ? value.receipt : null
        }))
      } finally {
        random.mockRestore()
      }
    })
    expect(replayedSystem).toEqual(systemCompleted)
    const forged = {
      ...entered.receipt,
      defender: { ...entered.receipt.defender, total: entered.receipt.defender.total + 1 }
    }
    await expect(
      base.owner.caller.run(async (ctx) => {
        const targets = await loadMovementTargets(ctx, {
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          targetActorIds: [base.actor.id, base.blockerId]
        })
        return evaluateNativeMovementPassageContest(ctx, {
          state,
          snapshot: second.snapshot,
          resolution: {
            kind: 'ENTER_DICE',
            requestId: second.snapshot.request.requestId,
            rawFaces: [10]
          },
          responseCommand: enterCommand,
          userId: base.owner.userId,
          autoRoll: false,
          targets,
          retained: { receipt: forged }
        })
      })
    ).rejects.toThrow('stale')
  }, 30000)

  it('rejects missing, extra, and forged retained evidence without changing the Run or economy', async () => {
    const base = await issued()
    if (base.snapshot.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
      throw new Error('Missing passage choice.')
    const option = base.snapshot.applicationContext.options[0]!
    const responseCommand = optionCommand(base.owner.userId, option.optionId)
    const completed = await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: base.state.id,
        expectedEncounterVersion: base.state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      return evaluateNativeMovementPassageContest(ctx, {
        state: base.state,
        snapshot: base.snapshot,
        resolution: { kind: 'PASSAGE_OPTION', optionId: option.optionId },
        responseCommand,
        userId: base.owner.userId,
        autoRoll: true,
        targets
      })
    })
    if (completed.kind !== 'COMPLETE') throw new Error('Missing completed passage.')
    const missing = {
      ...completed.receipt,
      initiator: { ...completed.receipt.initiator, rawFaces: [] }
    }
    const extra = {
      ...completed.receipt,
      defender: {
        ...completed.receipt.defender,
        rawFaces: [...completed.receipt.defender.rawFaces, 1]
      }
    }
    const forged = {
      ...completed.receipt,
      initiator: { ...completed.receipt.initiator, total: completed.receipt.initiator.total + 1 }
    }
    await base.owner.caller.run(async (ctx) => {
      const runBefore = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      const actorBefore = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.state.id).eq('id', base.actor.id)
        )
        .unique()
      const targets = await loadMovementTargets(ctx, {
        encounterId: base.state.id,
        expectedEncounterVersion: base.state.version,
        targetActorIds: [base.actor.id, base.blockerId]
      })
      for (const receipt of [missing, extra, forged])
        await expect(
          evaluateNativeMovementPassageContest(ctx, {
            state: base.state,
            snapshot: base.snapshot,
            resolution: { kind: 'PASSAGE_OPTION', optionId: option.optionId },
            responseCommand,
            userId: base.owner.userId,
            autoRoll: true,
            targets,
            retained: { receipt }
          })
        ).rejects.toThrow()
      expect(
        await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
      ).toEqual(runBefore)
      expect(
        await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.state.id).eq('id', base.actor.id)
          )
          .unique()
      ).toEqual(actorBefore)
    })
  }, 30000)
})
