import { describe, expect, it } from 'vitest'

import { createSubjectAuthoringService } from './pipeline.js'

describe('subject authoring pipeline', () => {
  it('prepares a validated compiled document without persisting a normalized aggregate', async () => {
    const service = createSubjectAuthoringService({
      validate: (input: { id: string }) => ({ ...input, label: 'Prepared' }),
      compile: (authored) => ({ sourceId: authored.id })
    })

    await expect(service.prepare({ id: 'subject-1' })).resolves.toEqual({
      authored: { id: 'subject-1', label: 'Prepared' },
      compiled: { sourceId: 'subject-1' }
    })
  })
})
