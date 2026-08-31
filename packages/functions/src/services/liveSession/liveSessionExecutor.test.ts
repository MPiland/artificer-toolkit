import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { liveSessionExecutorInternals } from './liveSessionExecutor.js'
import type { LiveSessionCommandExecution } from './liveSessionService.js'

const ids = {
  barrier: '00000000-0000-4000-8000-000000000021',
  campaign: '00000000-0000-4000-8000-000000000022',
  character: '00000000-0000-4000-8000-000000000023',
  characterCommand: '00000000-0000-4000-8000-000000000024',
  encounter: '00000000-0000-4000-8000-000000000025',
  encounterCommand: '00000000-0000-4000-8000-000000000026',
  scene: '00000000-0000-4000-8000-000000000027',
  sceneCommand: '00000000-0000-4000-8000-000000000028',
  sceneDefinition: '00000000-0000-4000-8000-000000000029',
  token: '00000000-0000-4000-8000-000000000030'
} as const

const executorSource = readFileSync(
  join(process.cwd(), 'packages/functions/src/services/liveSession/liveSessionExecutor.ts'),
  'utf8'
)

describe('live-session executor command authority', () => {
  it('claims only through explicit CLAIM; COMMAND never reclaims authority', () => {
    const claimCase = executorSource.slice(
      executorSource.indexOf("case 'CLAIM':"),
      executorSource.indexOf("case 'SNAPSHOT':")
    )
    const commandCase = executorSource.slice(
      executorSource.indexOf("case 'COMMAND':"),
      executorSource.indexOf('\n  }\n\n  return liveSessionExecutorResponseDtoSchema')
    )

    expect(claimCase).toContain('claimLiveSessionRoomCommandAuthority')
    expect(commandCase).not.toContain('claimLiveSessionRoomCommandAuthority')
    expect(executorSource).not.toContain('requiresLiveSessionCommandAuthorityClaim')
  })

  it('never serializes a Character rule snapshot into the executor response', () => {
    const execution = liveSessionExecutorInternals.wireExecution(
      {
        aggregateKind: 'CHARACTER',
        aggregateId: ids.character,
        characterVision: { characterId: ids.character, dimRange: null },
        changedAggregates: [{ aggregateId: ids.character, aggregateKind: 'CHARACTER', version: 1 }],
        commandId: ids.characterCommand,
        replayed: false,
        response: null,
        ruleSnapshot: { private: 'server-only' },
        version: 1
      } as unknown as LiveSessionCommandExecution,
      { category: 'NON_RULE_BOUND', durationMs: 1 }
    )

    expect(execution).not.toHaveProperty('ruleSnapshot')
    expect(execution).toMatchObject({
      aggregateId: ids.character,
      characterVision: { characterId: ids.character, dimRange: null },
      changedAggregates: [{ aggregateId: ids.character, aggregateKind: 'CHARACTER', version: 1 }],
      hostTiming: { category: 'NON_RULE_BOUND', durationMs: 1 }
    })
  })

  it('classifies and strips the compact Character rule-evaluation marker', () => {
    const execution = {
      aggregateKind: 'CHARACTER',
      aggregateId: ids.character,
      characterVision: { characterId: ids.character, dimRange: null },
      changedAggregates: [{ aggregateId: ids.character, aggregateKind: 'CHARACTER', version: 1 }],
      commandId: ids.characterCommand,
      replayed: false,
      response: null,
      ruleEvaluationLane: 'CHARACTER_POLICY',
      version: 1
    } satisfies LiveSessionCommandExecution
    const timing = liveSessionExecutorInternals.hostTiming(execution, 12, null, null)

    expect(timing).toEqual({ category: 'RULE_BOUND', durationMs: 12 })
    expect(liveSessionExecutorInternals.wireExecution(execution, timing)).not.toHaveProperty(
      'ruleEvaluationLane'
    )
  })

  it('keeps exact changed roots and strips server-only spatial refresh snapshots', () => {
    const execution = liveSessionExecutorInternals.wireExecution(
      {
        aggregateKind: 'SCENE',
        aggregateId: ids.scene,
        changedAggregates: [
          { aggregateId: ids.character, aggregateKind: 'CHARACTER', version: 2 },
          { aggregateId: ids.encounter, aggregateKind: 'ENCOUNTER', version: 3 },
          { aggregateId: ids.scene, aggregateKind: 'SCENE', version: 4 }
        ],
        commandId: ids.sceneCommand,
        replayed: false,
        response: null,
        spatialRefresh: {
          characterRuleSnapshots: [{ characterId: ids.character, snapshot: { private: true } }],
          characterVisions: [{ characterId: ids.character, dimRange: null }],
          encounterRuleSnapshot: { private: true },
          sceneState: { id: ids.scene }
        },
        state: { id: ids.scene },
        version: 4
      } as unknown as LiveSessionCommandExecution,
      { category: 'RULE_BOUND', durationMs: 2 }
    )

    if (execution.aggregateKind !== 'SCENE') throw new Error('Expected Scene execution.')
    expect(execution.changedAggregates).toHaveLength(3)
    expect(execution.spatialRefresh).toEqual({
      characterVisions: [{ characterId: ids.character, dimRange: null }],
      sceneState: { id: ids.scene }
    })
    expect(execution.spatialRefresh).not.toHaveProperty('characterRuleSnapshots')
    expect(execution.spatialRefresh).not.toHaveProperty('encounterRuleSnapshot')
  })
})
