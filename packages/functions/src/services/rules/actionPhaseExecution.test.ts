import { describe, expect, it, vi } from 'vitest'

import type { ServerRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { CharacterRuleActionExecutionPlan } from './characterRuleActionSystemAdapter.js'
import { resolveActionPhaseExecution } from './actionPhaseExecution.js'

const ids = {
  effect: '00000000-0000-4000-8000-000000000001',
  system: '00000000-0000-4000-8000-000000000002'
}
const checksum = 'a'.repeat(64)
const published = {
  id: ids.effect,
  gameSystemId: ids.system,
  definitionFamilyKey: 'effect-action',
  checksum,
  definition: {
    schemaVersion: 1 as const,
    id: ids.effect,
    gameSystemId: ids.system,
    definitionFamilyKey: 'effect-action',
    nodes: [],
    outputs: {}
  }
}

const testPlan: Extract<CharacterRuleActionExecutionPlan, { kind: 'TEST_OUTCOME' }> = {
  kind: 'TEST_OUTCOME',
  compilerSource: {
    schemaVersion: 1,
    sourceId: ids.effect,
    entryPointDefinitionId: ids.effect,
    effectId: ids.effect,
    conditionDefinitionIds: [],
    savingThrowAbilityDefinitionId: null,
    compiledEffect: {},
    compiledEffectChecksum: checksum,
    capabilityContractVersion: 1,
    compilerSourceChecksum: checksum
  },
  test: {
    published,
    template: {
      definitionId: ids.effect,
      gameSystemId: ids.system,
      definitionFamilyKey: 'effect-action',
      checksum
    }
  },
  outcomes: [
    {
      pathCode: 'ON_HIT',
      template: {
        definitionId: ids.effect,
        gameSystemId: ids.system,
        definitionFamilyKey: 'effect-action',
        checksum
      }
    }
  ]
}

function complete(resultPath: string): ServerRuleExecutionResultDto {
  return {
    status: 'COMPLETE',
    outputs: { resultPath },
    evidence: { source: {}, trace: [], outputs: {} }
  } as unknown as ServerRuleExecutionResultDto
}

describe('resolveActionPhaseExecution', () => {
  it('leaves SINGLE_GRAPH and both phase pauses untransitioned', () => {
    expect(
      resolveActionPhaseExecution({
        plan: { kind: 'SINGLE_GRAPH' } as CharacterRuleActionExecutionPlan,
        phase: 'TEST',
        execution: complete('ON_HIT'),
        adapter: {},
        facts: {}
      })
    ).toEqual({ kind: 'SINGLE_GRAPH' })
    expect(
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'TEST',
        execution: { status: 'PAUSED' } as unknown as ServerRuleExecutionResultDto,
        adapter: {},
        facts: {}
      })
    ).toEqual({ kind: 'PAUSED', phase: 'TEST' })
    expect(
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'OUTCOME',
        execution: { status: 'PAUSED' } as unknown as ServerRuleExecutionResultDto,
        adapter: {},
        facts: {}
      })
    ).toEqual({ kind: 'PAUSED', phase: 'OUTCOME' })
  })

  it('allows a legal omitted TEST path only when specialization is null', () => {
    expect(
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'TEST',
        execution: complete('ON_MISS'),
        adapter: { specializeOutcomeTemplate: () => null },
        facts: {}
      })
    ).toEqual({ kind: 'TEST_ONLY', selectedPath: 'ON_MISS' })
  })

  it('requires an exact specialized graph for a sealed OUTCOME path', () => {
    const specializeOutcomeTemplate = vi.fn(() => ({
      published: testPlan.test.published,
      templateChecksum: checksum
    }))
    expect(
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'TEST',
        execution: complete('ON_HIT'),
        adapter: { specializeOutcomeTemplate },
        facts: {}
      })
    ).toMatchObject({ kind: 'OUTCOME', selectedPath: 'ON_HIT' })
    expect(() =>
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'TEST',
        execution: complete('ON_HIT'),
        adapter: { specializeOutcomeTemplate: () => null },
        facts: {}
      })
    ).toThrow('requires its sealed OUTCOME graph')
  })

  it('rejects a third phase and sealed outcome mismatches', () => {
    expect(() =>
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'OUTCOME',
        execution: complete('ON_HIT'),
        adapter: { specializeOutcomeTemplate: () => null },
        facts: {}
      })
    ).toThrow('third execution phase')
    expect(() =>
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'TEST',
        execution: complete('ON_HIT'),
        adapter: {
          specializeOutcomeTemplate: () => ({
            published: {
              ...testPlan.test.published,
              id: '00000000-0000-4000-8000-000000000003'
            },
            templateChecksum: checksum
          })
        },
        facts: {}
      })
    ).toThrow('does not match its sealed template')
    expect(() =>
      resolveActionPhaseExecution({
        plan: testPlan,
        phase: 'TEST',
        execution: complete('ON_MISS'),
        adapter: {
          specializeOutcomeTemplate: () => ({
            published: testPlan.test.published,
            templateChecksum: checksum
          })
        },
        facts: {}
      })
    ).toThrow('cannot produce an OUTCOME graph')
  })
})
