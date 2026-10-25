import { SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'
import {
  checksumRuleDocument,
  compileRuleGraph,
  createRuleOperationRegistry,
  executeRuleGraph,
  resumeRuleGraph
} from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import {
  installedGameSystemRuleOperations,
  requireInstalledGameSystemRuleCapability
} from '../platformRulesRuntime.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import {
  dnd5eDeclaredInitiativeRollFacts,
  dnd5eInitiativeFactAdapter,
  DND5E_INITIATIVE_FACT_KEYS
} from '../systems/dnd5e/initiativeFactAdapter.js'

const OCCURRENCE_ID = '44444444-4444-4444-8444-444444444444'
const operations = createRuleOperationRegistry(installedGameSystemRuleOperations)
const compiled = compileRuleGraph({
  definition: SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH,
  sourceChecksum: checksumRuleDocument(SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH),
  capability: requireInstalledGameSystemRuleCapability(DND5E_SYSTEM_ID),
  operations
})
if (!compiled.ok) throw new Error('Expected the declared initiative graph to compile.')
const graph = compiled.value

/** Settles the declared graph with scripted faces, as the settled evidence of one declared actor. */
function settle(input: { rollMode: string; faces: readonly number[] }) {
  const remaining = [...input.faces]
  let result = executeRuleGraph({
    graph,
    occurrenceId: OCCURRENCE_ID,
    facts: {
      [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
      [DND5E_INITIATIVE_FACT_KEYS.modifier]: 3,
      ...dnd5eDeclaredInitiativeRollFacts(input.rollMode),
      [DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier]: -2
    },
    operations
  })
  let asked = 0
  while (result.status === 'PAUSED') {
    const value = remaining.shift()
    if (value === undefined) throw new Error('The graph asked for more dice than were supplied.')
    asked += 1
    result = resumeRuleGraph({
      continuation: result.continuation,
      response: { requestId: result.continuation.request.requestId, value },
      operations
    })
  }
  if (result.status !== 'COMPLETE') throw new Error('Expected a completed execution.')
  return { result, asked, unused: remaining }
}

describe('D&D declared initiative graph', () => {
  it('rolls one d20 and adds the modifier and speed factor on a normal roll', () => {
    const { result, asked } = settle({ rollMode: 'NORMAL', faces: [12] })
    expect(asked).toBe(1)
    expect(result.outputs).toMatchObject({ automatic: true, score: 12 + 3 - 2 })
    expect(result.evidence.trace.filter((entry) => entry.evidence)).toHaveLength(1)
  })

  it('rolls two d20s and keeps the higher on advantage', () => {
    const { result, asked, unused } = settle({ rollMode: 'ADVANTAGE', faces: [6, 15] })
    expect(asked).toBe(2)
    expect(unused).toEqual([])
    expect(result.outputs).toMatchObject({ score: 15 + 3 - 2 })
    expect(result.evidence.facts[DND5E_INITIATIVE_FACT_KEYS.keep]).toBe('HIGHER')
    expect(
      result.evidence.trace.flatMap((entry) => (entry.evidence ? [entry.evidence.value] : []))
    ).toEqual([6, 15])
  })

  it('rolls two d20s and keeps the lower on disadvantage', () => {
    const { result } = settle({ rollMode: 'DISADVANTAGE', faces: [15, 6] })
    expect(result.outputs).toMatchObject({ score: 6 + 3 - 2 })
  })

  it('keeps the first die even when it is the lower one on advantage', () => {
    const { result } = settle({ rollMode: 'ADVANTAGE', faces: [18, 2] })
    expect(result.outputs).toMatchObject({ score: 18 + 3 - 2 })
  })

  it.each(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'] as const)(
    'reads the %s roll mode back from the facts it rolled by',
    (rollMode) => {
      expect(
        dnd5eInitiativeFactAdapter.declaredRollMode(dnd5eDeclaredInitiativeRollFacts(rollMode))
      ).toBe(rollMode)
    }
  )

  it('reads no roll mode from facts that keep no face', () => {
    expect(dnd5eInitiativeFactAdapter.declaredRollMode({})).toBeNull()
  })
})
