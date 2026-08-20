import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { CHARACTER_ACTION_MODEL_KEY } from '@artificer-toolkit/schema/api/characterActionRules'
import { CHARACTER_GRANT_FOLD_MODEL_KEY } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { ENCOUNTER_ACTOR_MODEL_KEY } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'

import {
  DND5E2014_CHARACTER_GRANT_FOLD_SOURCE,
  dnd5e2014CharacterGrantFoldEmptyInput,
  dnd5e2014CharacterGrantFoldEmptyOutput,
  dnd5e2014CharacterGrantFoldModel
} from './characterGrantFoldSource.js'
import {
  DND5E2014_CHARACTER_ACTION_SOURCE,
  dnd5e2014CharacterActionModel
} from './characterActionSource.js'
import {
  DND5E2014_ENCOUNTER_ACTOR_SOURCE,
  dnd5e2014EncounterActorModel
} from './encounterActorSource.js'
import {
  RuleDocumentValidationError,
  validateRulePackDocument
} from '../../../ruleDocumentValidation.js'
import { getRuleModelContract } from '../../../ruleModelContracts.js'

type Graph = {
  contentType: string
  nodes: Array<{
    id: string
    type: string
    name: string
    position: { x: number; y: number }
    content?: Record<string, unknown>
  }>
  edges: Array<{ id: string; sourceId: string; targetId: string }>
}

function canonicalGraph(): Graph {
  return structuredClone(dnd5e2014CharacterGrantFoldModel) as unknown as Graph
}

function canonicalActionGraph(): Graph {
  return structuredClone(dnd5e2014CharacterActionModel) as unknown as Graph
}

function document(models: RulePackDocumentDto['models']): RulePackDocumentDto {
  return { schemaVersion: 1, models, fixtures: [] }
}

function jsonGraph(graph: Graph): RulePackDocumentDto['models'][string] {
  return graph as unknown as RulePackDocumentDto['models'][string]
}

const infiniteFunctionSource = String.raw`/** @type {Handler} */
export const handler = async () => {
  while (true) {}
};`

function infiniteGraph(): Graph {
  return {
    contentType: 'application/vnd.gorules.decision',
    nodes: [
      { id: 'input', type: 'inputNode', name: 'Input', position: { x: 0, y: 0 } },
      {
        id: 'loop',
        type: 'functionNode',
        name: 'Loop',
        position: { x: 180, y: 0 },
        content: { source: infiniteFunctionSource }
      },
      { id: 'output', type: 'outputNode', name: 'Output', position: { x: 360, y: 0 } }
    ],
    edges: [
      { id: 'input-loop', sourceId: 'input', targetId: 'loop' },
      { id: 'loop-output', sourceId: 'loop', targetId: 'output' }
    ]
  }
}

function parentGraph(): Graph {
  return {
    contentType: 'application/vnd.gorules.decision',
    nodes: [
      { id: 'input', type: 'inputNode', name: 'Input', position: { x: 0, y: 0 } },
      {
        id: 'child',
        type: 'decisionNode',
        name: 'Child',
        position: { x: 180, y: 0 },
        content: {
          key: 'loop',
          passThrough: false,
          inputField: null,
          outputPath: null,
          executionMode: 'single'
        }
      },
      { id: 'output', type: 'outputNode', name: 'Output', position: { x: 360, y: 0 } }
    ],
    edges: [
      { id: 'input-child', sourceId: 'input', targetId: 'child' },
      { id: 'child-output', sourceId: 'child', targetId: 'output' }
    ]
  }
}

function nativeTimeoutProof(): Array<{ label: string; elapsedMs: number; message: string }> {
  const runtimeUrl = new URL('../../../zenRuleEngine.ts', import.meta.url).href
  const script = [
    `await import(${JSON.stringify(runtimeUrl)});`,
    `const { ZenDecisionContent, ZenEngine } = await import('@gorules/zen-engine');`,
    `const infiniteGraph = ${JSON.stringify(infiniteGraph())};`,
    `const parentGraph = ${JSON.stringify(parentGraph())};`,
    `const results = [];`,
    `const prove = async (label, evaluate) => {`,
    `  const startedAt = performance.now();`,
    `  let message = '';`,
    `  try { await evaluate(); } catch (error) { message = String(error); }`,
    `  const elapsedMs = performance.now() - startedAt;`,
    `  if (!/interrupted/i.test(message)) throw new Error(label + ' did not report interruption: ' + message);`,
    `  if (elapsedMs < 20 || elapsedMs >= 250) throw new Error(label + ' elapsed ' + elapsedMs + 'ms');`,
    `  results.push({ label, elapsedMs, message });`,
    `};`,
    `const directEngine = new ZenEngine();`,
    `try { await prove('raw', () => directEngine.createDecision(infiniteGraph).evaluate({})); } finally { directEngine.dispose(); }`,
    `const childEngine = new ZenEngine({ loader: async (key) => new ZenDecisionContent(key === 'loop' ? infiniteGraph : parentGraph) });`,
    `try { await prove('child', () => childEngine.evaluate('parent', {})); } finally { childEngine.dispose(); }`,
    `console.log(JSON.stringify(results));`
  ].join('\n')
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', script],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 1024 * 1024
    }
  )
  if (child.error) throw child.error
  if (child.status !== 0) {
    throw new Error(`Native timeout proof failed: ${child.stderr || child.stdout}`)
  }
  return JSON.parse(child.stdout.trim()) as Array<{
    label: string
    elapsedMs: number
    message: string
  }>
}

describe('reserved Character Function-model security', () => {
  it('registers the direct reserved model contract', () => {
    const contract = getRuleModelContract(CHARACTER_GRANT_FOLD_MODEL_KEY)
    expect(contract?.input.parse(dnd5e2014CharacterGrantFoldEmptyInput)).toEqual(
      dnd5e2014CharacterGrantFoldEmptyInput
    )
    expect(contract?.output.parse(dnd5e2014CharacterGrantFoldEmptyOutput)).toEqual(
      dnd5e2014CharacterGrantFoldEmptyOutput
    )
    const actionContract = getRuleModelContract(CHARACTER_ACTION_MODEL_KEY)
    const actionInput = {
      candidates: [],
      spellCandidates: [],
      spellSlots: [],
      spellEffects: [],
      spellMechanics: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      totalLevel: 0,
      classLevels: [],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: null,
      attackRollModes: {
        MELEE: 'NORMAL',
        RANGED: 'NORMAL',
        SPELL: 'NORMAL',
        UNARMED: 'NORMAL'
      }
    }
    expect(actionContract?.input.parse(actionInput)).toEqual(actionInput)
    const actionOutput = {
      actionDecisions: [],
      spellCastMechanics: [],
      spellReferenceMechanics: [],
      spellCastDecisions: []
    }
    expect(actionContract?.output.parse(actionOutput)).toEqual(actionOutput)
  })

  it('accepts only the exact canonical reserved graph', () => {
    expect(() =>
      validateRulePackDocument(
        document({ [CHARACTER_GRANT_FOLD_MODEL_KEY]: dnd5e2014CharacterGrantFoldModel })
      )
    ).not.toThrow()
    expect(() =>
      validateRulePackDocument(
        document({ [CHARACTER_ACTION_MODEL_KEY]: dnd5e2014CharacterActionModel })
      )
    ).not.toThrow()
    expect(() =>
      validateRulePackDocument(
        document({ [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel })
      )
    ).not.toThrow()

    const sourceMutation = canonicalGraph()
    const functionNode = sourceMutation.nodes.find((node) => node.type === 'functionNode')
    if (!functionNode?.content || typeof functionNode.content.source !== 'string') {
      throw new Error('Expected the canonical Function node.')
    }
    functionNode.content.source += '\n// mutation'

    const addedNode = canonicalGraph()
    addedNode.nodes.push({
      id: 'extra',
      type: 'expressionNode',
      name: 'Extra',
      position: { x: 540, y: 0 },
      content: {
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        expressions: []
      }
    })

    for (const graph of [sourceMutation, addedNode]) {
      expect(() =>
        validateRulePackDocument(document({ [CHARACTER_GRANT_FOLD_MODEL_KEY]: jsonGraph(graph) }))
      ).toThrow(RuleDocumentValidationError)
    }

    const actionMutation = canonicalActionGraph()
    const actionFunction = actionMutation.nodes.find((node) => node.type === 'functionNode')
    if (!actionFunction?.content || typeof actionFunction.content.source !== 'string') {
      throw new Error('Expected the canonical action Function node.')
    }
    actionFunction.content.source += '\n// mutation'
    expect(() =>
      validateRulePackDocument(
        document({ [CHARACTER_ACTION_MODEL_KEY]: jsonGraph(actionMutation) })
      )
    ).toThrow(RuleDocumentValidationError)
  })

  it('rejects a clone of the reserved Function graph under any other model key', () => {
    expect(() =>
      validateRulePackDocument(
        document({
          [CHARACTER_GRANT_FOLD_MODEL_KEY]: dnd5e2014CharacterGrantFoldModel,
          clone: jsonGraph(canonicalGraph())
        })
      )
    ).toThrow(/unsupported node type "functionNode"/)
  })

  it('keeps the repository-owned source free of import, I/O, time, and random capabilities', () => {
    expect(DND5E2014_CHARACTER_GRANT_FOLD_SOURCE).not.toMatch(
      /\b(?:import|require|fetch|XMLHttpRequest|WebSocket|process|Date|performance|setTimeout|setInterval|crypto)\b|Math\.random/
    )
    expect(DND5E2014_CHARACTER_ACTION_SOURCE).not.toMatch(
      /\b(?:import|require|fetch|XMLHttpRequest|WebSocket|process|Date|performance|setTimeout|setInterval|crypto)\b|Math\.random/
    )
    expect(DND5E2014_ENCOUNTER_ACTOR_SOURCE).not.toMatch(
      /\b(?:import|require|fetch|XMLHttpRequest|WebSocket|process|Date|performance|setTimeout|setInterval|crypto)\b|Math\.random/
    )
  })

  it('interrupts raw and child native Function evaluations near the configured 50 ms bound', () => {
    const results = nativeTimeoutProof()
    expect(results.map((result) => result.label)).toEqual(['raw', 'child'])
    for (const result of results) {
      expect(result.message).toMatch(/interrupted/i)
      expect(result.elapsedMs).toBeGreaterThanOrEqual(20)
      expect(result.elapsedMs).toBeLessThan(250)
    }
  })
})
