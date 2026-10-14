import { describe, expect, it } from 'vitest'

import { vocabularyDtoSchema } from '../vocabulary/vocabulary.js'

describe('vocabularyDtoSchema', () => {
  it('carries the description as the only option copy field', () => {
    const parsed = vocabularyDtoSchema.parse({
      id: 'speed-1',
      code: 'WALKING',
      label: 'Walking',
      description: 'Ground movement.',
      short: 'Walk',
      tooltip: 'Legacy tooltip.'
    })

    expect(parsed).toEqual({
      id: 'speed-1',
      code: 'WALKING',
      label: 'Walking',
      description: 'Ground movement.',
      short: 'Walk'
    })
  })
})
