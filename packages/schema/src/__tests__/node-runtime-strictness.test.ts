import { describe, expect, it } from 'vitest'
import { actionPresentationPresets } from '@artificer-toolkit/design-system'
import { AUTHORED_LIMITS } from '../shared/authoredLimits.js'
import { nodeRuntimeContextDtoSchema, nodeRuntimeNodeDtoSchema } from '../api/nodeRuntime.js'

const baseNode = {
  id: 'base',
  path: [],
  label: 'Base',
  visible: true,
  required: false,
  hiddenBehavior: 'KEEP' as const,
  clearPaths: []
}

describe('node runtime schema strictness', () => {
  const validAction = {
    type: 'collection.add',
    label: 'Add',
    presentation: actionPresentationPresets.text
  } as const

  it('accepts a valid scalar input', () => {
    expect(
      nodeRuntimeNodeDtoSchema.parse({
        ...baseNode,
        kind: 'INPUT',
        type: 'TEXT',
        authoring: { exposure: 'author' }
      })
    ).toMatchObject({
      kind: 'INPUT',
      type: 'TEXT'
    })
  })

  it('bounds request size, nesting, and collection fan-out', () => {
    const request = { mapId: 'race', systemId: 'dnd5e2014' }
    expect(
      nodeRuntimeContextDtoSchema.safeParse({
        ...request,
        values: { text: 'x'.repeat(AUTHORED_LIMITS.mutationPayloadBytes) }
      }).success
    ).toBe(false)

    let nested: unknown = 'leaf'
    for (let depth = 0; depth <= AUTHORED_LIMITS.facetNestingDepth; depth += 1) {
      nested = { child: nested }
    }
    expect(nodeRuntimeContextDtoSchema.safeParse({ ...request, values: { nested } }).success).toBe(
      false
    )

    expect(
      nodeRuntimeContextDtoSchema.safeParse({
        ...request,
        values: {
          rows: Array.from({ length: AUTHORED_LIMITS.referenceCollectionItems + 1 }, () => ({}))
        }
      }).success
    ).toBe(false)
  })

  it('accepts a valid select input', () => {
    expect(
      nodeRuntimeNodeDtoSchema.parse({
        ...baseNode,
        kind: 'INPUT',
        type: 'SELECT_SINGLE',
        options: [{ value: 'a', label: 'A' }],
        authoring: { exposure: 'author' }
      })
    ).toMatchObject({
      kind: 'INPUT',
      type: 'SELECT_SINGLE'
    })
  })

  it('accepts a valid object group', () => {
    expect(
      nodeRuntimeNodeDtoSchema.parse({
        ...baseNode,
        kind: 'GROUP',
        groupKind: 'OBJECT',
        presentation: 'inline',
        childMapId: 'object-child',
        authoring: {
          exposure: 'author',
          actions: [validAction]
        }
      })
    ).toMatchObject({
      kind: 'GROUP',
      groupKind: 'OBJECT'
    })
  })

  it('accepts a valid array group', () => {
    expect(
      nodeRuntimeNodeDtoSchema.parse({
        ...baseNode,
        kind: 'GROUP',
        groupKind: 'ARRAY',
        presentation: 'table',
        childMapId: 'array-child',
        authoring: {
          exposure: 'author',
          collection: {
            ordering: { mode: 'derived' },
            actions: [validAction]
          }
        }
      })
    ).toMatchObject({
      kind: 'GROUP',
      groupKind: 'ARRAY'
    })
  })

  it('accepts responsive semantic group appearance', () => {
    const result = nodeRuntimeNodeDtoSchema.parse({
      ...baseNode,
      kind: 'GROUP',
      groupKind: 'ARRAY',
      presentation: 'summary',
      childMapId: 'array-child',
      authoring: {
        exposure: 'author',
        appearance: {
          heading: {
            default: { style: 'heading', tone: 'primary' },
            compact: { style: 'label', tone: 'accent' }
          },
          surface: {
            default: { role: 'panel' },
            wide: { role: 'raised' }
          }
        },
        collection: {
          ordering: { mode: 'derived' },
          actions: [validAction]
        }
      }
    })

    expect(result.authoring).toMatchObject({
      appearance: {
        heading: { compact: { style: 'label', tone: 'accent' } },
        surface: { wide: { role: 'raised' } }
      }
    })
  })

  it('rejects raw visual values outside the semantic vocabulary', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseNode,
        kind: 'GROUP',
        groupKind: 'OBJECT',
        presentation: 'inline',
        childMapId: 'object-child',
        authoring: {
          exposure: 'author',
          actions: [validAction],
          appearance: {
            heading: {
              default: { style: '18px', tone: '#ff0000' }
            }
          }
        }
      }).success
    ).toBe(false)
  })

  it('rejects unknown keys', () => {
    const result = nodeRuntimeNodeDtoSchema.safeParse({
      ...baseNode,
      kind: 'INPUT',
      type: 'TEXT',
      authoring: { exposure: 'author' },
      unknownKey: 'unexpected'
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected strict node parsing to fail')
    expect(result.error.message).toContain('unknownKey')
  })

  it('rejects INPUT without a type', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseNode,
        kind: 'INPUT',
        authoring: { exposure: 'author' }
      }).success
    ).toBe(false)
  })

  it('rejects scalar INPUT with options', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseNode,
        kind: 'INPUT',
        type: 'TEXT',
        options: [{ value: 'a', label: 'A' }],
        authoring: { exposure: 'author' }
      }).success
    ).toBe(false)
  })

  it('rejects select INPUT without options', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseNode,
        kind: 'INPUT',
        type: 'SELECT_SINGLE',
        authoring: { exposure: 'author' }
      }).success
    ).toBe(false)
  })

  it('rejects GROUP missing groupKind and childMapId', () => {
    const result = nodeRuntimeNodeDtoSchema.safeParse({
      ...baseNode,
      kind: 'GROUP',
      presentation: 'inline',
      authoring: {
        exposure: 'author',
        actions: [validAction]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected strict node parsing to fail')
    expect(result.error.message).toContain('groupKind')
    expect(result.error.message).toContain('childMapId')
  })

  it('rejects object group presentation that is not inline/branch', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseNode,
        kind: 'GROUP',
        groupKind: 'OBJECT',
        presentation: 'table',
        childMapId: 'object-child',
        authoring: {
          exposure: 'author',
          actions: [validAction]
        }
      }).success
    ).toBe(false)
  })

  it('rejects array-only authoring metadata on object groups', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseNode,
        kind: 'GROUP',
        groupKind: 'OBJECT',
        presentation: 'inline',
        childMapId: 'object-child',
        authoring: {
          exposure: 'author',
          actions: [validAction],
          collection: {
            ordering: { mode: 'derived' },
            actions: [validAction]
          }
        }
      }).success
    ).toBe(false)
  })

  it('rejects duplicate collection action types', () => {
    const result = nodeRuntimeNodeDtoSchema.safeParse({
      ...baseNode,
      kind: 'GROUP',
      groupKind: 'ARRAY',
      presentation: 'inline',
      childMapId: 'array-child',
      authoring: {
        exposure: 'author',
        collection: {
          ordering: { mode: 'derived' },
          actions: [
            {
              type: 'collection.add',
              label: 'Add',
              presentation: actionPresentationPresets.text
            },
            {
              type: 'collection.add',
              label: 'Also add',
              presentation: actionPresentationPresets.text
            }
          ]
        }
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected strict node parsing to fail')
    expect(result.error.message).toContain('Duplicate action type')
  })

  it('rejects manual collection ordering without identityPath', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseNode,
        kind: 'GROUP',
        groupKind: 'ARRAY',
        presentation: 'inline',
        childMapId: 'array-child',
        authoring: {
          exposure: 'author',
          collection: {
            ordering: { mode: 'manual' },
            actions: [validAction]
          }
        }
      }).success
    ).toBe(false)
  })

  it('rejects invalid action presentation', () => {
    const result = nodeRuntimeNodeDtoSchema.safeParse({
      ...baseNode,
      kind: 'GROUP',
      groupKind: 'ARRAY',
      presentation: 'inline',
      childMapId: 'array-child',
      authoring: {
        exposure: 'author',
        collection: {
          ordering: { mode: 'derived' },
          actions: [
            {
              type: 'collection.add',
              label: 'Add',
              presentation: {
                default: {
                  display: 'invalid',
                  emphasis: 'quiet',
                  width: 'content',
                  density: 'compact'
                }
              }
            }
          ]
        }
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected strict node parsing to fail')
    expect(result.error.message).toContain('invalid')
  })
})
