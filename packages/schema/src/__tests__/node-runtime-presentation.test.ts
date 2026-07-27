import { describe, expect, it } from 'vitest'
import { actionPresentationPresets } from '@artificer-toolkit/design-system'
import { nodeRuntimeNodeDtoSchema } from '../api/nodeRuntime.js'

const baseGroup = {
  id: 'items',
  path: ['items'],
  label: 'Items',
  kind: 'GROUP' as const,
  visible: true,
  required: false,
  hiddenBehavior: 'KEEP' as const,
  clearPaths: [],
  childMapId: 'items'
}

describe('node runtime group presentation', () => {
  it('rejects the removed focused-drawer platform detail', () => {
    expect(
      nodeRuntimeNodeDtoSchema.safeParse({
        ...baseGroup,
        groupKind: 'ARRAY',
        presentation: 'focused-drawer',
        authoring: {
          exposure: 'author',
          collection: { actions: [], ordering: { mode: 'derived' } }
        }
      }).success
    ).toBe(false)
  })

  it('accepts semantic authoring metadata without web-specific styling', () => {
    expect(
      nodeRuntimeNodeDtoSchema.parse({
        ...baseGroup,
        groupKind: 'ARRAY',
        presentation: 'inline',
        authoring: {
          exposure: 'author',
          collection: {
            actions: [
              {
                type: 'collection.add',
                label: 'Add option',
                presentation: actionPresentationPresets.text
              }
            ],
            ordering: { mode: 'derived' },
            join: 'OR',
            rowLayout: 'card',
            rowExpansion: 'expanded',
            rowSummary: 'modifier'
          }
        }
      })
    ).toMatchObject({
      authoring: {
        collection: {
          rowLayout: 'card',
          rowSummary: 'modifier'
        }
      }
    })
  })

  it('requires an explicit presentation for group nodes', () => {
    const result = nodeRuntimeNodeDtoSchema.safeParse({
      ...baseGroup,
      groupKind: 'ARRAY',
      authoring: {
        exposure: 'author',
        collection: { actions: [], ordering: { mode: 'derived' } }
      }
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('presentation')
    }
  })

  it('restricts object groups to inline or branch presentation', () => {
    for (const presentation of ['table', 'summary', 'focused']) {
      expect(
        nodeRuntimeNodeDtoSchema.safeParse({
          ...baseGroup,
          groupKind: 'OBJECT',
          presentation,
          authoring: { exposure: 'author', actions: [] }
        }).success
      ).toBe(false)
    }

    for (const presentation of ['inline', 'branch']) {
      expect(
        nodeRuntimeNodeDtoSchema.safeParse({
          ...baseGroup,
          groupKind: 'OBJECT',
          presentation,
          authoring: { exposure: 'author', actions: [] }
        }).success
      ).toBe(true)
    }
  })
})
