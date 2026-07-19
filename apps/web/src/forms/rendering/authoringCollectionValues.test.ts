import { describe, expect, it } from 'vitest'
import { cloneAuthoringGroupValue } from './authoringCollectionValues'

describe('authoring collection values', () => {
  it('regenerates every nested id while preserving non-identity values', () => {
    const source = {
      id: 'root-id',
      order: 2,
      label: 'Copied feature',
      feature: {
        id: 'feature-id',
        options: [
          {
            id: 'option-id',
            effects: [{ id: 'effect-id', order: 1 }]
          }
        ]
      }
    }

    const cloned = cloneAuthoringGroupValue(source, 7) as typeof source

    expect(cloned).toMatchObject({ order: 7, label: source.label })
    expect(cloned.id).not.toBe(source.id)
    expect(cloned.feature.id).not.toBe(source.feature.id)
    expect(cloned.feature.options[0]?.id).not.toBe(source.feature.options[0]?.id)
    expect(cloned.feature.options[0]?.effects[0]?.id).not.toBe(
      source.feature.options[0]?.effects[0]?.id
    )
    expect(cloned.feature.options[0]?.effects[0]?.order).toBe(1)
  })
})
