import { describe, expect, it } from 'vitest'
import type {
  NodeRuntimeResolvedScopeDto,
  NodeRuntimeResolveResponseDto
} from '../api/nodeRuntime.js'
import {
  compactNodeRuntimeResponse,
  expandNodeRuntimeResponse,
  nodeRuntimeCompactResolveResponseDtoSchema
} from '../api/nodeRuntimeTransport.js'

function scope(
  path: readonly (string | number)[],
  {
    clearPaths = [],
    label = 'Choice',
    optionLabel = 'One',
    visible = true
  }: {
    clearPaths?: (readonly string[])[]
    label?: string
    optionLabel?: string
    visible?: boolean
  } = {}
): NodeRuntimeResolvedScopeDto {
  return {
    mapId: 'feature',
    path,
    steps: [
      {
        id: 'step',
        label: 'Step',
        order: 0,
        sections: [
          {
            id: 'section',
            label: 'Section',
            order: 0,
            nodes: [
              {
                id: 'choice',
                path: ['choice'],
                label,
                visible,
                required: false,
                hiddenBehavior: 'CLEAR',
                clearPaths,
                kind: 'INPUT',
                type: 'SELECT_SINGLE',
                options: [{ value: 'one', label: optionLabel }],
                authoring: { exposure: 'author' }
              }
            ]
          }
        ]
      }
    ],
    clearPaths
  }
}

function response(scopes: NodeRuntimeResolveResponseDto['scopes']): NodeRuntimeResolveResponseDto {
  return {
    mapId: 'class',
    steps: [],
    clearPaths: [],
    scopes
  }
}

describe('node runtime compact transport', () => {
  it('dedupes JSON-identical models in first-seen order and roundtrips deep paths', () => {
    const input = response([
      scope(['features', 0]),
      scope(['features', 1, 'options', 2]),
      scope(['features', 2])
    ])

    const compact = compactNodeRuntimeResponse(input)

    expect(compact.models).toHaveLength(1)
    expect(compact.scopes.map((entry) => entry.modelIndex)).toEqual([0, 0, 0])
    expect(expandNodeRuntimeResponse(JSON.parse(JSON.stringify(compact)))).toEqual(input)
  })

  it('keeps visible state, options, and clear paths in distinct models while preserving root data', () => {
    const input = response([
      scope(['features', 0]),
      scope(['features', 1], { visible: false }),
      scope(['features', 2], { optionLabel: 'Two' }),
      scope(['features', 3], { clearPaths: [['choice']] })
    ])
    input.steps = [{ id: 'root', label: 'Root', order: 0, sections: [] }]
    input.clearPaths = [['root']]

    const compact = compactNodeRuntimeResponse(input)

    expect(compact.models).toHaveLength(4)
    expect(compact.steps).toEqual(input.steps)
    expect(compact.clearPaths).toEqual(input.clearPaths)
  })

  it('rejects invalid indices and unknown compact fields', () => {
    const compact = compactNodeRuntimeResponse(response([scope(['features', 0])]))

    for (const modelIndex of [-1, 0.5, 1]) {
      expect(
        nodeRuntimeCompactResolveResponseDtoSchema.safeParse({
          ...compact,
          scopes: [{ path: ['features', 0], modelIndex }]
        }).success
      ).toBe(false)
    }
    expect(
      nodeRuntimeCompactResolveResponseDtoSchema.safeParse({
        ...compact,
        extra: true
      }).success
    ).toBe(false)
  })

  it('expands each scope with independent mutable model arrays', () => {
    const expanded = expandNodeRuntimeResponse(
      compactNodeRuntimeResponse(
        response([
          scope(['features', 0], { clearPaths: [['choice']] }),
          scope(['features', 1], { clearPaths: [['choice']] })
        ])
      )
    )
    const first = expanded.scopes[0]!
    const second = expanded.scopes[1]!

    first.steps[0]!.sections[0]!.nodes[0]!.label = 'Changed'
    first.clearPaths.push(['other'])

    expect(second.steps[0]!.sections[0]!.nodes[0]!.label).toBe('Choice')
    expect(second.clearPaths).toEqual([['choice']])
  })
})
