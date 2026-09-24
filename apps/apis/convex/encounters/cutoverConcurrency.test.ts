import { expect, it } from 'vitest'
import {
  assertEncounterCutoverWorkload,
  encounterCutoverWorkloadDefinition,
  measureEncounterCutoverWorkload,
  scheduleEncounterCutoverWorkload,
  type EncounterCutoverCommandSample
} from '../../tests/developmentEncounterCutover'

it('runs one frozen eight-round schedule across two concurrent Encounters', async () => {
  const expected =
    encounterCutoverWorkloadDefinition.rounds *
    encounterCutoverWorkloadDefinition.actors *
    (encounterCutoverWorkloadDefinition.actionsPerActorTurn +
      encounterCutoverWorkloadDefinition.reactionsPerActorTurn)
  const schedule = scheduleEncounterCutoverWorkload()
  expect(schedule).toHaveLength(expected)
  expect(schedule.filter((item) => item.kind === 'ACTION')).toHaveLength((expected * 2) / 3)
  expect(schedule.filter((item) => item.kind === 'REACTION')).toHaveLength(expected / 3)
  expect(new Set(schedule.map((item) => item.participant))).toEqual(
    new Set(['GM', 'PLAYER_1', 'PLAYER_2', 'PLAYER_3', 'PLAYER_4', 'PLAYER_5'])
  )
  expect(scheduleEncounterCutoverWorkload('INDEPENDENT')).toEqual(
    schedule.map((item) => ({ ...item, aggregate: 'INDEPENDENT' }))
  )
  const samples: Array<[number, number]> = []
  const workload = await measureEncounterCutoverWorkload(async (current) => {
    samples.push([current[0].length, current[1].length])
    const items = [...current[0], ...current[1]]
    return {
      commandSamples: items.flatMap((item): EncounterCutoverCommandSample[] =>
        item.kind === 'ACTION'
          ? [{ operation: 'RESOLVE_ACTION' as const, durationMs: 250 }]
          : [
              { operation: 'SCENE_MOVE' as const, durationMs: 250 },
              { operation: 'REACTION_RESPONSE' as const, durationMs: 250 },
              { operation: 'ADVANCE_TURN' as const, durationMs: 250 }
            ]
      ),
      reactionCompositeDurationsMs: items.filter((item) => item.kind === 'REACTION').map(() => 1500)
    }
  })
  expect(samples).toEqual([[expected, expected]])
  expect(workload.samples).toBe(1)
  expect(workload.commandSamples).toBe((expected * 10) / 3)
  expect(workload.p95Ms).toBe(250)
  expect(workload.maximumMs).toBe(250)
  expect(workload.commandsPerSample).toBe(expected)
  expect(workload.independentCommandsPerSample).toBe(expected)
  expect(workload.byOperation.RESOLVE_ACTION.samples).toBe((expected * 4) / 3)
  expect(workload.byOperation.SCENE_MOVE.samples).toBe((expected * 2) / 3)
  expect(workload.byOperation.REACTION_RESPONSE.samples).toBe((expected * 2) / 3)
  expect(workload.byOperation.ADVANCE_TURN.samples).toBe((expected * 2) / 3)
  expect(workload.rawCommandSamples).toHaveLength(workload.commandSamples)
  expect(workload.reactionCompositeDurationsMs).toEqual(
    Array.from({ length: (expected * 2) / 3 }, () => 1500)
  )
  assertEncounterCutoverWorkload(workload)
})

it('refuses workload samples that omit command timings', async () => {
  await expect(
    measureEncounterCutoverWorkload(async () => ({
      commandSamples: [],
      reactionCompositeDurationsMs: []
    }))
  ).rejects.toThrow()
})

it('checks each authoritative operation class even when its tail is hidden in the overall p95', async () => {
  const workload = await measureEncounterCutoverWorkload(async (current) => {
    const items = [...current[0], ...current[1]]
    let sceneMoves = 0
    return {
      commandSamples: items.flatMap((item): EncounterCutoverCommandSample[] =>
        item.kind === 'ACTION'
          ? [{ operation: 'RESOLVE_ACTION' as const, durationMs: 250 }]
          : [
              {
                operation: 'SCENE_MOVE' as const,
                durationMs: ++sceneMoves <= 16 ? 1250 : 250
              },
              { operation: 'REACTION_RESPONSE' as const, durationMs: 250 },
              { operation: 'ADVANCE_TURN' as const, durationMs: 250 }
            ]
      ),
      reactionCompositeDurationsMs: items.filter((item) => item.kind === 'REACTION').map(() => 250)
    }
  })
  expect(workload.p95Ms).toBe(250)
  expect(workload.byOperation.SCENE_MOVE.p95Ms).toBe(1250)
  expect(() => assertEncounterCutoverWorkload(workload)).toThrow(/SCENE_MOVE p95/)
})
