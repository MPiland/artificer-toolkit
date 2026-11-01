import { describe, expect, it } from 'vitest'

import { checksumRuleDocument, type RuleGraphNodeDefinition } from '@artificer-toolkit/shared/rules'

import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  resumeTargetBoundActiveRuleEffectWithPause
} from '../targetBoundActiveRuleEffectExecutor.js'
import { repeatedFollowUpSaveResultPath } from '../systems/dnd5e/effectActionRepeatSaveEvidence.js'
import { createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  compiledSourceTurnStartSpell as compilation,
  plannedSourceTurnStartEffect,
  sourceTurnStartPlaneTransport,
  sourceTurnStartRuling,
  sourceTurnStartSpell
} from '../testing/sourceTurnStartSaveSpell.js'

const STUNNED = SRD_CONDITION_TYPES.find(({ code }) => code === 'STUNNED')!.id
const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id
const SOURCE_ID = testUuid(0xc511)
const HOLDER_ID = testUuid(0xc512)

/**
 * SPELLS-4.T2ps-c: a failed save holds a condition until the start of its source's next turn,
 * where the target saves once; the condition ends either way and a failure's GM rulings are
 * proposed beside the save.
 */

describe('a save at the start of the source next turn (SPELLS-4.T2ps-c)', () => {
  it('holds the condition for one tick counted on its source turn start', () => {
    const plan = compilation(sourceTurnStartSpell([sourceTurnStartRuling])).activeEffectPlan
    expect(plan).toMatchObject({
      recurrenceStage: 'START_OF_TURN',
      tickAnchor: 'SOURCE',
      initialRemaining: 1,
      countedByTurnEffects: true,
      conditionContributions: [{}]
    })
  })

  it('proposes the failure rulings, gated on the failed save, beside the save', () => {
    const plan = compilation(sourceTurnStartSpell([sourceTurnStartRuling])).activeEffectPlan!
    expect(plan.frozenGraph.definition.nodes.map(({ id }) => id)).toEqual([
      'repeat-save-d20',
      'repeat-save-d20-added-dice',
      plan.frozenGraphNodeId,
      'manual_adjudication-1'
    ])
    expect(plan.frozenGraph.definition.sourceEntryBindings).toContainEqual({
      sourceEntryId: sourceTurnStartRuling.id,
      nodeId: 'manual_adjudication-1'
    })
  })

  it('leaves an unmodelled plane transport to the ruling beside it', () => {
    const plan = compilation(
      sourceTurnStartSpell([sourceTurnStartPlaneTransport, sourceTurnStartRuling])
    ).activeEffectPlan!
    expect(plan.failureRulingIds).toEqual([sourceTurnStartRuling.id])
    expect(plan.frozenGraph.definition.nodes.map(({ id }) => id)).toEqual([
      'repeat-save-d20',
      'repeat-save-d20-added-dice',
      plan.frozenGraphNodeId,
      'manual_adjudication-1'
    ])
  })

  it('refuses a failure that owes anything but rulings', () => {
    expect(() =>
      compilation(
        sourceTurnStartSpell([
          sourceTurnStartRuling,
          { ...sourceTurnStartPlaneTransport, destinationKind: 'POINT' }
        ])
      )
    ).toThrow()
  })

  describe('at the source turn start', () => {
    async function turnStart(
      face: number,
      authored = sourceTurnStartSpell([sourceTurnStartRuling])
    ) {
      const { definition } = await plannedSourceTurnStartEffect({
        spell: authored,
        encounterId: testUuid(0xc513),
        sourceActorId: SOURCE_ID,
        holderActorId: HOLDER_ID
      })
      const lifecycle = { schemaVersion: 1 as const, remainingTicks: 1 }
      const input = {
        activeEffectId: testUuid(0xc514),
        activeEffectVersion: 1,
        definition,
        lifecycle,
        lifecycleChecksum: checksumRuleDocument(lifecycle),
        occurrenceId: testUuid(0xc515),
        targetActorId: HOLDER_ID,
        currentHitPoints: 100,
        temporaryHitPoints: 0,
        maximumHitPoints: 100,
        targetScalarValues: {},
        targetConditionIds: [STUNNED],
        targetDerivedFacts: {
          savingThrowDefinitions: [
            { abilityDefinitionId: CONSTITUTION, modifier: 0, rollMode: 'NORMAL', contributors: [] }
          ]
        },
        defenses: [],
        runtime: createSrdRulesRuntime()
      } as const
      const paused = await executeTargetBoundActiveRuleEffectWithPause(input)
      if (!('continuation' in paused)) throw new Error('Expected a save to be asked.')
      const result = await resumeTargetBoundActiveRuleEffectWithPause({
        ...input,
        continuation: paused.continuation,
        resolution: {
          requestId: paused.continuation.request.requestId,
          rawFaces: [face],
          rollMode: 'NORMAL',
          keep: 'FIRST',
          addedDice: []
        }
      })
      return Object.assign(result, { definition })
    }

    const rulingTrace = (result: Awaited<ReturnType<typeof turnStart>>) =>
      'execution' in result && result.execution.status === 'COMPLETE'
        ? result.execution.evidence.trace.find(({ nodeId }) => nodeId === 'manual_adjudication-1')
        : undefined

    it('releases the condition on a success and proposes no ruling', async () => {
      const result = await turnStart(20)
      expect(result).toMatchObject({
        terminal: true,
        applications: [{ kind: 'CONDITION_REMOVE', conditionId: STUNNED }]
      })
      expect(rulingTrace(result)?.outputs).toMatchObject({
        resolvedPath: 'ON_SAVE_SUCCESS',
        authoredPath: 'ON_SAVE_FAIL'
      })
    })

    it('releases the condition on a failure and proposes the ruling', async () => {
      const result = await turnStart(1)
      expect(result).toMatchObject({
        terminal: true,
        applications: [{ kind: 'CONDITION_REMOVE', conditionId: STUNNED }]
      })
      expect(rulingTrace(result)?.outputs).toMatchObject({
        applicationCandidate: true,
        resolvedPath: 'ON_SAVE_FAIL',
        authoredPath: 'ON_SAVE_FAIL'
      })
    })

    it.each([
      {
        label: 'a node that is not a ruling',
        extra: (node: RuleGraphNodeDefinition) => ({ ...node, id: 'extra-node' })
      },
      {
        label: 'a ruling that is not gated on the failed save',
        extra: (node: RuleGraphNodeDefinition) => ({
          ...node,
          id: 'manual_adjudication-2',
          inputs: {
            ...node.inputs,
            authoredPath: { kind: 'LITERAL' as const, value: 'ON_SAVE_SUCCESS' }
          }
        })
      }
    ])('rejects a repeat-save graph carrying $label', async ({ extra }) => {
      const result = await turnStart(1)
      if (!('execution' in result) || result.execution.status !== 'COMPLETE')
        throw new Error('Expected a complete save.')
      const { frozenGraph } = result.definition
      const ruling = frozenGraph.nodes.find(({ id }) => id === 'manual_adjudication-1')!
      const graph = { ...frozenGraph, nodes: [...frozenGraph.nodes, extra(ruling)] }
      expect(() =>
        repeatedFollowUpSaveResultPath({
          execution: result.execution,
          occurrenceId: testUuid(0xc515),
          definition: result.definition,
          graph,
          targetActorId: HOLDER_ID
        })
      ).toThrow('The committed D&D repeat-save graph is invalid.')
    })
  })
})
