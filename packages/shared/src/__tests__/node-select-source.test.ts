import { describe, expect, it } from 'vitest'
import { resolveLocalCollectionOptions } from '../utils/nodeRuntime.js'
import type { NodeSelectSource } from '../utils/nodeDefinition.js'

function acceptSource(source: NodeSelectSource): NodeSelectSource {
  return source
}

describe('node select source discriminators', () => {
  it('keeps inline options and conditional option groups as distinct variants', () => {
    const inlineOptions = acceptSource({
      kind: 'INLINE_OPTIONS',
      options: [{ code: 'A', label: 'Option A' }]
    })
    const inlineGroups = acceptSource({
      kind: 'INLINE_GROUPS',
      optionGroups: [
        {
          showIf: { kind: 'AND', expressions: [] },
          options: [{ code: 'B', label: 'Option B' }]
        }
      ]
    })

    expect(inlineOptions.kind).toBe('INLINE_OPTIONS')
    expect(inlineGroups.kind).toBe('INLINE_GROUPS')
  })

  it('rejects the legacy and cross-variant source shapes at compile time', () => {
    // @ts-expect-error The ambiguous legacy discriminator is intentionally unsupported.
    const legacySource = acceptSource({ kind: 'INLINE', options: [] })
    // @ts-expect-error INLINE_OPTIONS cannot carry grouped options.
    const crossedSource = acceptSource({ kind: 'INLINE_OPTIONS', optionGroups: [] })

    expect(legacySource.kind).toBe('INLINE')
    expect(crossedSource.kind).toBe('INLINE_OPTIONS')
  })

  it('resolves local collection values and fails closed on malformed rows', () => {
    const source = {
      kind: 'LOCAL_COLLECTION' as const,
      rootCollectionPath: ['features'],
      valuePath: ['id'],
      labelPath: ['label']
    } as const satisfies NodeSelectSource

    expect(
      resolveLocalCollectionOptions(source, {
        values: {
          features: [
            { id: 'action-1', label: 'Claw', section: 'ACTION' },
            { id: 'trait-1', label: 'Keen Smell', section: 'TRAIT' }
          ]
        }
      })
    ).toEqual([
      { value: 'action-1', label: 'Claw' },
      { value: 'trait-1', label: 'Keen Smell' }
    ])

    expect(
      resolveLocalCollectionOptions(source, {
        values: { features: [{ id: 'action-1', section: 'ACTION' }] }
      })
    ).toEqual([])
  })
})
