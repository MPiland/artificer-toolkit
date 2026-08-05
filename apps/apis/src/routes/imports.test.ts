import { describe, expect, it, vi } from 'vitest'
import {
  authoredContentExportRequestDtoSchema,
  importBatchInputDtoSchema,
  importCommitRequestDtoSchema
} from '@artificer-toolkit/schema/api/imports'

const mocks = vi.hoisted(() => ({
  handleAuthoringRequest: vi.fn()
}))

vi.mock('@artificer-toolkit/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/functions')>()
  return {
    ...actual,
    handleAuthoringRequest: mocks.handleAuthoringRequest
  }
})

await import('./imports.js')

describe('import route handlers', () => {
  it('registers preview, commit, and export with their shared contracts', () => {
    expect(mocks.handleAuthoringRequest).toHaveBeenCalledTimes(3)
    expect(mocks.handleAuthoringRequest.mock.calls[0]?.[0]).toBe(importBatchInputDtoSchema)
    expect(mocks.handleAuthoringRequest.mock.calls[1]?.[0]).toBe(importCommitRequestDtoSchema)
    expect(mocks.handleAuthoringRequest.mock.calls[2]?.[0]).toBe(
      authoredContentExportRequestDtoSchema
    )
  })
})
