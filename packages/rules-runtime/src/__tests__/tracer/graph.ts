import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'

import { TRACER_SYSTEM_ID } from './system.js'

/** A tracer rule graph; only the tracer's own operations and facts compile against it. */
export function tracerGraph(id: string, nodes: unknown[], outputs: Record<string, unknown>) {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id,
    gameSystemId: TRACER_SYSTEM_ID,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes,
    outputs
  })
}

export const fateDie = (id: string) => ({
  id,
  operation: { key: 'evidence.integer-range', contractVersion: 1 },
  inputs: { min: { kind: 'LITERAL', value: -1 }, max: { kind: 'LITERAL', value: 1 } }
})

export const add = (id: string, left: unknown, right: unknown) => ({
  id,
  operation: { key: 'number.add', contractVersion: 1 },
  inputs: { left, right }
})

export const nodeOutput = (nodeId: string) => ({ kind: 'NODE_OUTPUT', nodeId, port: 'value' })

/** Four Fate dice summed into the `dice` node. */
export const fourFateDice = [
  fateDie('f1'),
  fateDie('f2'),
  fateDie('f3'),
  fateDie('f4'),
  add('f12', nodeOutput('f1'), nodeOutput('f2')),
  add('f34', nodeOutput('f3'), nodeOutput('f4')),
  add('dice', nodeOutput('f12'), nodeOutput('f34'))
]
